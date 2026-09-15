/**
 * Weekly report data aggregation.
 *
 * Kept separate from the route handler so the logic is independently
 * testable and can be called from multiple places (weekly cron, on-demand API).
 *
 * Performance note: Google Sheets has no query layer, so we read each sheet
 * once and partition in memory — never per-student.
 */

import { getAllStudents } from '@/lib/sheets/students';
import { getAllProgressLogs } from '@/lib/sheets/progress-logs';
import { readSheet } from '@/lib/sheets/client';
import type { Student, AttendanceLog, ProgressLog } from '@/types';
import { subDays, format, startOfDay, parseISO, isWithinInterval } from 'date-fns';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StudentWeeklySummary {
  id: string;
  name: string;
  batch: string;
  stage: Student['stage'];
  risk_status: Student['risk_status'];
  risk_reasons: string;
  absences_this_week: number;
  sessions_this_week: number;
  attendance_rate_pct: number | null;
  interviews_this_week: number;
  mock_interviews_this_week: number;
  jobs_applied_this_week: number;
  tasks_this_week: number;
  offers_this_week: number;
}

export interface MentorWeeklyReport {
  mentor_email: string;
  week_start: string; // YYYY-MM-DD
  week_end: string;   // YYYY-MM-DD
  students: StudentWeeklySummary[];
  totals: {
    students: number;
    active: number;
    at_risk: number;
    terminated: number;
    hired: number;
    total_absences: number;
    total_interviews: number;
    total_mock_interviews: number;
    total_jobs_applied: number;
    total_tasks: number;
    total_offers: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * Returns the ISO date string for N days ago at midnight UTC.
 */
function nDaysAgo(n: number): string {
  return format(subDays(startOfDay(new Date()), n), 'yyyy-MM-dd');
}

function isInWeek(dateStr: string, weekStart: string, weekEnd: string): boolean {
  if (!dateStr) return false;
  try {
    const d = parseISO(dateStr.substring(0, 10)); // handle ISO timestamps too
    return isWithinInterval(d, {
      start: parseISO(weekStart),
      end: parseISO(weekEnd),
    });
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Core aggregation
// ---------------------------------------------------------------------------

/**
 * Builds per-mentor weekly reports.
 *
 * Reads students, attendance_logs, and progress_logs exactly once each,
 * then partitions everything in memory.
 */
export async function buildWeeklyReports(): Promise<{
  reports: MentorWeeklyReport[];
  week_start: string;
  week_end: string;
}> {
  const weekEnd = format(new Date(), 'yyyy-MM-dd');
  const weekStart = nDaysAgo(6); // last 7 days inclusive

  // --- Single read of each sheet ---
  const [allStudents, allProgressLogs, attendanceRows] = await Promise.all([
    getAllStudents(),
    getAllProgressLogs(),
    readSheet('attendance_logs'),
  ]);

  const allAttendanceLogs: AttendanceLog[] = attendanceRows
    .map(rowToAttendanceLog)
    .filter(l => l.id); // skip empty rows

  // --- Partition attendance by student_id ---
  const attendanceByStudent = new Map<string, AttendanceLog[]>();
  for (const log of allAttendanceLogs) {
    const existing = attendanceByStudent.get(log.student_id) ?? [];
    existing.push(log);
    attendanceByStudent.set(log.student_id, existing);
  }

  // --- Partition progress logs by student_id ---
  const progressByStudent = new Map<string, ProgressLog[]>();
  for (const log of allProgressLogs) {
    const existing = progressByStudent.get(log.student_id) ?? [];
    existing.push(log);
    progressByStudent.set(log.student_id, existing);
  }

  // --- Group students by mentor ---
  const studentsByMentor = new Map<string, Student[]>();
  for (const student of allStudents) {
    const existing = studentsByMentor.get(student.mentor_email) ?? [];
    existing.push(student);
    studentsByMentor.set(student.mentor_email, existing);
  }

  // --- Build one report per mentor ---
  const reports: MentorWeeklyReport[] = [];

  for (const [mentorEmail, students] of Array.from(studentsByMentor.entries())) {
    const summaries: StudentWeeklySummary[] = [];

    for (const student of students) {
      const attendanceLogs = attendanceByStudent.get(student.id) ?? [];
      const progressLogs = progressByStudent.get(student.id) ?? [];

      // Attendance this week
      const weekAttendance = attendanceLogs.filter(l =>
        isInWeek(l.date, weekStart, weekEnd)
      );
      const sessionsThisWeek = weekAttendance.length;
      const absencesThisWeek = weekAttendance.filter(l => !l.present && !l.excuse).length;
      const presentThisWeek = sessionsThisWeek - absencesThisWeek;
      const attendanceRatePct =
        sessionsThisWeek > 0
          ? Math.round((presentThisWeek / sessionsThisWeek) * 100)
          : null;

      // Progress logs this week
      const weekProgress = progressLogs.filter(l =>
        isInWeek(l.scheduled_date, weekStart, weekEnd)
      );
      const interviewsThisWeek = weekProgress.filter(l => l.log_type === 'Interview Call').length;
      const mockInterviewsThisWeek = weekProgress.filter(l => l.log_type === 'Mock Interview').length;
      const jobsAppliedThisWeek = weekProgress.filter(l => l.log_type === 'Job Applied').length;
      const tasksThisWeek = weekProgress.filter(l => l.log_type === 'Job Task').length;
      const offersThisWeek = weekProgress.filter(l => l.log_type === 'Offer').length;

      summaries.push({
        id: student.id,
        name: student.name,
        batch: student.batch,
        stage: student.stage,
        risk_status: student.risk_status,
        risk_reasons: student.risk_reasons,
        absences_this_week: absencesThisWeek,
        sessions_this_week: sessionsThisWeek,
        attendance_rate_pct: attendanceRatePct,
        interviews_this_week: interviewsThisWeek,
        mock_interviews_this_week: mockInterviewsThisWeek,
        jobs_applied_this_week: jobsAppliedThisWeek,
        tasks_this_week: tasksThisWeek,
        offers_this_week: offersThisWeek,
      });
    }

    // Mentor-level totals
    const totals = {
      students: students.length,
      active: students.filter(s => !s.terminated && !s.hired).length,
      at_risk: students.filter(s => s.risk_status === 'at_risk' && !s.terminated).length,
      terminated: students.filter(s => s.terminated).length,
      hired: students.filter(s => s.hired).length,
      total_absences: summaries.reduce((n, s) => n + s.absences_this_week, 0),
      total_interviews: summaries.reduce((n, s) => n + s.interviews_this_week, 0),
      total_mock_interviews: summaries.reduce((n, s) => n + s.mock_interviews_this_week, 0),
      total_jobs_applied: summaries.reduce((n, s) => n + s.jobs_applied_this_week, 0),
      total_tasks: summaries.reduce((n, s) => n + s.tasks_this_week, 0),
      total_offers: summaries.reduce((n, s) => n + s.offers_this_week, 0),
    };

    reports.push({ mentor_email: mentorEmail, week_start: weekStart, week_end: weekEnd, students: summaries, totals });
  }

  return { reports, week_start: weekStart, week_end: weekEnd };
}
