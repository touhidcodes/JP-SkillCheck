/**
 * WHY this file exists:
 * Stores daily snapshots of key student metrics (PRS score, leaderboard rank,
 * activity tier) so that week-over-week rank changes can be computed and trends
 * can be analyzed over time.
 *
 * This sheet follows an APPEND-ONLY pattern. Every day when metrics are computed,
 * a new row is appended per student. Historical rows are never modified or deleted.
 * This enables full audit trail and reproducible trend analysis.
 *
 * Sheet columns (daily_metrics):
 *   0: date              — ISO date (YYYY-MM-DD), the day this snapshot was computed
 *   1: student_id
 *   2: student_name
 *   3: mentor_email
 *   4: prs_total_score   — Placement Readiness Score (0–100)
 *   5: prs_grade         — A | B | C | D | F
 *   6: activity_tier      — Excellent | Good | Moderate | Inactive | Critical
 *   7: leaderboard_rank   — rank in cohort for that day
 *   8: leaderboard_score  — raw score used for ranking
 *   9: risk_probability  — probability score (0.0–1.0)
 *  10: risk_band         — safe | watch | concern | at_risk | critical
 *  11: tasks_completed   — tasks completed this week
 *  12: interviews_count  — interviews in last 30 days
 *  13: created_at       — timestamp when this record was written
 */

import { readSheet, appendRow } from './client';

export interface DailyMetricEntry {
  date: string;
  student_id: string;
  student_name: string;
  mentor_email: string;
  prs_total_score: number;
  prs_grade: string;
  activity_tier: string;
  leaderboard_rank: number;
  leaderboard_score: number;
  risk_probability: number;
  risk_band: string;
  tasks_completed: number;
  interviews_count: number;
  created_at: string;
}

function rowToMetric(row: string[]): DailyMetricEntry {
  return {
    date: row[0] || '',
    student_id: row[1] || '',
    student_name: row[2] || '',
    mentor_email: row[3] || '',
    prs_total_score: row[4] ? parseFloat(row[4]) : 0,
    prs_grade: row[5] || '',
    activity_tier: row[6] || '',
    leaderboard_rank: row[7] ? parseInt(row[7], 10) : 0,
    leaderboard_score: row[8] ? parseFloat(row[8]) : 0,
    risk_probability: row[9] ? parseFloat(row[9]) : 0,
    risk_band: row[10] || '',
    tasks_completed: row[11] ? parseInt(row[11], 10) : 0,
    interviews_count: row[12] ? parseInt(row[12], 10) : 0,
    created_at: row[13] || '',
  };
}

function metricToRow(m: DailyMetricEntry): string[] {
  return [
    m.date,
    m.student_id,
    m.student_name,
    m.mentor_email,
    String(m.prs_total_score),
    m.prs_grade,
    m.activity_tier,
    String(m.leaderboard_rank),
    String(m.leaderboard_score),
    String(m.risk_probability),
    m.risk_band,
    String(m.tasks_completed),
    String(m.interviews_count),
    m.created_at,
  ];
}

export async function appendDailyMetrics(
  entries: DailyMetricEntry[]
): Promise<void> {
  for (const entry of entries) {
    await appendRow('daily_metrics', metricToRow(entry));
  }
}

export async function getLatestMetricsForStudent(
  studentId: string
): Promise<DailyMetricEntry | null> {
  const rows = await readSheet('daily_metrics');
  const studentRows = rows
    .map(rowToMetric)
    .filter(r => r.student_id === studentId && r.date)
    .sort((a, b) => b.date.localeCompare(a.date));
  return studentRows[0] ?? null;
}

export async function getMetricsForDate(
  date: string
): Promise<DailyMetricEntry[]> {
  const rows = await readSheet('daily_metrics');
  return rows
    .map(rowToMetric)
    .filter(r => r.date === date && r.student_id)
    .sort((a, b) => a.leaderboard_rank - b.leaderboard_rank);
}

export async function getPreviousDayMetrics(
  date: string
): Promise<Map<string, DailyMetricEntry>> {
  const rows = await readSheet('daily_metrics');
  const targetDate = new Date(date);

  const previousRows = rows
    .map(rowToMetric)
    .filter(r => {
      if (!r.date || !r.student_id) return false;
      const d = new Date(r.date);
      return d < targetDate;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const byStudent = new Map<string, DailyMetricEntry>();
  for (const row of previousRows) {
    if (!byStudent.has(row.student_id)) {
      byStudent.set(row.student_id, row);
    }
  }
  return byStudent;
}