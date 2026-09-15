/**
 * GET /api/leaderboard
 *
 * Returns ranked lists for students or mentors.
 *
 * Query params:
 *   type    'students' | 'mentors'   (default: 'students')
 *   period  'weekly' | 'monthly' | 'all'  (default: 'weekly')
 *
 * Reads all sheets once and computes everything in memory.
 * Each student entry includes an activity_tier from the rubric.
 */

import { NextResponse } from 'next/server';
import { getAllStudents } from '@/lib/sheets/students';
import { getAllProgressLogs } from '@/lib/sheets/progress-logs';
import { getAllUsers } from '@/lib/sheets/users';
import { readSheet } from '@/lib/sheets/client';
import { requireRole } from '@/lib/auth/helpers';
import type { ApiError } from '@/lib/auth/helpers';
import type { AttendanceLog, ProgressLog } from '@/types';
import { subDays, parseISO, isWithinInterval } from 'date-fns';
import { computeActivityTier } from '@/lib/analytics/rubric';

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'status' in e;
}

function rowToAttendanceLog(row: string[]): AttendanceLog {
  return {
    id: row[0] || '',
    student_id: row[1] || '',
    date: row[2] || '',
    present: row[3] === 'true',
    logged_by: row[4] || '',
    session_label: row[5] || '',
    excuse: (row[6] || '') as import('@/types').AbsenceExcuse | '',
    excuse_note: row[7] || '',
  };
}

function getPeriodStart(period: string): Date | null {
  if (period === 'weekly') return subDays(new Date(), 7);
  if (period === 'monthly') return subDays(new Date(), 30);
  return null;
}

