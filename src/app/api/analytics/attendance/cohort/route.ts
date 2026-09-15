import { NextResponse } from 'next/server';
import { getUserFromHeaders } from '@/lib/auth/helpers';
import { getAllStudents } from '@/lib/sheets/students';
import { readSheet } from '@/lib/sheets/client';
import type { AttendanceLog } from '@/types';
import { parseISO, isWithinInterval, subDays } from 'date-fns';

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
    const mentorEmail = searchParams.get('mentorEmail') ?? user.email;
    const days = parseInt(searchParams.get('days') ?? '28', 10);

    const from = subDays(new Date(), days);
    const rows = await readSheet('attendance_logs');
    const allLogs = rows.map(rowToAttendanceLog).filter(l => l.id);

    const allStudents = await getAllStudents();
    const menteeIds = new Set(
      allStudents
        .filter(s => s.mentor_email === mentorEmail && !s.terminated)
        .map(s => s.id)
    );

    const menteeLogs = allLogs.filter(l => menteeIds.has(l.student_id));
    const periodLogs = menteeLogs.filter(l => {
      try { return isWithinInterval(parseISO(l.date), { start: from, end: new Date() }); }
      catch { return false; }
    });

    const studentIds = Array.from(menteeIds);
    const perStudent = studentIds.map(sid => {
      const studentLogs = periodLogs.filter(l => l.student_id === sid);
      const total = studentLogs.length;
      const present = studentLogs.filter(l => l.present || (l.excuse && l.excuse.trim() !== '')).length;
      return {
        student_id: sid,
        attendance_rate: total > 0 ? Math.round((present / total) * 100) : null,
        total_sessions: total,
        present_sessions: present,
      };
    });

    const validRates = perStudent.filter(s => s.attendance_rate !== null);
    const cohortAverage = validRates.length > 0
      ? Math.round(validRates.reduce((sum, s) => sum + (s.attendance_rate ?? 0), 0) / validRates.length)
      : null;

    return NextResponse.json({
      mentor_email: mentorEmail,
      period_days: days,
      cohort_average: cohortAverage,
      students: perStudent.sort((a, b) => (b.attendance_rate ?? 0) - (a.attendance_rate ?? 0)),
      total_students: perStudent.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}