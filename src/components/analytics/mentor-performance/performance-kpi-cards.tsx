'use client';

import React from 'react';
import { Users, Award, Target, TrendingUp } from 'lucide-react';
import { StatsCard } from '@/components/dashboard/stats-card';

export interface PerformanceStats {
  avgPlacement: number;
  topPerformer: { mentor_name: string; current_placement_rate: number };
  decliningCount: number;
  improvingCount: number;
  totalHired: number;
  totalMentors: number;
}

interface PerformanceKPICardsProps {
  stats: PerformanceStats;
}

export function PerformanceKPICards({ stats }: PerformanceKPICardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatsCard
        title="Total Mentors"
        value={stats.totalMentors}
        subtitle={`${stats.improvingCount} improving`}
        icon={Users}
        color="indigo"
        info={{
          description: "Number of active mentors driving the program.",
          metrics: "Evaluating headcount and momentum (improving count).",
          calculation: "Sum of unique active mentors.",
          importance: "Foundational metric for evaluating team capacity."
        }}
      />
      <StatsCard
        title="Avg Placement"
        value={`${stats.avgPlacement}%`}
        subtitle="Program average"
        icon={Target}
        color="emerald"
        info={{
          description: "Overall placement conversion rate across all mentor cohorts.",
          metrics: "Total Hired / Total Students.",
          calculation: "Sum of Placed / Total Active * 100.",
          importance: "Indicator of gross program health and output effectiveness."
        }}
      />
      <StatsCard
        title="Top Performer"
        value={stats.topPerformer.mentor_name.split(' ')[0]}
        subtitle={`${stats.topPerformer.current_placement_rate}% placed`}
        icon={Award}
        color="amber"
        info={{
          description: "The mentor achieving the highest placement conversion.",
          metrics: "Based on raw placement rate.",
          calculation: "MAX(Placed / Active) among all mentors.",
          importance: "Signals best-in-class performance to share operational strategies."
        }}
      />
      <StatsCard
        title="Declining Trend"
        value={stats.decliningCount}
        subtitle={stats.decliningCount > 0 ? 'Need intervention' : 'All stable'}
        icon={TrendingUp}
        color={stats.decliningCount > 0 ? 'red' : 'blue'}
        info={{
          description: "Mentors whose placement/activity momentum is currently trending downwards.",
          metrics: "Negative delta compared to previous months.",
          calculation: "Count of mentors with negative performance velocity.",
          importance: "Vital call-to-action to support struggling mentor cohorts."
        }}
      />
    </div>
  );
}
