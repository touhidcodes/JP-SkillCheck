/**
 * Probability-based risk scoring for students.
 *
 * Produces a calibrated 0.0–1.0 probability score across 5 orthogonal factors,
 * giving mentors a precise signal rather than a binary at-risk flag.
 *
 * Bands:
 *   0.0–0.2 = safe    (no action needed)
 *   0.2–0.4 = watch   (observe, no urgent action)
 *   0.4–0.6 = concern (reach out this week)
 *   0.6–0.8 = at_risk (must take action now)
 *   0.8–1.0 = critical (escalate to manager)
 *
 * Factors (weights sum to 1.0):
 *   consecutive_absences     0.30 — strongest predictor; hard to fake
 *   days_since_last_activity 0.25 — early warning before stage stalls
 *   attendance_rate_4w       0.25 — smooths single-session noise
 *   interview_drought        0.10 — demotivation signal for applying/interviewing stage
 *   stage_stall              0.10 — structural problem if stuck vs cohort average
 */

import type { AttendanceLog, ProgressLog, Student } from '@/types';

export type RiskBand = 'safe' | 'watch' | 'concern' | 'at_risk' | 'critical';

export interface FactorScore {
  factor: string;
  raw_value: number;
  contribution: number;
  reason: string;
}

export interface RiskScoreResult {
  probability: number;
  band: RiskBand;
  factors: FactorScore[];
  reasons: string[];
}

const BAND_THRESHOLDS: [number, RiskBand][] = [
  [0.8, 'critical'],
  [0.6, 'at_risk'],
  [0.4, 'concern'],
  [0.2, 'watch'],
];

function getBand(probability: number): RiskBand {
  for (const [threshold, band] of BAND_THRESHOLDS) {
    if (probability >= threshold) return band;
  }
  return 'safe';
}

