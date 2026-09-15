/**
 * Risk Engine
 *
 * Evaluates every active student daily and maintains their risk_status,
 * risk_reasons, risk_probability, and risk_band fields in the Students sheet.
 *
 * Trigger rules (from PROJECT_OVERVIEW.md):
 *   1. 2+ consecutive unexcused absences  → at_risk
 *   2. No progress log for 7+ days        → at_risk
 *   3. No interview/task for 7+ days      → at_risk (applying/interviewing stage only)
 *
 * Additional:
 *   4. 3+ unexcused absences in 14 days   → at_risk with high-priority flag
 *      (previously skipped these students silently — now they are flagged)
 *
 * On transition to at_risk:
 *   - Student record updated
 *   - Risk history entry appended
 *   - In-app notification sent to mentor
 *   - In-app notification sent to all managers
 *
 * On resolution (student becomes safe again):
 *   - Student record updated
 *   - Risk history entry resolved
 *   - In-app notification sent to mentor
 *
 * Performance: reads each sheet exactly once, builds in-memory indexes,
 * then evaluates all students in a single pass.
 */

import { getAllStudents, updateStudent } from '@/lib/sheets/students';
import { readSheet } from '@/lib/sheets/client';
import { appendRiskHistoryEntry, resolveRiskHistoryEntry } from '@/lib/sheets/risk-history';
import { createNotification } from '@/lib/sheets/notifications';
import { getAllUsers } from '@/lib/sheets/users';
import { computeRiskScore } from './scoring';
import { sendRiskAlertWebhook, sendRiskResolvedWebhook } from '@/lib/security/webhook';
import type { Student, RiskResult, AttendanceLog, ProgressLog } from '@/types';
import { differenceInDays, subDays, format } from 'date-fns';
import type { RiskBand } from './scoring';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RiskReason =
  | 'absent_2_consecutive_days'
  | 'absent_3_in_14_days'
  | 'no_progress_update_7_days'
  | 'no_interview_or_task_7_days';

export interface RiskScanResult {
  updated: number;
  newly_at_risk: string[];
  newly_resolved: string[];
  band_updated: string[];
  skipped_terminated: number;
}

// ---------------------------------------------------------------------------
// Pure helper functions (exported for unit testing)
// ---------------------------------------------------------------------------

export function daysSince(dateStr: string | null | undefined): number {
  if (!dateStr) return Infinity;
  try {
    return differenceInDays(new Date(), new Date(dateStr));
  } catch {
    return Infinity;
  }
}

/** An absence counts toward risk only if it is unexcused. */
export function isUnexcusedAbsence(log: AttendanceLog): boolean {
  return !log.present && (!log.excuse || log.excuse.trim() === '');
}

/**
 * Returns true if the most recent N attendance logs contain N consecutive
 * unexcused absences on consecutive calendar days.
 */
export function hasConsecutiveAbsences(logs: AttendanceLog[], count: number): boolean {
  const unexcused = [...logs]
    .filter(isUnexcusedAbsence)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (unexcused.length < count) return false;

  // Check that the first `count` entries are on consecutive days
  for (let i = 0; i < count - 1; i++) {
    const curr = new Date(unexcused[i].date);
    const next = new Date(unexcused[i + 1].date);
    const diff = differenceInDays(curr, next);
    if (diff !== 1) return false;
  }

  return true;
}

/**
 * Returns true if the student has 3+ unexcused absences in the window.
 * These students are flagged at_risk with a high-priority reason rather
 * than being silently skipped.
 */
export function hasExcessiveAbsences(logs: AttendanceLog[], threshold = 3): boolean {
  return logs.filter(isUnexcusedAbsence).length >= threshold;
}

// ---------------------------------------------------------------------------
// Row mappers — use the canonical 18-column progress_logs schema
// ---------------------------------------------------------------------------

function rowToAttendanceLog(row: string[]): AttendanceLog {
  return {
    id:            row[0] || '',
    student_id:    row[1] || '',
    date:          row[2] || '',
    present:       row[3] === 'true',
    logged_by:     row[4] || '',
    session_label: row[5] || '',
    excuse:        (row[6] || '') as AttendanceLog['excuse'],
    excuse_note:   row[7] || '',
  };
}

