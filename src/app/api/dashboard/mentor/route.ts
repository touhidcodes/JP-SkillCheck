import { NextResponse } from 'next/server';
import { getStudentsByMentor } from '@/lib/sheets/students';
import { getAllProgressLogs } from '@/lib/sheets/progress-logs';
import { requireRole } from '@/lib/auth/helpers';
import type { ApiError } from '@/lib/auth/helpers';
import { getTasksByMentor } from '@/lib/sheets/mentor-tasks';
import type { Student } from '@/types';
import { differenceInDays } from 'date-fns';
import { subDays, startOfDay, format } from 'date-fns';

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'status' in e;
}

export const revalidate = 0;

function isAtRisk(student: { risk_status: string; last_activity_date: string; terminated: boolean; hired: boolean }): boolean {
  if (student.terminated || student.hired) return false;
  if (student.risk_status === 'at_risk') return true;
  if (!student.last_activity_date) return false;
  try {
    return differenceInDays(new Date(), new Date(student.last_activity_date)) >= 7;
  } catch {
    return false;
  }
}

/**
 * Computes today's action items for a mentor based on:
 * - At-risk students needing immediate follow-up
 * - Tasks due today or overdue
 * - Students with activity stalls (5+ days since last update)
 * - Upcoming interviews for today
 */
function computeTodayActions(
  activeStudents: Student[],
  allProgressLogs: { student_id: string; scheduled_date: string; log_type: string; company_name: string; scheduled_time: string; id: string }[],
  storedTasks: { id: string; student_id?: string; student_name?: string; title: string; due_date: string; priority: string; completed: boolean }[]
) {
  const today = new Date();
  const todayStr = startOfDay(today).toISOString().split('T')[0];

  const actions: {
    id: string;
    type: 'risk' | 'overdue_task' | 'stalled' | 'interview_today';
    priority: 'critical' | 'high' | 'medium';
    studentId: string;
    studentName: string;
    message: string;
    actionLabel: string;
  }[] = [];

  for (const student of activeStudents) {
    if (student.risk_status === 'at_risk') {
      actions.push({
        id: `risk-${student.id}`,
        type: 'risk',
        priority: 'critical',
        studentId: student.id,
        studentName: student.name,
        message: `${student.name} is flagged at-risk. Immediate follow-up required.`,
        actionLabel: 'Follow up now',
      });
    }
  }

  for (const task of storedTasks) {
    if (task.completed) continue;
    if (!task.due_date) continue;
    try {
      const due = new Date(task.due_date);
      if (due <= today) {
        actions.push({
          id: `task-${task.id}`,
          type: 'overdue_task',
          priority: due < today ? 'high' : 'medium',
          studentId: task.student_id || '',
          studentName: task.student_name || '',
          message: `Task "${task.title}" is ${due < today ? 'overdue' : 'due today'}.`,
          actionLabel: 'Complete task',
        });
      }
    } catch { /* skip */ }
  }

  for (const student of activeStudents) {
    if (!student.last_activity_date) {
      actions.push({
        id: `stalled-${student.id}`,
        type: 'stalled',
        priority: 'medium',
        studentId: student.id,
        studentName: student.name,
        message: `${student.name} has no recent activity recorded.`,
        actionLabel: 'Log update',
      });
      continue;
    }
    try {
      const daysSince = differenceInDays(today, new Date(student.last_activity_date));
      if (daysSince >= 5) {
        actions.push({
          id: `stalled-${student.id}`,
          type: 'stalled',
          priority: daysSince >= 10 ? 'high' : 'medium',
          studentId: student.id,
          studentName: student.name,
          message: `${student.name} last active ${daysSince} days ago.`,
          actionLabel: 'Check in',
        });
      }
    } catch { /* skip */ }
  }

  const todayInterviews = allProgressLogs.filter(log => {
    if (log.log_type !== 'Interview Call') return false;
    if (!log.scheduled_date) return false;
    return log.scheduled_date === todayStr;
  });

  for (const interview of todayInterviews) {
    const student = activeStudents.find(s => s.id === interview.student_id);
    if (student) {
      actions.push({
        id: `interview-${interview.id}`,
        type: 'interview_today',
        priority: 'high',
        studentId: student.id,
        studentName: student.name,
        message: `${student.name} has interview at ${interview.scheduled_time} with ${interview.company_name}.`,
        actionLabel: 'View details',
      });
    }
  }

  return actions.sort((a, b) => {
    const order = { critical: 0, high: 1, medium: 2 };
    return (order[a.priority] ?? 3) - (order[b.priority] ?? 3);
  });
}

