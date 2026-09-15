/**
 * GET /api/analytics/mentor-performance/trends
 *
 * Returns monthly performance trends for all mentors over the last N months.
 *
 * Query params:
 *   months  number of months to look back (default: 6, max: 12)
 *
 * For each month, computes per-mentor:
 *   - student_count, active, placed, hired, at_risk
 *   - interviews, tasks, offers, jobs_applied
 *   - avg_attendance_rate
 *   - pipeline_growth (net new students that month)
 */

import { NextResponse } from 'next/server';
import { getAllStudents } from '@/lib/sheets/students';
import { getAllProgressLogs } from '@/lib/sheets/progress-logs';
import { getAllUsers } from '@/lib/sheets/users';
import { readSheet } from '@/lib/sheets/client';
import { requireRole } from '@/lib/auth/helpers';
import type { ApiError } from '@/lib/auth/helpers';
import type { AttendanceLog, ProgressLog } from '@/types';
import { subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval, format } from 'date-fns';

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

interface MonthData {
  month: string;
  monthLabel: string;
  student_count: number;
  active: number;
  placed: number;
  hired: number;
  at_risk: number;
  terminated: number;
  interviews: number;
  tasks: number;
  offers: number;
  jobs_applied: number;
  avg_attendance_rate: number;
  pipeline_growth: number;
}

interface MentorTrend {
  mentor_email: string;
  mentor_name: string;
  months: MonthData[];
  current_placement_rate: number;
  placement_trend: 'up' | 'down' | 'stable';
  total_students_now: number;
  total_hired_all_time: number;
}

