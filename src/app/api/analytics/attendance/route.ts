/**
 * WHY this file exists:
 * Provides comprehensive per-student attendance analytics including rate trends,
 * streak detection, and cohort comparison. Raw attendance percentages are insufficient
 * for mentorship — mentors need to identify PATTERNS (e.g., always absent Thursdays,
 * consecutive absence streaks, patterns before stage stalls).
 *
 * The consecutive_absence_streak field specifically helps detect the difference between
 * a student who has 3 scattered absences vs 3 consecutive absences — the latter is far
 * more concerning and predictive of drop-off.
 *
 * The weekly_rates array enables the heatmap visualization and trend detection.
 * A student whose weekly rates are [90%, 89%, 45%, 88%] clearly had a bad week that
 * warrants a conversation, even if their overall average is fine.
 *
 * Comparison to cohort average surfaces relative underperformance — a student at 70%
 * might look bad in isolation but if the cohort average is 65%, they are actually above average.
 */

import { NextResponse } from 'next/server';
import { getUserFromHeaders } from '@/lib/auth/helpers';
import { getAllStudents } from '@/lib/sheets/students';
import { readSheet } from '@/lib/sheets/client';
import type { AttendanceLog } from '@/types';
import { parseISO, isWithinInterval, subDays, format, startOfWeek, differenceInDays } from 'date-fns';

function rowToAttendanceLog(row: string[]): AttendanceLog {
  return {
    id: row[0] || '',
    student_id: row[1] || '',
    date: row[2] || '',
    present: row[3] === 'true',
    logged_by: row[4] || '',
    session_label: row[5] || '',
    excuse: (row[6] || '') as '' | 'exam' | 'sick' | 'personal' | 'other',
    excuse_note: row[7] || '',
  };
}

export async function GET(request: Request) {
  try {
    const user = getUserFromHeaders(request.headers);
    if (!user || !['mentor', 'manager'].includes(user.role)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    const fromStr = searchParams.get('from');
    const toStr = searchParams.get('to');

    if (!studentId) {
      return NextResponse.json({ message: 'studentId query param is required' }, { status: 400 });
    }

    const now = new Date();
    const to = toStr ? parseISO(toStr) : now;
    const from = fromStr ? parseISO(fromStr) : subDays(now, 90);

    const rows = await readSheet('attendance_logs');
    const allLogs = rows
      .map(rowToAttendanceLog)
      .filter(l => l.id && l.student_id === studentId);

    const periodLogs = allLogs.filter(l => {
      try {
        return isWithinInterval(parseISO(l.date), { start: from, end: to });
      } catch { return false; }
    });

    // Attendance rate (excused absences don't count against)
    const totalSessions = periodLogs.length;
    const presentOrExcused = periodLogs.filter(l => l.present || (l.excuse && l.excuse.trim() !== '')).length;
    const attendanceRate = totalSessions > 0
      ? Math.round((presentOrExcused / totalSessions) * 100)
      : null;

    // Consecutive absence streak (unexcused only)
    const unexcusedSorted = [...periodLogs]
      .filter(l => !l.present && (!l.excuse || l.excuse.trim() === ''))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let currentStreak = 0;
    let maxStreak = 0;
    let tempStreak = 0;

    for (let i = 0; i < unexcusedSorted.length; i++) {
      if (i === unexcusedSorted.length - 1) {
        tempStreak++;
        maxStreak = Math.max(maxStreak, tempStreak);
      } else {
        const curr = new Date(unexcusedSorted[i].date);
        const next = new Date(unexcusedSorted[i + 1].date);
        const diff = Math.round((curr.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 1) {
          tempStreak++;
        } else {
          maxStreak = Math.max(maxStreak, tempStreak);
          tempStreak = 1;
        }
      }
    }

    const lastAbsence = unexcusedSorted[0];
    if (lastAbsence) {
      const currAbs = new Date(lastAbsence.date);
      for (let i = 0; i < unexcusedSorted.length - 1; i++) {
        const curr = new Date(unexcusedSorted[i].date);
        const next = new Date(unexcusedSorted[i + 1].date);
        const diff = Math.round((curr.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 1) currentStreak++;
        else break;
      }
      currentStreak++;
      const daysSinceLast = differenceInDays(now, currAbs);
      if (daysSinceLast <= 1) {
        // Still potentially in a streak
      } else {
        currentStreak = 0;
      }
    }

    // Weekly rates
    const weekStarts: Map<string, { total: number; present: number }> = new Map();
    for (const log of periodLogs) {
      try {
        const ws = startOfWeek(parseISO(log.date), { weekStartsOn: 1 });
        const key = format(ws, 'yyyy-MM-dd');
        const existing = weekStarts.get(key) ?? { total: 0, present: 0 };
        existing.total++;
        if (log.present || (log.excuse && log.excuse.trim() !== '')) existing.present++;
        weekStarts.set(key, existing);
      } catch { /* skip */ }
    }

    const weeklyRates = Array.from(weekStarts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, data]) => ({
        week,
        rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
        total_sessions: data.total,
        present_sessions: data.present,
      }));

    // Per-session-label breakdown
    const sessionBreakdown: Record<string, { total: number; present: number; absent: number }> = {};
    for (const log of periodLogs) {
      const label = log.session_label || 'General';
      if (!sessionBreakdown[label]) sessionBreakdown[label] = { total: 0, present: 0, absent: 0 };
      sessionBreakdown[label].total++;
      if (log.present || (log.excuse && log.excuse.trim() !== '')) {
        sessionBreakdown[label].present++;
      } else {
        sessionBreakdown[label].absent++;
      }
    }

    // Cohort comparison (other mentees of same mentor)
    const student = (await getAllStudents()).find(s => s.id === studentId);
    let cohortRate: number | null = null;
    if (student && student.mentor_email) {
      const allStudents = await getAllStudents();
      const menteeIds = new Set(
        allStudents.filter(s => s.mentor_email === student.mentor_email && s.id !== studentId).map(s => s.id)
      );
      if (menteeIds.size > 0) {
        const menteeLogs = rows
          .map(rowToAttendanceLog)
          .filter(l => l.id && menteeIds.has(l.student_id));

        const menteePeriodLogs = menteeLogs.filter(l => {
          try { return isWithinInterval(parseISO(l.date), { start: from, end: to }); }
          catch { return false; }
        });

        const totalMenteeSessions = menteePeriodLogs.length;
        const presentMentee = menteePeriodLogs.filter(l => l.present || (l.excuse && l.excuse.trim() !== '')).length;
        cohortRate = totalMenteeSessions > 0
          ? Math.round((presentMentee / totalMenteeSessions) * 100)
          : null;
      }
    }

    const excusedCount = periodLogs.filter(l => !l.present && l.excuse && l.excuse.trim() !== '').length;
    const unexcusedCount = periodLogs.filter(l => !l.present && (!l.excuse || l.excuse.trim() === '')).length;

    return NextResponse.json({
      student_id: studentId,
      from: format(from, 'yyyy-MM-dd'),
      to: format(to, 'yyyy-MM-dd'),
      attendance_rate: attendanceRate,
      consecutive_absence_streak: currentStreak,
      longest_absence_streak: maxStreak,
      weekly_rates: weeklyRates,
      session_breakdown: sessionBreakdown,
      comparison_to_cohort: cohortRate,
      total_sessions: totalSessions,
      present_sessions: presentOrExcused,
      excused_absences: excusedCount,
      unexcused_absences: unexcusedCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}