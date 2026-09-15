/**
 * Activity Rubric
 *
 * Classifies a student's engagement level into 5 tiers based on:
 *   - Attendance rate (last 30 days)
 *   - Weekly activity count (interviews + tasks + jobs applied in last 7 days)
 *
 * Tiers:
 *   Excellent  — ≥80% attendance AND ≥3 activities/week
 *   Good       — ≥70% attendance AND ≥2 activities/week
 *   Moderate   — ≥60% attendance OR ≥1 activity/week
 *   Inactive   — <60% attendance AND 0 activities/week
 *   Critical   — <40% attendance OR terminated/at-risk with 0 activity
 */

import type { ActivityTier } from '@/types';

export interface RubricInput {
  attendance_rate_pct: number | null; // null = no sessions logged
  weekly_activity_count: number;      // interviews + tasks + jobs applied this week
  is_at_risk: boolean;
  is_terminated: boolean;
}

export interface RubricResult {
  tier: ActivityTier;
  color: string;       // Tailwind bg color class
  text_color: string;  // Tailwind text color class
  border_color: string;
  description: string;
}

const RUBRIC_STYLES: Record<ActivityTier, Omit<RubricResult, 'tier' | 'description'>> = {
  Excellent: {
    color: 'bg-emerald-100',
    text_color: 'text-emerald-800',
    border_color: 'border-emerald-300',
  },
  Good: {
    color: 'bg-blue-100',
    text_color: 'text-blue-800',
    border_color: 'border-blue-300',
  },
  Moderate: {
    color: 'bg-amber-100',
    text_color: 'text-amber-800',
    border_color: 'border-amber-300',
  },
  Inactive: {
    color: 'bg-orange-100',
    text_color: 'text-orange-800',
    border_color: 'border-orange-300',
  },
  Critical: {
    color: 'bg-red-100',
    text_color: 'text-red-800',
    border_color: 'border-red-300',
  },
};

export function computeActivityTier(input: RubricInput): RubricResult {
  const { attendance_rate_pct, weekly_activity_count, is_at_risk, is_terminated } = input;

  // Terminated students are always Critical
  if (is_terminated) {
    return buildResult('Critical', 'Terminated');
  }

  const att = attendance_rate_pct ?? 0;

  // Critical: very low attendance OR at-risk with zero activity
  if (att < 40 || (is_at_risk && weekly_activity_count === 0)) {
    return buildResult('Critical', att < 40
      ? `Attendance ${att}% — needs immediate intervention`
      : 'At risk with no recent activity');
  }

  // Excellent: high attendance + strong weekly activity
  if (att >= 80 && weekly_activity_count >= 3) {
    return buildResult('Excellent', `${att}% attendance · ${weekly_activity_count} activities this week`);
  }

  // Good: decent attendance + some activity
  if (att >= 70 && weekly_activity_count >= 2) {
    return buildResult('Good', `${att}% attendance · ${weekly_activity_count} activities this week`);
  }

  // Inactive: below 60% attendance AND no activity
  if (att < 60 && weekly_activity_count === 0) {
    return buildResult('Inactive', `${att}% attendance · no activity this week`);
  }

  // Moderate: everything else
  return buildResult('Moderate', `${att}% attendance · ${weekly_activity_count} activities this week`);
}

function buildResult(tier: ActivityTier, description: string): RubricResult {
  return {
    tier,
    description,
    ...RUBRIC_STYLES[tier],
  };
}
