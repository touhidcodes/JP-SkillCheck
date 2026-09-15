/**
 * GET /api/daily-metrics
 *
 * Query params:
 *   date=YYYY-MM-DD  — get metrics for a specific date
 *   student_id=X     — get latest metrics for a student
 *   mentor_email=X   — filter by mentor (managers only)
 *   limit=N          — max results when no date/student specified (default 100)
 */

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import type { ApiError } from '@/lib/auth/helpers';
import {
  getLatestMetricsForStudent,
  getMetricsForDate,
} from '@/lib/sheets/daily-metrics';
import { readSheet } from '@/lib/sheets/client';

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'status' in e;
}

function rowToMetric(row: string[]) {
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

export async function GET(request: Request) {
  try {
    const user = requireRole(request.headers, ['manager', 'mentor']);
    const { searchParams } = new URL(request.url);

    const date = searchParams.get('date');
    const studentId = searchParams.get('student_id');
    const mentorEmail = searchParams.get('mentor_email');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    // Latest metrics for a specific student
    if (studentId) {
      const metric = await getLatestMetricsForStudent(studentId);
      if (!metric) {
        return NextResponse.json({ data: null, message: 'No metrics found' }, { status: 404 });
      }
      return NextResponse.json({ data: metric });
    }

    // Metrics for a specific date
    if (date) {
      let metrics = await getMetricsForDate(date);
      if (user.role === 'mentor') {
        metrics = metrics.filter(m => m.mentor_email === user.email);
      }
      if (mentorEmail && user.role === 'manager') {
        metrics = metrics.filter(m => m.mentor_email === mentorEmail);
      }
      return NextResponse.json({ data: metrics, total: metrics.length });
    }

    // Latest metrics per student (default view)
    const rows = await readSheet('daily_metrics');
    const allMetrics = rows.map(rowToMetric).filter(m => m.student_id && m.date);

    let filtered = allMetrics;
    if (user.role === 'mentor') {
      filtered = filtered.filter(m => m.mentor_email === user.email);
    }
    if (mentorEmail && user.role === 'manager') {
      filtered = filtered.filter(m => m.mentor_email === mentorEmail);
    }

    // Get latest per student
    const latestMap = new Map<string, typeof allMetrics[0]>();
    for (const m of filtered) {
      const existing = latestMap.get(m.student_id);
      if (!existing || m.date > existing.date) {
        latestMap.set(m.student_id, m);
      }
    }

    const latest = Array.from(latestMap.values())
      .sort((a, b) => a.leaderboard_rank - b.leaderboard_rank)
      .slice(0, limit);

    return NextResponse.json({ data: latest, total: latest.length });
  } catch (e) {
    const status = isApiError(e) ? e.status : 500;
    const message = isApiError(e) ? e.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}
