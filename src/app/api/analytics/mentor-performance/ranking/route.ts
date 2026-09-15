/**
 * GET /api/analytics/mentor-performance/ranking
 *
 * Returns all mentors ranked by composite performance score.
 */

import { NextResponse } from 'next/server';
import { subDays } from 'date-fns';
import { readSheet } from '@/lib/sheets/client';

export const dynamic = 'force-dynamic';

interface MentorMetrics {
  mentorEmail: string;
  mentorName: string;
  cohortSize: number;
  placementRate: number;
  avgPrsOfCohort: number;
  responseTimeAvgHours: number;
  taskCompletionRate: number;
  interviewPrepRate: number;
  atRiskCount: number;
  totalEscalations: number;
  compositeScore: number;
  rank: number;
}

const WEIGHTS = {
  placementRate: 0.25,
  avgPrsOfCohort: 0.20,
  taskCompletionRate: 0.15,
  interviewPrepRate: 0.15,
  responseTimeAvgHours: 0.15,
  atRiskCount: 0.10,
};

function computeCompositeScore(m: Omit<MentorMetrics, 'compositeScore' | 'rank'>): number {
  const prsScore = Math.min(100, m.avgPrsOfCohort);
  const taskScore = m.taskCompletionRate;
  const interviewScore = m.interviewPrepRate;
  const placementScore = m.placementRate;
  const responseScore = Math.max(0, 100 - (m.responseTimeAvgHours / 4 * 100));
  const riskScore = Math.max(0, 100 - (m.atRiskCount / Math.max(1, m.cohortSize) * 100));

  return Math.round(
    placementScore * WEIGHTS.placementRate +
    prsScore * WEIGHTS.avgPrsOfCohort +
    taskScore * WEIGHTS.taskCompletionRate +
    interviewScore * WEIGHTS.interviewPrepRate +
    responseScore * WEIGHTS.responseTimeAvgHours +
    riskScore * WEIGHTS.atRiskCount
  );
}

export async function GET() {
  const to = new Date().toISOString().split('T')[0];
  const from = subDays(new Date(), 30).toISOString().split('T')[0];

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

  const studentsByMentor = new Map<string, { id: string; name: string; stage: string; terminated: boolean; hired: boolean }[]>();
  for (const row of studentRows) {
    if (!row[0] || !row[4]) continue;
    const mentor = row[4];
    // Skip students assigned to test/inactive mentors
    if (!activeMentorEmails.has(mentor)) continue;
    const existing = studentsByMentor.get(mentor) || [];
    existing.push({ id: row[0], name: row[1] || '', stage: row[6] || 'learning', terminated: row[11] === 'true', hired: row[12] === 'true' });
    studentsByMentor.set(mentor, existing);
  }

  const mentorMetrics: Omit<MentorMetrics, 'compositeScore' | 'rank'>[] = [];

  for (const [mentor, students] of Array.from(studentsByMentor)) {
    const activeStudents = students.filter(s => !s.terminated && !s.hired);
    const placedStudents = students.filter(s => s.hired);
    const cohortSize = students.length;
    if (cohortSize === 0) continue;

    const placementRate = Math.round((placedStudents.length / cohortSize) * 100);
    const studentIds = students.map(s => s.id);
    const studentIdsSet = new Set(studentIds);

    const recentMetrics = metricRows.filter(r => {
      if (!r[0] || !r[1]) return false;
      const date = r[0];
      if (date < from || date > to) return false;
      return studentIdsSet.has(r[1]);
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
        .map(r => { const raised = new Date(r[4]).getTime(); const ack = new Date(r[6]).getTime(); return (ack - raised) / (1000 * 60 * 60); })
        .filter(t => t >= 0 && t < 168);
      avgResponseTimeHours = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;
    }

    const taskAssignedRows = taskRows.filter(r => { if (!r[1] || r[1] !== mentor) return false; return studentIdsSet.has(r[2]); });
    const taskCompletedRows = taskAssignedRows.filter(r => r[13] === 'true');
    const taskCompletionRate = taskAssignedRows.length > 0
      ? Math.round((taskCompletedRows.length / taskAssignedRows.length) * 100)
      : 0;

    const recentMockLogs = progressLogRows.filter(r => {
      if (!r[1] || !r[9]) return false;
      if (!studentIdsSet.has(r[1])) return false;
      if (r[9] < from || r[9] > to) return false;
      return r[4] === 'Mock Interview';
    });
    const studentsWithMock = new Set(recentMockLogs.map(r => r[1])).size;
    const interviewPrepRate = Math.round((studentsWithMock / cohortSize) * 100);

    const atRiskCount = activeStudents.length;

    mentorMetrics.push({
      mentorEmail: mentor,
      mentorName: mentor.split('@')[0],
      cohortSize,
      placementRate,
      avgPrsOfCohort: avgPrs,
      responseTimeAvgHours: avgResponseTimeHours,
      taskCompletionRate,
      interviewPrepRate,
      atRiskCount,
      totalEscalations,
    });
  }

  const withScores = mentorMetrics.map(m => ({
    ...m,
    compositeScore: computeCompositeScore(m),
  }));

  withScores.sort((a, b) => b.compositeScore - a.compositeScore);

  const ranked = withScores.map((m, i) => ({ ...m, rank: i + 1 }));

  return NextResponse.json({ data: ranked });
}