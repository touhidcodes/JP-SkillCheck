/**
 * WHY this file exists:
 * Provides mentor self-analytics so each mentor can see their own activity metrics
 * (tasks completed, students touched, logs created per week) without needing
 * manager-level access to aggregate data across all mentors.
 *
 * This endpoint is scoped to the logged-in mentor's own events only.
 */

import { NextResponse } from 'next/server';
import { getUserFromHeaders } from '@/lib/auth/helpers';
import { getEventsByMentor } from '@/lib/sheets/analytics-events';
import { getTasksByMentor } from '@/lib/sheets/mentor-tasks';
import { getStudentsByMentor } from '@/lib/sheets/students';
import { getAllProgressLogs } from '@/lib/sheets/progress-logs';
import { startOfMonth, startOfWeek } from 'date-fns';

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const user = getUserFromHeaders(request.headers);
    if (!user || user.role !== 'mentor') {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get('period') ?? 'week') as 'week' | 'month';

    const now = new Date();
    const start = period === 'month'
      ? startOfMonth(now).toISOString()
      : startOfWeek(now, { weekStartsOn: 1 }).toISOString();

    const [events, tasks, students, allLogs] = await Promise.all([
      getEventsByMentor(user.email, { limit: 500 }),
      getTasksByMentor(user.email),
      getStudentsByMentor(user.email),
      getAllProgressLogs(),
    ]);

    const periodEvents = events.filter(e => e.created_at >= start);

    const tasksCompleted = tasks.filter(t => t.completed && t.completed_at && t.completed_at >= start);
    const tasksCreated = periodEvents.filter(e => e.event_type === 'task_created').length;

    const myStudentIds = new Set(students.map(s => s.id));
    const logsThisPeriod = allLogs.filter(l => myStudentIds.has(l.student_id) && l.logged_at >= start);

    const eventBreakdown = {
      task_created: periodEvents.filter(e => e.event_type === 'task_created').length,
      task_completed: periodEvents.filter(e => e.event_type === 'task_completed').length,
      progress_log_created: periodEvents.filter(e => e.event_type === 'progress_log_created').length,
      attendance_logged: periodEvents.filter(e => e.event_type === 'attendance_logged').length,
      stage_updated: periodEvents.filter(e => e.event_type === 'stage_updated').length,
      warning_acknowledged: periodEvents.filter(e => e.event_type === 'warning_acknowledged').length,
    };

    return NextResponse.json({
      period,
      totalStudents: students.length,
      tasksCompleted: tasksCompleted.length,
      tasksCreated,
      logsThisPeriod: logsThisPeriod.length,
      eventBreakdown,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}