function scoreConsecutiveAbsences(attendanceLogs: AttendanceLog[]): FactorScore {
  const unexcused = [...attendanceLogs]
    .filter(l => !l.present && (!l.excuse || l.excuse.trim() === ''))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (unexcused.length === 0) {
    return { factor: 'consecutive_absences', raw_value: 0, contribution: 0, reason: 'No unexcused absences' };
  }

  let streak = 0;
  for (let i = 0; i < unexcused.length - 1; i++) {
    const curr = new Date(unexcused[i].date);
    const next = new Date(unexcused[i + 1].date);
    const diff = Math.round((curr.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 1) streak++;
    else break;
  }

  const maxStreak = streak + 1;
  let contribution: number;
  let reason: string;

  if (maxStreak >= 3) {
    contribution = 1.0;
    reason = `${maxStreak} consecutive unexcused absences`;
  } else if (maxStreak === 2) {
    contribution = 0.7;
    reason = `${maxStreak} consecutive unexcused absences`;
  } else {
    contribution = 0.3;
    reason = `${maxStreak} unexcused absence${maxStreak > 1 ? 's' : ''} in recent period`;
  }

  return { factor: 'consecutive_absences', raw_value: maxStreak, contribution, reason };
}

function scoreDaysSinceLastActivity(lastActivityDate: string | null): FactorScore {
  if (!lastActivityDate) {
    return { factor: 'days_since_last_activity', raw_value: Infinity, contribution: 1.0, reason: 'No activity recorded' };
  }

  const days = Math.round((Date.now() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24));
  let contribution: number;
  let reason: string;

  if (days < 3) {
    contribution = 0;
    reason = 'Active recently';
  } else if (days < 7) {
    contribution = 0.3;
    reason = `${days} days since last activity`;
  } else if (days < 14) {
    contribution = 0.6;
    reason = `${days} days since last activity — approaching stall`;
  } else {
    contribution = 1.0;
    reason = `${days} days since last activity — stalled`;
  }

  return { factor: 'days_since_last_activity', raw_value: days, contribution, reason };
}

function scoreAttendanceRate4w(attendanceLogs: AttendanceLog[]): FactorScore {
  const cutoff = Date.now() - 28 * 24 * 60 * 60 * 1000;
  const recent = attendanceLogs.filter(l => new Date(l.date).getTime() >= cutoff);

  if (recent.length === 0) {
    return { factor: 'attendance_rate_4w', raw_value: 0, contribution: 0, reason: 'No sessions in last 4 weeks' };
  }

  const present = recent.filter(l => l.present || (l.excuse && l.excuse.trim() !== '')).length;
  const rate = (present / recent.length) * 100;
  let contribution: number;
  let reason: string;

  if (rate > 90) {
    contribution = 0;
    reason = `${Math.round(rate)}% attendance over 4 weeks`;
  } else if (rate >= 80) {
    contribution = 0.1;
    reason = `${Math.round(rate)}% attendance — slightly below target`;
  } else if (rate >= 60) {
    contribution = 0.4;
    reason = `${Math.round(rate)}% attendance — concerning`;
  } else {
    contribution = 0.8;
    reason = `${Math.round(rate)}% attendance — below minimum threshold`;
  }

  return { factor: 'attendance_rate_4w', raw_value: Math.round(rate * 10) / 10, contribution, reason };
}

function scoreInterviewDrought(
  progressLogs: ProgressLog[],
  currentStage: string
): FactorScore {
  if (currentStage === 'learning' || currentStage === 'placed' || currentStage === 'hired') {
    return { factor: 'interview_drought', raw_value: 0, contribution: 0, reason: 'Not applicable to current stage' };
  }

  const interviews = [...progressLogs]
    .filter(l => l.log_type === 'Interview Call')
    .sort((a, b) => new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime());

  if (interviews.length === 0) {
    return { factor: 'interview_drought', raw_value: 0, contribution: 0, reason: 'No interviews recorded yet' };
  }

  const lastInterviewDate = interviews[0]?.scheduled_date;
  if (!lastInterviewDate) {
    return { factor: 'interview_drought', raw_value: 0, contribution: 0, reason: 'No interviews with valid dates' };
  }

  const days = Math.round((Date.now() - new Date(lastInterviewDate).getTime()) / (1000 * 60 * 60 * 24));
  let contribution: number;
  let reason: string;

  if (days < 7) {
    contribution = 0;
    reason = `Recent interview ${days} days ago`;
  } else if (days < 14) {
    contribution = 0.2;
    reason = `${days} days since last interview`;
  } else if (days < 30) {
    contribution = 0.5;
    reason = `${days} days since last interview — drought developing`;
  } else {
    contribution = 0.9;
    reason = `${days} days since last interview — prolonged drought`;
  }

  return { factor: 'interview_drought', raw_value: days, contribution, reason };
}

function scoreStageStall(
  daysInStage: number,
  cohortAverage: number
): FactorScore {
  if (cohortAverage === 0) {
    return { factor: 'stage_stall', raw_value: 0, contribution: 0, reason: 'No cohort average available' };
  }

  const ratio = daysInStage / cohortAverage;
  let contribution: number;
  let reason: string;

  if (ratio < 1.0) {
    contribution = 0;
    reason = `${daysInStage} days in stage — ahead of cohort average`;
  } else if (ratio < 2.0) {
    contribution = 0.2;
    reason = `${daysInStage} days in stage — at cohort average (${Math.round(ratio * 100)}%)`;
  } else if (ratio < 3.0) {
    contribution = 0.4;
    reason = `${daysInStage} days in stage — ${Math.round(ratio * 100)}% of cohort average`;
  } else {
    contribution = 0.7;
    reason = `${daysInStage} days in stage — stalled at ${Math.round(ratio * 100)}% of cohort average`;
  }

  return { factor: 'stage_stall', raw_value: Math.round(ratio * 100) / 100, contribution, reason };
}

const FACTOR_WEIGHTS: Record<string, number> = {
  consecutive_absences:     0.30,
  days_since_last_activity: 0.25,
  attendance_rate_4w:       0.25,
  interview_drought:        0.10,
  stage_stall:              0.10,
};

export function computeRiskScore(
  student: Student,
  attendanceLogs: AttendanceLog[],
  progressLogs: ProgressLog[],
  options?: {
    days_in_stage?: number;
    cohort_stage_average?: number;
  }
): RiskScoreResult {
  const f1 = scoreConsecutiveAbsences(attendanceLogs);
  const f2 = scoreDaysSinceLastActivity(student.last_activity_date);
  const f3 = scoreAttendanceRate4w(attendanceLogs);
  const f4 = scoreInterviewDrought(progressLogs, student.stage);
  const f5 = scoreStageStall(
    options?.days_in_stage ?? 0,
    options?.cohort_stage_average ?? 14
  );

  const factors = [f1, f2, f3, f4, f5];
  const totalWeight = Object.values(FACTOR_WEIGHTS).reduce((a, b) => a + b, 0);

  const probability = Math.round(
    factors.reduce((sum, f) => {
      const weight = FACTOR_WEIGHTS[f.factor] ?? 0;
      return sum + (f.contribution * weight / totalWeight);
    }, 0) * 1000
  ) / 1000;

  const band = getBand(probability);
  const reasons = factors
    .filter(f => f.contribution > 0)
    .map(f => f.reason);

  return {
    probability: Math.min(1, probability),
    band,
    factors,
    reasons,
  };
}