export async function GET(request: Request) {
  try {
    const user = requireRole(request.headers, ['mentor']);

    const today = new Date().toISOString().split('T')[0];
    const weekStart = subDays(new Date(), 7).toISOString().split('T')[0];

    const [myStudents, allProgressLogs, storedTasks] = await Promise.all([
      getStudentsByMentor(user.email),
      getAllProgressLogs(),
      getTasksByMentor(user.email),
    ]);

    const activeStudents = myStudents.filter(s => !s.terminated && !s.hired);
    const atRiskStudents = activeStudents.filter(isAtRisk);
    const placedStudents = myStudents.filter(s => s.hired || s.stage === 'placed');

    const interviewsThisWeek = allProgressLogs.filter(log => {
      const isOwnStudent = activeStudents.some(s => s.id === log.student_id);
      return isOwnStudent && log.log_type === 'Interview Call' && log.scheduled_date >= weekStart;
    });

    const progressLogsThisWeek = allProgressLogs.filter(log => {
      const isOwnStudent = activeStudents.some(s => s.id === log.student_id);
      return isOwnStudent && log.scheduled_date >= weekStart;
    });

    const stageBreakdown = {
      learning: activeStudents.filter(s => s.stage === 'learning').length,
      applying: activeStudents.filter(s => s.stage === 'applying').length,
      interviewing: activeStudents.filter(s => s.stage === 'interviewing').length,
      offer_pending: activeStudents.filter(s => s.stage === 'offer_pending').length,
      placed: activeStudents.filter(s => s.stage === 'placed' || s.hired).length,
    };

    const myUpcomingInterviews = interviewsThisWeek
      .filter(log => log.scheduled_date >= today)
      .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
      .slice(0, 5)
      .map(log => {
        const student = myStudents.find(s => s.id === log.student_id);
        return {
          ...log,
          studentName: student?.name ?? 'Unknown',
        };
      });

    const recentActivity = activeStudents
      .filter(s => s.last_activity_date)
      .sort((a, b) => new Date(b.last_activity_date).getTime() - new Date(a.last_activity_date).getTime())
      .slice(0, 5)
      .map(s => ({
        id: s.id,
        name: s.name,
        stage: s.stage,
        lastActivity: s.last_activity_date,
        isAtRisk: isAtRisk(s),
        batch: s.batch,
      }));

    const pendingTasks = atRiskStudents.length * 1;

    const todayActions = computeTodayActions(activeStudents, allProgressLogs, storedTasks);

    // Activity Trends (Last 7 days)
    const activityTrends = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), i);
      const dateStr = startOfDay(date).toISOString().split('T')[0];
      const dayLabel = format(date, 'MMM d');
      
      const logs = progressLogsThisWeek.filter(log => log.scheduled_date === dateStr).length;
      const interviews = interviewsThisWeek.filter(log => log.scheduled_date === dateStr).length;
      
      return { date: dayLabel, logs, interviews };
    }).reverse();

    return NextResponse.json({
      totalMentees: myStudents.length,
      activeMentees: activeStudents.length,
      atRiskCount: atRiskStudents.length,
      placedCount: placedStudents.length,
      interviewsThisWeek: interviewsThisWeek.length,
      progressLogsThisWeek: progressLogsThisWeek.length,
      stageBreakdown,
      myUpcomingInterviews,
      recentActivity,
      pendingTasks,
      atRiskStudents: atRiskStudents.slice(0, 5),
      activeMenteesList: activeStudents.map(s => ({ id: s.id, name: s.name })),
      todayActions,
      activityTrends,
    });
  } catch (e) {
    const status = isApiError(e) ? e.status : 500;
    const message = isApiError(e) ? e.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}