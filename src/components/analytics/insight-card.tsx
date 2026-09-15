'use client';

import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type InsightSeverity = 'positive' | 'warning' | 'critical' | 'info';

interface InsightCardProps {
  icon: LucideIcon;
  text: string;
  severity: InsightSeverity;
  className?: string;
}

const severityStyles: Record<InsightSeverity, string> = {
  positive: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  warning:  'bg-amber-50  border-amber-200  text-amber-800',
  critical: 'bg-red-50    border-red-200    text-red-800',
  info:     'bg-blue-50   border-blue-200   text-blue-800',
};

const iconStyles: Record<InsightSeverity, string> = {
  positive: 'text-emerald-500',
  warning:  'text-amber-500',
  critical: 'text-red-500',
  info:     'text-blue-500',
};

export function InsightCard({ icon: Icon, text, severity, className }: InsightCardProps) {
  return (
    <div className={cn(
      'flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border text-sm font-medium',
      severityStyles[severity],
      className,
    )}>
      <Icon className={cn('w-4 h-4 shrink-0 mt-0.5', iconStyles[severity])} />
      <span className="leading-snug">{text}</span>
    </div>
  );
}

/** Build a list of smart insights from analytics data */
export function buildInsights(data: {
  mentors: { name: string; hired: number; atRisk: number; activityScore: number; placed: number; totalMentees: number; interviewsThisMonth: number }[];
  funnel: { totalHired: number; totalInPipeline: number; totalPlaced: number };
  weeklyAverages: { placementsPerWeek: number; atRiskPerWeek: number };
}): { icon: LucideIcon; text: string; severity: InsightSeverity }[] {
  // import inline to avoid circular dep issues with the Icon type
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TrendingUp, TrendingDown, AlertTriangle, Award, Users, Target, Zap } = require('lucide-react');

  const insights: { icon: LucideIcon; text: string; severity: InsightSeverity }[] = [];
  const { mentors, funnel, weeklyAverages } = data;

  if (!mentors.length) return insights;

  // Top performer
  const top = [...mentors].sort((a, b) => b.hired - a.hired)[0];
  if (top && top.hired > 0) {
    insights.push({
      icon: Award,
      text: `Top performer: ${top.name} with ${top.hired} students hired`,
      severity: 'positive',
    });
  }

  // At-risk mentors
  const atRiskMentors = mentors.filter(m => m.atRisk > 0);
  if (atRiskMentors.length > 0) {
    const totalAtRisk = atRiskMentors.reduce((s, m) => s + m.atRisk, 0);
    insights.push({
      icon: AlertTriangle,
      text: `${totalAtRisk} at-risk student${totalAtRisk > 1 ? 's' : ''} across ${atRiskMentors.length} mentor${atRiskMentors.length > 1 ? 's' : ''} — review needed`,
      severity: totalAtRisk > 5 ? 'critical' : 'warning',
    });
  }

  // Inactive mentors (low activity score)
  const inactiveMentors = mentors.filter(m => m.activityScore < 40 && m.totalMentees > 0);
  if (inactiveMentors.length > 0) {
    insights.push({
      icon: TrendingDown,
      text: `${inactiveMentors.length} mentor${inactiveMentors.length > 1 ? 's' : ''} with low activity score — possible engagement gap`,
      severity: 'warning',
    });
  }

  // Strong pipeline
  if (funnel.totalInPipeline > 0) {
    const hireRate = Math.round((funnel.totalHired / funnel.totalInPipeline) * 100);
    if (hireRate >= 20) {
      insights.push({ icon: TrendingUp, text: `Strong hire rate at ${hireRate}% of total pipeline`, severity: 'positive' });
    }
  }

  // Weekly placement velocity
  if (weeklyAverages.placementsPerWeek > 0) {
    insights.push({
      icon: Zap,
      text: `Avg ${weeklyAverages.placementsPerWeek} placement${weeklyAverages.placementsPerWeek > 1 ? 's' : ''}/week over last 8 weeks`,
      severity: 'info',
    });
  }

  // High-activity mentor
  const highActivity = mentors.filter(m => m.interviewsThisMonth >= 5);
  if (highActivity.length > 0) {
    insights.push({
      icon: Target,
      text: `${highActivity.length} mentor${highActivity.length > 1 ? 's' : ''} logged 5+ interviews this month`,
      severity: 'positive',
    });
  }

  // Total program size
  insights.push({
    icon: Users,
    text: `${funnel.totalInPipeline + funnel.totalHired} total students across ${mentors.length} mentors`,
    severity: 'info',
  });

  return insights.slice(0, 6);
}
