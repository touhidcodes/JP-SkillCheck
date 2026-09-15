/**
 * GET /api/analytics/mentor-performance?mentorEmail=X&from=Y&to=Z
 *
 * Returns comprehensive performance metrics for a single mentor or all mentors.
 * Uses pre-computed daily_metrics for PRS/risk data; raw sheets for response time.
 */

import { NextResponse } from 'next/server';
import { parseISO } from 'date-fns';
import { readSheet } from '@/lib/sheets/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mentorEmail = searchParams.get('mentorEmail') ?? undefined;
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json({ message: 'from and to are required' }, { status: 400 });
  }

  const [studentRows, progressLogRows, escalationRows, taskRows, metricRows, userRows] = await Promise.all([
    readSheet('students'),
    readSheet('progress_logs'),
    readSheet('escalations'),
    readSheet('mentor_tasks'),
    readSheet('daily_metrics'),
    readSheet('users'),
  ]);

  // Build set of active, real mentor emails (exclude test accounts like mentor1, mentor2, etc.)
  const testAccountPattern = /^mentor\d+(@|$)/i;
  const activeMentorEmails = new Set<string>();
  for (const row of userRows) {
    const name  = (row[1] ?? '').trim();
    const email = (row[2] ?? '').trim();
    const role  = (row[3] ?? '').trim();
    const active = row[4] === 'true';
    if (role === 'mentor' && active && !testAccountPattern.test(name) && !testAccountPattern.test(email)) {
      activeMentorEmails.add(email);
    }
  }

  const studentsByMentor = new Map<string, {
    id: string; name: string; stage: string; terminated: boolean; hired: boolean;
  }[]>();
  for (const row of studentRows) {
    if (!row[0] || !row[4]) continue;
    const mentor = row[4];
    // Skip students assigned to test/inactive mentors
    if (!activeMentorEmails.has(mentor)) continue;
    const existing = studentsByMentor.get(mentor) || [];
    existing.push({
      id: row[0],
      name: row[1] || '',
      stage: row[6] || 'learning',
      terminated: row[11] === 'true',
      hired: row[12] === 'true',
    });
    studentsByMentor.set(mentor, existing);
  }

  const mentorEmails = mentorEmail
    ? (activeMentorEmails.has(mentorEmail) ? [mentorEmail] : [])
    : Array.from(studentsByMentor.keys());

  const results = [];

  for (const mentor of mentorEmails) {
    const students = (studentsByMentor.get(mentor) || []).filter(s => !s.terminated);
    const studentIds = students.map(s => s.id);

    if (students.length === 0) continue;

    const activeStudents = students.filter(s => !s.terminated && !s.hired);
    const placedStudents = students.filter(s => s.hired);

    const cohortSize = students.length;
    const placementRate = cohortSize > 0
      ? Math.round((placedStudents.length / cohortSize) * 100)
      : 0;

    const recentMetrics = metricRows.filter(r => {
      if (!r[0] || !r[1]) return false;
      const date = r[0];
      if (date < from || date > to) return false;
      return studentsByMentor.get(mentor)?.some(s => s.id === r[1]);
    });

    const avgPrs = recentMetrics.length > 0
      ? Math.round(recentMetrics.reduce((sum, r) => sum + (parseFloat(r[4]) || 0), 0) / recentMetrics.length)
      : 0;

    const escalationData = escalationRows.filter(r => r[5] === mentor);
    const acknowledged = escalationData.filter(r => r[6]);
    const totalEscalations = escalationData.length;

    let avgResponseTimeHours = 0;
    if (acknowledged.length > 0) {
      const responseTimes = acknowledged
        .map(r => {
          const raised = new Date(r[4]).getTime();
          const ack = new Date(r[6]).getTime();
          return (ack - raised) / (1000 * 60 * 60);
        })
        .filter(t => t >= 0 && t < 168);
      avgResponseTimeHours = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;
    }

    const taskCompletedRows = taskRows.filter(r => {
      if (!r[1] || r[1] !== mentor) return false;
      const completed = r[13] === 'true';
      const studentId = r[2];
      return completed && studentIds.includes(studentId);
    });
    const taskAssignedRows = taskRows.filter(r => {
      if (!r[1] || r[1] !== mentor) return false;
      const studentId = r[2];
      return studentIds.includes(studentId);
    });
    const taskCompletionRate = taskAssignedRows.length > 0
      ? Math.round((taskCompletedRows.length / taskAssignedRows.length) * 100)
      : 0;

    const studentIdsSet = new Set(studentIds);
    const recentMockLogs = progressLogRows.filter(r => {
      if (!r[1] || !r[9]) return false;
      if (!studentIdsSet.has(r[1])) return false;
      const date = r[9];
      if (date < from || date > to) return false;
      return r[4] === 'Mock Interview';
    });
    const studentsWithMockInterview = new Set(recentMockLogs.map(r => r[1])).size;
    const interviewPrepRate = cohortSize > 0
      ? Math.round((studentsWithMockInterview / cohortSize) * 100)
      : 0;

    const atRiskStudents = students.filter(s => {
      const latestMetric = [...recentMetrics]
        .filter(r => r[1] === s.id)
        .sort((a, b) => b[0].localeCompare(a[0]))[0];
      return latestMetric && (latestMetric[10] === 'at_risk' || latestMetric[10] === 'critical');
    });

    const riskRecoveries = 0;

    results.push({
      mentorEmail: mentor,
      mentorName: mentor.split('@')[0],
      cohortSize,
      activeStudents: activeStudents.length,
      placementRate,
      avgPrsOfCohort: avgPrs,
      responseTimeAvgHours: avgResponseTimeHours,
      taskCompletionRate,
      interviewPrepRate,
      atRiskCount: atRiskStudents.length,
      riskPreventionRate: riskRecoveries,
      totalEscalations,
      npsScore: 0,
      activityScore: 0,
    });
  }

  return NextResponse.json({
    data: results,
    meta: { from, to, mentorCount: results.length },
  });
}