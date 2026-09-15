/**
 * GET /api/analytics/funnel/velocity
 *
 * Returns median, p25, p75 days-in-stage for each pipeline stage.
 * Source: stage_history sheet (immutable event log).
 *
 * WHY TIME IN STAGE IS MORE ACTIONABLE THAN FUNNEL SNAPSHOT:
 * A funnel snapshot tells you HOW MANY students are in each stage today.
 * Velocity tells you HOW LONG students spend in each stage before moving on.
 * If 30 students are in "applying" (snapshot looks fine) but the median
 * time spent there is 45 days (vs 14-day cohort average), you have a problem
 * that the snapshot completely hides. Stage velocity pinpoints exactly
 * WHERE students get stuck — the bottleneck stage — so mentors can
 * intervene there rather than spreading attention evenly across all stages.
 */

import { NextResponse } from 'next/server';
import { readSheet } from '@/lib/sheets/client';

export const dynamic = 'force-dynamic';

interface VelocityEntry {
  stage: string;
  median_days: number;
  p25_days: number;
  p75_days: number;
  sample_size: number;
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return Math.round(sorted[Math.max(0, idx)]);
}

function median(arr: number[]): number {
  return percentile(arr, 50);
}

export async function GET() {
  const stageHistoryRows = await readSheet('stage_history');

  const stageDurations = new Map<string, number[]>();

  const stageMap = new Map<string, {
    transitioned_at: string;
    to_stage: string;
  }>();

  for (const row of stageHistoryRows) {
    if (!row[1] || !row[4]) continue;
    const studentId = row[1];
    const toStage = row[3];
    const transitionedAt = row[4];

    const existing = stageMap.get(studentId);
    if (!existing || new Date(transitionedAt) > new Date(existing.transitioned_at)) {
      stageMap.set(studentId, { to_stage: toStage, transitioned_at: transitionedAt });
    }
  }

  const studentStages = new Map<string, { to_stage: string; transitioned_at: string }[]>();
  for (const row of stageHistoryRows) {
    if (!row[1]) continue;
    const studentId = row[1];
    const toStage = row[3];
    const transitionedAt = row[4];

    const existing = studentStages.get(studentId) || [];
    existing.push({ to_stage: toStage, transitioned_at: transitionedAt });
    studentStages.set(studentId, existing);
  }

  for (const [, transitions] of Array.from(studentStages)) {
    const sorted = [...transitions].sort(
      (a, b) => new Date(b.transitioned_at).getTime() - new Date(a.transitioned_at).getTime()
    );

    for (let i = 0; i < sorted.length - 1; i++) {
      const fromDate = new Date(sorted[i].transitioned_at);
      const toDate = new Date(sorted[i + 1].transitioned_at);
      const days = (fromDate.getTime() - toDate.getTime()) / (1000 * 60 * 60 * 24);

      if (days < 0 || days > 365) continue;

      const stage = sorted[i].to_stage;
      const existing = stageDurations.get(stage) || [];
      existing.push(days);
      stageDurations.set(stage, existing);
    }

    if (sorted.length >= 1) {
      const lastTransition = sorted[0];
      const daysInCurrentStage = (Date.now() - new Date(lastTransition.transitioned_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysInCurrentStage >= 0 && daysInCurrentStage <= 365) {
        const stage = lastTransition.to_stage;
        const existing = stageDurations.get(stage) || [];
        existing.push(daysInCurrentStage);
        stageDurations.set(stage, existing);
      }
    }
  }

  const VALID_STAGES = ['learning', 'applying', 'interviewing', 'offer_pending', 'placed', 'hired'];
  const result: VelocityEntry[] = [];

  for (const stage of VALID_STAGES) {
    const durations = stageDurations.get(stage) || [];
    if (durations.length < 2) {
      result.push({ stage, median_days: 0, p25_days: 0, p75_days: 0, sample_size: durations.length });
      continue;
    }

    result.push({
      stage,
      median_days: median(durations),
      p25_days: percentile(durations, 25),
      p75_days: percentile(durations, 75),
      sample_size: durations.length,
    });
  }

  return NextResponse.json({ data: result });
}