function rowToProgressLog(row: string[]): ProgressLog {
  return {
    id:                  row[0]  || '',
    student_id:          row[1]  || '',
    student_name:        row[2]  || '',
    student_email:       row[3]  || '',
    log_type:            (row[4] || 'Other') as ProgressLog['log_type'],
    company_name:        row[5]  || '',
    scheduled_date:      row[6]  || '',
    scheduled_time:      row[7]  || '',
    note:                row[8]  || '',
    logged_at:           row[9]  || '',
    logged_by:           row[10] || '',
    job_url:             row[11] || '',
    mock_feedback:       row[12] || '',
    mock_score:          row[13] ? (() => { const n = parseInt(row[13], 10); return isNaN(n) ? undefined : n; })() : undefined,
    mock_strengths:      row[14] || '',
    mock_improvements:   row[15] || '',
    mock_interview_type: (row[16] || undefined) as ProgressLog['mock_interview_type'],
    mock_interviewer:    row[17] || '',
  };
}

// ---------------------------------------------------------------------------
// Risk evaluation — pure function, no I/O
// ---------------------------------------------------------------------------

const REASON_LABELS: Record<RiskReason, string> = {
  absent_2_consecutive_days:   '2 consecutive unexcused absences',
  absent_3_in_14_days:         '3+ unexcused absences in 14 days',
  no_progress_update_7_days:   'No progress update in 7 days',
  no_interview_or_task_7_days: 'No interview or task in 7 days',
};

export function formatRiskReasons(reasons: RiskReason[]): string {
  return reasons.map(r => REASON_LABELS[r]).join(', ');
}

