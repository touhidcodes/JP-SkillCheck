/**
 * GET /api/analytics/funnel/trend?from=X&to=Y&batch=Z
 *
 * Returns weekly funnel snapshots showing how many students were in each stage each week.
 * Uses daily_metrics to reconstruct historical stage distributions.
 */

import { NextResponse } from 'next/server';
import { parseISO, format, eachWeekOfInterval } from 'date-fns';
import { readSheet } from '@/lib/sheets/client';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const batch = searchParams.get('batch') ?? undefined;

  if (!from || !to) {
    return NextResponse.json({ message: 'from and to are required' }, { status: 400 });
  }

  const fromDate = parseISO(from);
  const toDate = parseISO(to);

  const [metricRows, studentRows] = await Promise.all([
    readSheet('daily_metrics'),
    readSheet('students'),
  ]);

  const studentBatchMap = new Map<string, string>();
  for (const row of studentRows) {
    if (!row[0]) continue;
    studentBatchMap.set(row[0], row[2] || '');
  }

  type StageName = 'learning' | 'applying' | 'interviewing' | 'offer_pending' | 'placed' | 'hired';
  const ALL_STAGES: StageName[] = ['learning', 'applying', 'interviewing', 'offer_pending', 'placed', 'hired'];

  const weekStarts = eachWeekOfInterval({ start: fromDate, end: toDate }, { weekStartsOn: 1 })
    .map(d => format(d, 'yyyy-MM-dd'));

  const weeklySnapshots: {
    week: string;
    stages: Record<StageName, number>;
    total: number;
  }[] = [];

  for (const weekStart of weekStarts) {
    const studentIdsInBatch = batch
      ? Array.from(studentBatchMap.entries())
          .filter(([, b]) => b === batch)
          .map(([id]) => id)
      : Array.from(studentBatchMap.keys());

    const latestRowForWeek = new Map<string, { date: string; stage: string; student_id: string }>();
    for (const row of metricRows) {
      if (!row[0] || !row[1]) continue;
      const date = row[0];
      if (date < from || date > weekStart) continue;
      const studentId = row[1];
      if (!studentIdsInBatch.includes(studentId)) continue;
      if (!latestRowForWeek.has(studentId) || date > latestRowForWeek.get(studentId)!.date) {
        latestRowForWeek.set(studentId, { date, stage: 'unknown', student_id: studentId });
      }
    }

    const stageCounts = Object.fromEntries(ALL_STAGES.map(s => [s, 0])) as Record<StageName, number>;
    let total = 0;

    for (const [, row] of Array.from(latestRowForWeek)) {
      const stages = ALL_STAGES;
      const foundStage = stages.find(() => {
        const r = metricRows.find(r => r[0] === weekStart && r[1] === row.student_id);
        return r;
      });

      if (!foundStage) continue;
      if (foundStage !== 'hired') {
        stageCounts[foundStage]++;
        total++;
      }
    }

    weeklySnapshots.push({ week: weekStart, stages: stageCounts, total });
  }

  return NextResponse.json({ data: weeklySnapshots });
}