export async function GET(request: Request) {
  try {
    requireRole(request.headers, ['manager']);
    const { searchParams } = new URL(request.url);
    const monthsBack = Math.min(
      Math.max(parseInt(searchParams.get('months') ?? '6', 10), 1),
      12
    );

    const [allStudents, allProgressLogs, attendanceRows, allUsers] = await Promise.all([
      getAllStudents(),
      getAllProgressLogs(),
      readSheet('attendance_logs'),
      getAllUsers(),
    ]);

    const mentorNameMap = new Map<string, string>();
    // Only include active, real mentor accounts (excludes test/demo accounts like mentor1, mentor2, etc.)
    const activeMentorEmails = new Set<string>();
    const testAccountPattern = /^mentor\d+(@|$)/i;
    for (const u of allUsers) {
      if (u.role === 'mentor' && u.active && !testAccountPattern.test(u.name.trim()) && !testAccountPattern.test(u.email)) {
        mentorNameMap.set(u.email, u.name);
        activeMentorEmails.add(u.email);
      }
    }

    const allAttendance: AttendanceLog[] = attendanceRows
      .map(rowToAttendanceLog)
      .filter(l => l.id);

    // Group students by mentor — only for active, registered mentors
    const studentsByMentor = new Map<string, typeof allStudents>();
    for (const s of allStudents) {
      if (!activeMentorEmails.has(s.mentor_email)) continue;
      const arr = studentsByMentor.get(s.mentor_email) ?? [];
      arr.push(s);
      studentsByMentor.set(s.mentor_email, arr);
    }

    // Generate month ranges
    const now = new Date();
    const monthRanges: { label: string; start: Date; end: Date }[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = subMonths(now, i);
      monthRanges.push({
        label: format(d, 'MMM yyyy'),
        start: startOfMonth(d),
        end: endOfMonth(d),
      });
    }

    // Index progress logs by student
    const logsByStudent = new Map<string, ProgressLog[]>();
    for (const log of allProgressLogs) {
      const arr = logsByStudent.get(log.student_id) ?? [];
      arr.push(log);
      logsByStudent.set(log.student_id, arr);
    }

    // Index attendance by student
    const attendanceByStudent = new Map<string, AttendanceLog[]>();
    for (const log of allAttendance) {
      const arr = attendanceByStudent.get(log.student_id) ?? [];
      arr.push(log);
      attendanceByStudent.set(log.student_id, arr);
    }

    const results: MentorTrend[] = [];

    for (const [email, students] of Array.from(studentsByMentor.entries())) {
      const mentorName = mentorNameMap.get(email) || email.split('@')[0];
      const studentIds = new Set(students.map((s: import('@/types').Student) => s.id));

      const months: MonthData[] = monthRanges.map(({ label, start, end }) => {
        // Students active during this month (created before end of month, not terminated before start)
        const studentsInMonth = students.filter((s: import('@/types').Student) => {
          try {
            const created = s.created_at ? parseISO(s.created_at.substring(0, 10)) : new Date(0);
            return created <= end;
          } catch { return false; }
        });

        const placedInMonth = studentsInMonth.filter((s: import('@/types').Student) => s.stage === 'placed' || s.hired).length;
        const hiredInMonth = studentsInMonth.filter((s: import('@/types').Student) => s.hired).length;
        const activeInMonth = studentsInMonth.filter((s: import('@/types').Student) => !s.terminated && !s.hired).length;
        const atRiskInMonth = studentsInMonth.filter((s: import('@/types').Student) => s.risk_status === 'at_risk' && !s.terminated).length;
        const terminatedInMonth = studentsInMonth.filter((s: import('@/types').Student) => s.terminated).length;

        // Activity during this month
        const monthLogs = allProgressLogs.filter(l => {
          if (!studentIds.has(l.student_id) || !l.scheduled_date) return false;
          try {
            return isWithinInterval(parseISO(l.scheduled_date.substring(0, 10)), { start, end });
          } catch { return false; }
        });

        const interviews = monthLogs.filter(l => l.log_type === 'Interview Call').length;
        const tasks = monthLogs.filter(l => l.log_type === 'Job Task').length;
        const offers = monthLogs.filter(l => l.log_type === 'Offer').length;
        const jobsApplied = monthLogs.filter(l => l.log_type === 'Job Applied').length;

        // Attendance during this month
        let totalAtt = 0;
        let studentsWithAtt = 0;
        for (const s of studentsInMonth) {
          const attLogs = (attendanceByStudent.get(s.id) ?? []).filter(l => {
            try {
              return isWithinInterval(parseISO(l.date.substring(0, 10)), { start, end });
            } catch { return false; }
          });
          if (attLogs.length > 0) {
            totalAtt += (attLogs.filter(l => l.present).length / attLogs.length) * 100;
            studentsWithAtt++;
          }
        }
        const avgAttendance = studentsWithAtt > 0 ? Math.round(totalAtt / studentsWithAtt) : 0;

        // Pipeline growth: net new students created this month
        const newStudents = studentsInMonth.filter((s: import('@/types').Student) => {
          try {
            const created = s.created_at ? parseISO(s.created_at.substring(0, 10)) : new Date(0);
            return isWithinInterval(created, { start, end });
          } catch { return false; }
        }).length;

        return {
          month: label,
          monthLabel: label,
          student_count: studentsInMonth.length,
          active: activeInMonth,
          placed: placedInMonth,
          hired: hiredInMonth,
          at_risk: atRiskInMonth,
          terminated: terminatedInMonth,
          interviews,
          tasks,
          offers,
          jobs_applied: jobsApplied,
          avg_attendance_rate: avgAttendance,
          pipeline_growth: newStudents,
        };
      });

      // Current placement rate
      const totalStudents = students.length;
      const totalHired = students.filter((s: import('@/types').Student) => s.hired).length;
      const currentPlacementRate = totalStudents > 0 ? Math.round((totalHired / totalStudents) * 100) : 0;

      // Placement trend: compare last 2 months
      const lastMonth = months[months.length - 1];
      const prevMonth = months.length > 1 ? months[months.length - 2] : null;
      let placementTrend: 'up' | 'down' | 'stable' = 'stable';
      if (prevMonth) {
        const lastRate = lastMonth.student_count > 0 ? lastMonth.hired / lastMonth.student_count : 0;
        const prevRate = prevMonth.student_count > 0 ? prevMonth.hired / prevMonth.student_count : 0;
        if (lastRate > prevRate + 0.05) placementTrend = 'up';
        else if (lastRate < prevRate - 0.05) placementTrend = 'down';
      }

      results.push({
        mentor_email: email,
        mentor_name: mentorName,
        months,
        current_placement_rate: currentPlacementRate,
        placement_trend: placementTrend,
        total_students_now: totalStudents,
        total_hired_all_time: totalHired,
      });
    }

    // Sort by current placement rate
    results.sort((a, b) => b.current_placement_rate - a.current_placement_rate);

    return NextResponse.json({
      data: results,
      meta: { months_back: monthsBack, mentor_count: results.length },
    });
  } catch (e) {
    const status = isApiError(e) ? e.status : 500;
    const message = isApiError(e) ? e.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}