export function evaluateStudentRisk(
  student: Student,
  attendanceLogs: AttendanceLog[],
  progressLogs: ProgressLog[]
): RiskResult & { reasons: RiskReason[] } {
  const reasons: RiskReason[] = [];

  // Rule 1: 2+ consecutive unexcused absences
  if (hasConsecutiveAbsences(attendanceLogs, 2)) {
    reasons.push('absent_2_consecutive_days');
  }

  // Rule 4: 3+ unexcused absences in the 14-day window
  // (previously these students were silently skipped — now flagged)
  if (hasExcessiveAbsences(attendanceLogs) && !reasons.includes('absent_2_consecutive_days')) {
    reasons.push('absent_3_in_14_days');
  }

  // Rule 2: No progress log for 7+ days
  if (progressLogs.length > 0) {
    const lastProgress = [...progressLogs].sort(
      (a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime()
    )[0];
    if (daysSince(lastProgress.logged_at) >= 7) {
      reasons.push('no_progress_update_7_days');
    }
  } else if (daysSince(student.created_at) >= 7) {
    reasons.push('no_progress_update_7_days');
  }

  // Rule 3: No interview or task for 7+ days (applying/interviewing only)
  if (student.stage === 'applying' || student.stage === 'interviewing') {
    if (daysSince(student.last_activity_date) >= 7) {
      reasons.push('no_interview_or_task_7_days');
    }
  }

  return {
    is_at_risk: reasons.length > 0,
    reasons,
  };
}

// ---------------------------------------------------------------------------
// Band ordering — used to detect escalations and improvements
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// Main scan — reads sheets once, evaluates all students
// ---------------------------------------------------------------------------

export async function runRiskScan(): Promise<RiskScanResult> {
  // --- Load all data in parallel ---
  const [students, allUsers, attendanceRows, progressRows, notificationsRows] = await Promise.all([
    getAllStudents(),
    getAllUsers().catch(() => {
      console.warn('[RiskScan] Could not fetch users — manager notifications will be skipped');
      return [];
    }),
    readSheet('attendance_logs'),
    readSheet('progress_logs'),
    readSheet('notifications').catch(() => []),
  ]);

  const managerEmails = allUsers
    .filter(u => u.active && u.role === 'manager')
    .map(u => u.email);

  // Load existing notifications to check for duplicates
  const existingNotifications = notificationsRows.map(row => ({
    id: row[0] || '',
    recipient_email: row[1] || '',
    type: row[2] || '',
    student_id: row[3] || '',
    student_name: row[4] || '',
    message: row[5] || '',
    read: row[6] === 'true',
    created_at: row[7] || '',
    payload_raw: row[8] || '',
  }));

  function hasRecentNotification(
    recipientEmail: string,
    type: string,
    studentId?: string,
    mentorEmail?: string,
    daysThreshold = 7
  ): boolean {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysThreshold);

    return existingNotifications.some(n => {
      if (n.recipient_email !== recipientEmail || n.type !== type) return false;
      if (studentId && n.student_id !== studentId) return false;
      
      // Parse payload to check for mentor_email if specified
      if (mentorEmail) {
        try {
          const payload = JSON.parse(n.payload_raw);
          if (payload.mentor_email !== mentorEmail) return false;
        } catch {
          return false;
        }
      }

      // Check date threshold
      try {
        const createdDate = new Date(n.created_at);
        return createdDate >= cutoff;
      } catch {
        return false;
      }
    });
  }

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  function isCurrentMonth(dateStr: string | null | undefined): boolean {
    if (!dateStr) return false;
    try {
      const d = new Date(dateStr);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    } catch {
      return false;
    }
  }

  // --- Build in-memory indexes (single pass each) ---
  const allAttendanceLogs = attendanceRows.map(rowToAttendanceLog).filter(l => l.id);
  const allProgressLogs   = progressRows.map(rowToProgressLog).filter(l => l.id);

  const attendanceByStudent = new Map<string, AttendanceLog[]>();
  for (const log of allAttendanceLogs) {
    const list = attendanceByStudent.get(log.student_id) ?? [];
    list.push(log);
    attendanceByStudent.set(log.student_id, list);
  }

  const progressByStudent = new Map<string, ProgressLog[]>();
  for (const log of allProgressLogs) {
    const list = progressByStudent.get(log.student_id) ?? [];
    list.push(log);
    progressByStudent.set(log.student_id, list);
  }

  // Compute the 14-day cutoff once, not inside the loop
  const cutoff14 = format(subDays(new Date(), 14), 'yyyy-MM-dd');

  // --- Evaluate each student ---
  let updated          = 0;
  let skippedTerminated = 0;
  const newlyAtRisk:   string[] = [];
  const newlyResolved: string[] = [];
  const bandUpdated:   string[] = [];

  for (const student of students) {
    if (student.terminated || student.hired) {
      skippedTerminated++;
      continue;
    }

    const studentAttendance = attendanceByStudent.get(student.id) ?? [];
    const studentProgress   = progressByStudent.get(student.id)   ?? [];

    // Limit attendance window to last 14 days for rule evaluation
    const attendance14 = studentAttendance.filter(l => l.date >= cutoff14);

    const riskResult = evaluateStudentRisk(student, attendance14, studentProgress);
    const riskScore  = computeRiskScore(student, attendance14, studentProgress);

    const currentBand = (student.risk_band as RiskBand | undefined) ?? 'safe';
    const newBand     = riskScore.band;
    const bandChanged = currentBand !== newBand;

    // ── Transition: safe → at_risk ─────────────────────────────────────────
    if (riskResult.is_at_risk && student.risk_status === 'safe') {
      const reasonsStr     = riskResult.reasons.join(', ');
      const readableReasons = formatRiskReasons(riskResult.reasons);

      await updateStudent(student.id, {
        risk_status:      'at_risk',
        risk_reasons:     reasonsStr,
        risk_probability: riskScore.probability,
        risk_band:        newBand,
      });
      student.risk_status = 'at_risk';
      student.risk_reasons = reasonsStr;
      student.risk_probability = riskScore.probability;
      student.risk_band = newBand;
      updated++;
      newlyAtRisk.push(student.name);

      // Append risk history entry
      try {
        await appendRiskHistoryEntry(
          student.id,
          student.name,
          student.mentor_email,
          reasonsStr,
          riskScore.probability,
          newBand
        );
      } catch (e) {
        console.error(`[RiskScan] Failed to write risk history for ${student.name}:`, e);
      }

      // Notify mentor
      const message = `${student.name} is now at risk (${Math.round(riskScore.probability * 100)}%): ${readableReasons}`;
      try {
        await createNotification(
          student.mentor_email,
          'risk_alert',
          student.id,
          student.name,
          message,
          { type: 'risk_alert', reasons: riskResult.reasons, days_inactive: daysSince(student.last_activity_date) }
        );
      } catch (e) {
        console.error(`[RiskScan] Failed to notify mentor for ${student.name}:`, e);
      }

      // Notify all managers (skip if mentor is also a manager)
      for (const managerEmail of managerEmails) {
        if (managerEmail === student.mentor_email) continue;
        try {
          await createNotification(
            managerEmail,
            'risk_alert',
            student.id,
            student.name,
            message,
            { type: 'risk_alert', reasons: riskResult.reasons, days_inactive: daysSince(student.last_activity_date) }
          );
        } catch (e) {
          console.error(`[RiskScan] Failed to notify manager ${managerEmail} for ${student.name}:`, e);
        }
      }

      // Send webhook alert (Discord/Slack)
      try {
        await sendRiskAlertWebhook(
          student.name,
          student.mentor_email,
          readableReasons,
          riskScore.probability
        );
      } catch (e) {
        console.error(`[RiskScan] Failed to send webhook for ${student.name}:`, e);
      }

    // ── Transition: at_risk → safe ─────────────────────────────────────────
    } else if (!riskResult.is_at_risk && student.risk_status === 'at_risk') {
      await updateStudent(student.id, {
        risk_status:      'safe',
        risk_reasons:     '',
        risk_probability: riskScore.probability,
        risk_band:        newBand,
      });
      student.risk_status = 'safe';
      student.risk_reasons = '';
      student.risk_probability = riskScore.probability;
      student.risk_band = newBand;
      updated++;
      newlyResolved.push(student.name);

      try {
        await resolveRiskHistoryEntry(student.id);
      } catch (e) {
        console.error(`[RiskScan] Failed to resolve risk history for ${student.name}:`, e);
      }

      try {
        await createNotification(
          student.mentor_email,
          'risk_resolved',
          student.id,
          student.name,
          `${student.name} is no longer at risk`,
          { type: 'risk_resolved', triggered_by: 'risk_scan' }
        );
      } catch (e) {
        console.error(`[RiskScan] Failed to send resolved notification for ${student.name}:`, e);
      }

      // Send webhook alert for resolution
      try {
        await sendRiskResolvedWebhook(student.name, student.mentor_email);
      } catch (e) {
        console.error(`[RiskScan] Failed to send resolved webhook for ${student.name}:`, e);
      }

    // ── Band change only (no status transition) ────────────────────────────
    } else if (bandChanged) {
      await updateStudent(student.id, {
        risk_probability: riskScore.probability,
        risk_band:        newBand,
      });
      student.risk_probability = riskScore.probability;
      student.risk_band = newBand;
      bandUpdated.push(student.name);
    }

    // ── Mentor Notifications for Active Mentees ─────────────────────────────
    if (!student.terminated && !student.hired) {
      // 1. Long Inactivity Alert
      const daysInactive = daysSince(student.last_activity_date);
      if (daysInactive >= 7) {
        if (!hasRecentNotification(student.mentor_email, 'student_inactivity', student.id, undefined, 7)) {
          try {
            await createNotification(
              student.mentor_email,
              'student_inactivity',
              student.id,
              student.name,
              `${student.name} has been inactive for ${daysInactive} days with no recent logs.`,
              { type: 'student_inactivity', days_inactive: daysInactive }
            );
          } catch (e) {
            console.error(`[RiskScan] Failed to send inactivity notification for ${student.name}:`, e);
          }
        }
      }

      // 2. Attendance Drop Alert
      const attFactor = riskScore.factors.find(f => f.factor === 'attendance_rate_4w');
      const attRate = attFactor ? attFactor.raw_value : 100;
      if (attRate < 80) {
        if (!hasRecentNotification(student.mentor_email, 'student_attendance_drop', student.id, undefined, 7)) {
          try {
            await createNotification(
              student.mentor_email,
              'student_attendance_drop',
              student.id,
              student.name,
              `${student.name}'s 4-week average attendance has dropped to ${Math.round(attRate)}% (below 80% threshold).`,
              { type: 'student_attendance_drop', attendance_rate: Math.round(attRate), threshold: 80 }
            );
          } catch (e) {
            console.error(`[RiskScan] Failed to send attendance drop notification for ${student.name}:`, e);
          }
        }
      }

      // 3. Student Progress Decline Alert (Declining mock scores or low mock scores)
      const mockLogs = studentProgress
        .filter(l => l.mock_score !== undefined)
        .sort((a, b) => new Date(b.logged_at || b.scheduled_date || 0).getTime() - new Date(a.logged_at || a.scheduled_date || 0).getTime());
      
      let progressDeclined = false;
      let declineDetails = '';
      let prevScore: number | undefined;
      let currScore: number | undefined;

      if (mockLogs.length >= 2) {
        currScore = mockLogs[0].mock_score;
        prevScore = mockLogs[1].mock_score;
        if (currScore !== undefined && prevScore !== undefined && currScore < prevScore) {
          progressDeclined = true;
          declineDetails = `Mock interview score declined from ${prevScore} to ${currScore}.`;
        }
      }

      if (!progressDeclined && mockLogs.length > 0) {
        const latest = mockLogs[0];
        if (latest.mock_score !== undefined && latest.mock_score <= 2) {
          progressDeclined = true;
          declineDetails = `Failed latest mock interview with low score of ${latest.mock_score}.`;
        }
      }

      if (progressDeclined) {
        if (!hasRecentNotification(student.mentor_email, 'student_progress_decline', student.id, undefined, 7)) {
          try {
            await createNotification(
              student.mentor_email,
              'student_progress_decline',
              student.id,
              student.name,
              `${student.name}'s progress decline detected: ${declineDetails}`,
              { type: 'student_progress_decline', details: declineDetails, previous_score: prevScore, current_score: currScore }
            );
          } catch (e) {
            console.error(`[RiskScan] Failed to send progress decline notification for ${student.name}:`, e);
          }
        }
      }
    }
  }

  // --- Mentor Evaluation Loop for Manager Notifications ---
  const activeMentors = allUsers.filter(u => u.active && u.role === 'mentor');

  for (const mentor of activeMentors) {
    const mentorStudents = students.filter(s => s.mentor_email === mentor.email);
    const activeMentees = mentorStudents.filter(s => !s.terminated && !s.hired);
    const totalActiveCount = activeMentees.length;

    // Placed or Hired in the current calendar month
    const monthlyPlacementCount = mentorStudents.filter(s => 
      (s.stage === 'placed' || s.stage === 'hired' || s.hired) &&
      isCurrentMonth(s.hired_date)
    ).length;

    for (const managerEmail of managerEmails) {
      if (managerEmail === mentor.email) continue;

      // 1. KPI Achievement (>= 20 placements in current month)
      if (monthlyPlacementCount >= 20) {
        if (!hasRecentNotification(managerEmail, 'mentor_kpi_achieved', undefined, mentor.email, 30)) {
          try {
            await createNotification(
              managerEmail,
              'mentor_kpi_achieved',
              '',
              '',
              `Mentor ${mentor.name} successfully achieved the monthly KPI target with ${monthlyPlacementCount} placements.`,
              {
                type: 'mentor_kpi_achieved',
                mentor_email: mentor.email,
                mentor_name: mentor.name,
                placements: monthlyPlacementCount,
                target: 20,
                month: format(now, 'MMMM yyyy'),
              }
            );
          } catch (e) {
            console.error(`[RiskScan] Failed to send KPI achieved notification for ${mentor.name}:`, e);
          }
        }
      }

      // 2. Significantly Behind Target (< 10 placements after the 15th)
      if (now.getDate() > 15 && monthlyPlacementCount < 10) {
        if (!hasRecentNotification(managerEmail, 'mentor_kpi_behind', undefined, mentor.email, 30)) {
          try {
            await createNotification(
              managerEmail,
              'mentor_kpi_behind',
              '',
              '',
              `Mentor ${mentor.name} is significantly behind monthly KPI target (only ${monthlyPlacementCount} placements after the 15th).`,
              {
                type: 'mentor_kpi_behind',
                mentor_email: mentor.email,
                mentor_name: mentor.name,
                placements: monthlyPlacementCount,
                target: 20,
                month: format(now, 'MMMM yyyy'),
              }
            );
          } catch (e) {
            console.error(`[RiskScan] Failed to send KPI behind notification for ${mentor.name}:`, e);
          }
        }
      }

      // 3. Failed Monthly KPI Target (< 20 placements on the last day of the month)
      const tomorrow = new Date(now);
      tomorrow.setDate(now.getDate() + 1);
      const isLastDay = tomorrow.getDate() === 1;

      if (isLastDay && monthlyPlacementCount < 20) {
        if (!hasRecentNotification(managerEmail, 'mentor_kpi_failed', undefined, mentor.email, 30)) {
          try {
            await createNotification(
              managerEmail,
              'mentor_kpi_failed',
              '',
              '',
              `Mentor ${mentor.name} failed to meet the monthly KPI target with only ${monthlyPlacementCount} placements.`,
              {
                type: 'mentor_kpi_failed',
                mentor_email: mentor.email,
                mentor_name: mentor.name,
                placements: monthlyPlacementCount,
                target: 20,
                month: format(now, 'MMMM yyyy'),
              }
            );
          } catch (e) {
            console.error(`[RiskScan] Failed to send KPI failed notification for ${mentor.name}:`, e);
          }
        }
      }

      // Evaluate student ratio and average attendance if totalActiveCount > 0
      if (totalActiveCount > 0) {
        const atRiskMentees = activeMentees.filter(s => s.risk_status === 'at_risk');
        const atRiskRatio = atRiskMentees.length / totalActiveCount;

        // Calculate Average 4w attendance rate of active students
        let totalAttendanceRate = 0;
        for (const mentee of activeMentees) {
          const menteeAttendance = attendanceByStudent.get(mentee.id) ?? [];
          const attendance14 = menteeAttendance.filter(l => l.date >= cutoff14);
          const present = attendance14.filter(l => l.present || (l.excuse && l.excuse.trim() !== '')).length;
          const attRate = attendance14.length > 0 ? (present / attendance14.length) * 100 : 100;
          totalAttendanceRate += attRate;
        }
        const avgAttendanceRate = totalAttendanceRate / totalActiveCount;

        // 4. Mentor At Risk & Needs Support (high-risk ratio > 0.3)
        if (atRiskRatio > 0.3) {
          const reasons = [`High risk student ratio: ${Math.round(atRiskRatio * 100)}% of students are at risk` ];
          
          if (!hasRecentNotification(managerEmail, 'mentor_at_risk', undefined, mentor.email, 7)) {
            try {
              await createNotification(
                managerEmail,
                'mentor_at_risk',
                '',
                '',
                `Mentor ${mentor.name} is At Risk due to high student risk ratio (${Math.round(atRiskRatio * 100)}%).`,
                {
                  type: 'mentor_at_risk',
                  mentor_email: mentor.email,
                  mentor_name: mentor.name,
                  reasons,
                }
              );
            } catch (e) {
              console.error(`[RiskScan] Failed to send mentor_at_risk notification for ${mentor.name}:`, e);
            }
          }

          if (!hasRecentNotification(managerEmail, 'mentor_needs_support', undefined, mentor.email, 7)) {
            try {
              await createNotification(
                managerEmail,
                'mentor_needs_support',
                '',
                '',
                `Mentor ${mentor.name} needs support: ${Math.round(atRiskRatio * 100)}% of students are at risk.`,
                {
                  type: 'mentor_needs_support',
                  mentor_email: mentor.email,
                  mentor_name: mentor.name,
                  reasons,
                }
              );
            } catch (e) {
              console.error(`[RiskScan] Failed to send mentor_needs_support notification for ${mentor.name}:`, e);
            }
          }
        }

        // 5. Mentor Needs Support due to low attendance engagement (< 75%)
        if (avgAttendanceRate < 75) {
          const reasons = [`Low engagement: Average 4-week student attendance rate is ${Math.round(avgAttendanceRate)}%` ];
          if (!hasRecentNotification(managerEmail, 'mentor_needs_support', undefined, mentor.email, 7)) {
            try {
              await createNotification(
                managerEmail,
                'mentor_needs_support',
                '',
                '',
                `Mentor ${mentor.name} needs support: student attendance average has dropped to ${Math.round(avgAttendanceRate)}%.`,
                {
                  type: 'mentor_needs_support',
                  mentor_email: mentor.email,
                  mentor_name: mentor.name,
                  reasons,
                }
              );
            } catch (e) {
              console.error(`[RiskScan] Failed to send mentor_needs_support attendance notification for ${mentor.name}:`, e);
            }
          }
        }
      }
    }
  }

  return {
    updated,
    newly_at_risk:      newlyAtRisk,
    newly_resolved:     newlyResolved,
    band_updated:       bandUpdated,
    skipped_terminated: skippedTerminated,
  };
}
