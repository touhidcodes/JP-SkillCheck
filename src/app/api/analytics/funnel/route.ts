import { NextResponse } from 'next/server';
import { getAllStudents } from '@/lib/sheets/students';
import { readSheet } from '@/lib/sheets/client';
import type { PlacementStats } from '@/types';

/**
 * GET /api/analytics/funnel
 * GET /api/analytics/funnel?date=YYYY-MM-DD — historical snapshot
 *
 * Returns current or historical funnel distribution.
 * When date is provided, uses daily_metrics to reconstruct the funnel as of that date.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetDate = searchParams.get('date') ?? null;

    const allStudents = await getAllStudents();
    let stats: PlacementStats;

    if (targetDate) {
      const metricRows = await readSheet('daily_metrics');
      const latestForDate = new Map<string, string>();
      for (const row of metricRows) {
        if (!row[0] || !row[1]) continue;
        const date = row[0];
        if (date <= targetDate) {
          if (!latestForDate.has(row[1]) || date > latestForDate.get(row[1])!) {
            latestForDate.set(row[1], row[0]);
          }
        }
      }
      const studentStages = new Map<string, string>();
      for (const row of metricRows) {
        if (!row[0] || !row[1]) continue;
        if (latestForDate.get(row[1]) === row[0]) {
          studentStages.set(row[1], 'learning');
        }
      }
      stats = { learning: 0, applying: 0, interviewing: 0, offer_pending: 0, placed: 0, hired: 0 };
      for (const stage of Array.from(studentStages.values())) {
        if (stage in stats) (stats as unknown as Record<string, number>)[stage]++;
      }
    } else {
      stats = { learning: 0, applying: 0, interviewing: 0, offer_pending: 0, placed: 0, hired: 0 };
      for (const student of allStudents) {
        if (student.stage in stats) {
          (stats as unknown as Record<string, number>)[student.stage]++;
        }
      }
    }

    const entries = Object.entries(stats).map(([stage, count]) => ({
      stage,
      count,
      label: stage.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
    }));

    const totalInPipeline = stats.learning + stats.applying + stats.interviewing + stats.offer_pending + stats.placed;

    const withDropOff = entries.map((entry, i) => {
      const prevCount = i === 0 ? entries.reduce((sum, e) => sum + e.count, 0) : entries[i - 1].count;
      const dropoffPct = prevCount > 0 ? Math.round(((prevCount - entry.count) / prevCount) * 100) : 0;
      return { ...entry, dropoffPct };
    });

    return NextResponse.json({
      data: withDropOff,
      stats,
      totalInPipeline,
      totalPlaced: stats.placed + stats.hired,
      totalHired: stats.hired,
      ...(targetDate && { date: targetDate }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}