function inPeriod(dateStr: string, start: Date | null): boolean {
  if (!start || !dateStr) return true;
  try {
    return isWithinInterval(parseISO(dateStr.substring(0, 10)), {
      start,
      end: new Date(),
    });
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  try {
    const user = requireRole(request.headers, ['manager', 'mentor']);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') === 'mentors' ? 'mentors' : 'students';
    const period = (['weekly', 'monthly', 'all'].includes(searchParams.get('period') ?? ''))
      ? (searchParams.get('period') as 'weekly' | 'monthly' | 'all')
      : 'weekly';

    const periodStart = getPeriodStart(period);
    const weeklyStart = subDays(new Date(), 7); // rubric always uses last 7 days for activity
    const periodLabel = period === 'weekly' ? 'Last 7 days'
      : period === 'monthly' ? 'Last 30 days' : 'All time';

    const [allStudents, allProgressLogs, attendanceRows] = await Promise.all([
      getAllStudents(),
      getAllProgressLogs(),
      readSheet('attendance_logs'),
    ]);

    // Scope students to the logged-in mentor (managers see all)
    const scopedStudents = user.role === 'mentor'
      ? allStudents.filter(s => s.mentor_email === user.email)
      : allStudents;

    const allAttendance: AttendanceLog[] = attendanceRows
      .map(rowToAttendanceLog)
      .filter(l => l.id);

    // ── Students leaderboard ──────────────────────────────────────────────
    if (type === 'students') {
      const progressByStudent = new Map<string, ProgressLog[]>();
      for (const log of allProgressLogs) {
        const arr = progressByStudent.get(log.student_id) ?? [];
        arr.push(log);
        progressByStudent.set(log.student_id, arr);
      }

      const attendanceByStudent = new Map<string, AttendanceLog[]>();
      for (const log of allAttendance) {
        const arr = attendanceByStudent.get(log.student_id) ?? [];
        arr.push(log);
        attendanceByStudent.set(log.student_id, arr);
      }

      const ranked = scopedStudents
        .filter(s => !s.terminated)
        .map(student => {
          const progressLogs = (progressByStudent.get(student.id) ?? [])
            .filter(l => inPeriod(l.scheduled_date, periodStart));
          const attendanceLogs = attendanceByStudent.get(student.id) ?? [];
          const periodAttendance = attendanceLogs.filter(l => inPeriod(l.date, periodStart));

          const interviews = progressLogs.filter(l => l.log_type === 'Interview Call').length;
          const tasks = progressLogs.filter(l => l.log_type === 'Job Task').length;
          const offers = progressLogs.filter(l => l.log_type === 'Offer').length;
          const jobsApplied = progressLogs.filter(l => l.log_type === 'Job Applied').length;

          const totalSessions = periodAttendance.length;
          const presentSessions = periodAttendance.filter(l => l.present).length;
          const attendanceRate = totalSessions > 0
            ? Math.round((presentSessions / totalSessions) * 100)
            : null;

          // Weekly activity for rubric (always last 7 days regardless of period)
          const weeklyLogs = (progressByStudent.get(student.id) ?? [])
            .filter(l => inPeriod(l.scheduled_date, weeklyStart));
          const weeklyActivityCount =
            weeklyLogs.filter(l =>
              l.log_type === 'Interview Call' ||
              l.log_type === 'Job Task' ||
              l.log_type === 'Job Applied' ||
              l.log_type === 'Mock Interview'
            ).length;

          // Compute rubric tier
          const rubric = computeActivityTier({
            attendance_rate_pct: attendanceRate,
            weekly_activity_count: weeklyActivityCount,
            is_at_risk: student.risk_status === 'at_risk',
            is_terminated: student.terminated,
          });

          // Score: interviews×3 + tasks×2 + offers×5 + jobs_applied×1 + attendance_rate/10
          const score = interviews * 3 + tasks * 2 + offers * 5 + jobsApplied +
            (attendanceRate !== null ? attendanceRate / 10 : 0);

          return {
            id: student.id,
            name: student.name,
            batch: student.batch,
            project: student.project || '',
            stage: student.stage,
            risk_status: student.risk_status,
            hired: student.hired,
            interviews,
            tasks,
            offers,
            jobs_applied: jobsApplied,
            attendance_rate: attendanceRate,
            activity_tier: rubric.tier,
            activity_description: rubric.description,
            score: Math.round(score * 10) / 10,
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
        .map((s, i) => ({ ...s, rank: i + 1 }));

      return NextResponse.json({ data: ranked, type, period, period_label: periodLabel, total: ranked.length });
    }

    // ── Mentors leaderboard ───────────────────────────────────────────────
    const allUsers = await getAllUsers();
    const mentorNameMap = new Map<string, string>();
    // Only include active, real mentor accounts (excludes test/demo accounts like mentor1, mentor2, etc.)
    const activeMentorEmails = new Set<string>();
    const testAccountPattern = /^mentor\d+$/i;
    for (const u of allUsers) {
      if (u.role === 'mentor' && u.active && !testAccountPattern.test(u.name.trim())) {
        mentorNameMap.set(u.email, u.name);
        activeMentorEmails.add(u.email);
      }
    }

    const mentorMap = new Map<string, typeof scopedStudents>();
    for (const s of scopedStudents) {
      // Only build leaderboard entries for active, registered mentors
      if (!activeMentorEmails.has(s.mentor_email)) continue;
      const arr = mentorMap.get(s.mentor_email) ?? [];
      arr.push(s);
      mentorMap.set(s.mentor_email, arr);
    }

    const mentorRanked = Array.from(mentorMap.entries()).map(([email, students]) => {
      const active = students.filter(s => !s.terminated && !s.hired).length;
      const hired = students.filter(s => s.hired).length;
      const atRisk = students.filter(s => s.risk_status === 'at_risk' && !s.terminated).length;
      const terminated = students.filter(s => s.terminated).length;
      const placementRate = students.length > 0
        ? Math.round((hired / students.length) * 100)
        : 0;

      const mentorStudentIds = new Set(students.map(s => s.id));
      const mentorProgressLogs = allProgressLogs.filter(l => mentorStudentIds.has(l.student_id));
      const periodProgressLogs = mentorProgressLogs.filter(l => inPeriod(l.scheduled_date, periodStart));

      const mentorInterviews = periodProgressLogs.filter(l => l.log_type === 'Interview Call').length;
      const mentorTasks = periodProgressLogs.filter(l => l.log_type === 'Job Task').length;
      const mentorOffers = periodProgressLogs.filter(l => l.log_type === 'Offer').length;
      const mentorJobsApplied = periodProgressLogs.filter(l => l.log_type === 'Job Applied').length;

      // Calculate average attendance rate for mentor's students
      const attendanceByStudent = new Map<string, AttendanceLog[]>();
      for (const log of allAttendance) {
        if (!mentorStudentIds.has(log.student_id)) continue;
        const arr = attendanceByStudent.get(log.student_id) ?? [];
        arr.push(log);
        attendanceByStudent.set(log.student_id, arr);
      }

      let totalAttendanceRate = 0;
      let studentsWithAttendance = 0;
      for (const student of students) {
        const attLogs = attendanceByStudent.get(student.id) ?? [];
        const periodAtt = attLogs.filter(l => inPeriod(l.date, periodStart));
        if (periodAtt.length > 0) {
          const presentCount = periodAtt.filter(l => l.present).length;
          totalAttendanceRate += (presentCount / periodAtt.length) * 100;
          studentsWithAttendance++;
        }
      }
      const avgAttendanceRate = studentsWithAttendance > 0
        ? Math.round(totalAttendanceRate / studentsWithAttendance)
        : 0;

      // Count students per rubric tier for mentor analytics
      const tierCounts = { Excellent: 0, Good: 0, Moderate: 0, Inactive: 0, Critical: 0 };
      for (const student of students) {
        const attLogs = attendanceByStudent.get(student.id) ?? [];
        const weeklyAtt = attLogs.filter(l => inPeriod(l.date, weeklyStart));
        const totalSess = weeklyAtt.length;
        const presentSess = weeklyAtt.filter(l => l.present).length;
        const attRate = totalSess > 0 ? Math.round((presentSess / totalSess) * 100) : null;

        const weeklyActivity = allProgressLogs.filter(
          l => mentorStudentIds.has(l.student_id) &&
            l.student_id === student.id &&
            inPeriod(l.scheduled_date, weeklyStart) &&
            ['Interview Call', 'Job Task', 'Job Applied', 'Mock Interview'].includes(l.log_type)
        ).length;

        const rubric = computeActivityTier({
          attendance_rate_pct: attRate,
          weekly_activity_count: weeklyActivity,
          is_at_risk: student.risk_status === 'at_risk',
          is_terminated: student.terminated,
        });
        tierCounts[rubric.tier]++;
      }

      // Stage distribution for pipeline visibility
      const stageCounts = {
        learning: students.filter(s => s.stage === 'learning').length,
        applying: students.filter(s => s.stage === 'applying').length,
        interviewing: students.filter(s => s.stage === 'interviewing').length,
        offer_pending: students.filter(s => s.stage === 'offer_pending').length,
        placed: students.filter(s => s.stage === 'placed').length,
        hired: students.filter(s => s.stage === 'hired').length,
      };

      const mentorName = mentorNameMap.get(email) || email.split('@')[0];

      // Determine if mentor needs support (high at-risk ratio or low placement)
      const atRiskRatio = students.length > 0 ? atRisk / students.length : 0;
      const needsSupport = atRiskRatio > 0.3 || (placementRate < 10 && active > 3);

      /**
       * Mentor ranking score — weighted by student outcomes:
       *
       *  Jobs Applied    ×  2   (drives pipeline activity)
       *  Interviews      ×  4   (shows conversion from applications)
       *  Offers          ×  8   (high-value outcome)
       *  Hired           × 12   (ultimate success metric)
       *  Placement Rate  ×  0.5 (% bonus, normalised across cohort sizes)
       *  At-Risk penalty ×  5   (deducted per at-risk student)
       *
       * All metrics are scoped to the selected period so the ranking
       * reflects recent performance, not just historical totals.
       */
      const score =
        mentorJobsApplied * 2 +
        mentorInterviews  * 4 +
        mentorOffers      * 8 +
        hired             * 12 +
        placementRate     * 0.5 -
        atRisk            * 5;

      return {
        mentor_email: email,
        mentor_name: mentorName,
        total_students: students.length,
        active,
        hired,
        at_risk: atRisk,
        terminated,
        placement_rate: placementRate,
        interviews_this_period: mentorInterviews,
        tasks_this_period: mentorTasks,
        offers_this_period: mentorOffers,
        jobs_applied_this_period: mentorJobsApplied,
        avg_attendance_rate: avgAttendanceRate,
        tier_counts: tierCounts,
        stage_distribution: stageCounts,
        needs_support: needsSupport,
        score: Math.round(score * 10) / 10,
      };
    })
      .sort((a, b) => b.score - a.score)
      .map((m, i) => ({ ...m, rank: i + 1 }));

    return NextResponse.json({ data: mentorRanked, type, period, period_label: periodLabel, total: mentorRanked.length });
  } catch (e) {
    const status = isApiError(e) ? e.status : 500;
    const message = isApiError(e) ? e.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}
