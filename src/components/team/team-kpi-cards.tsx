'use client';

import React from 'react';
import { UserCheck, UserX, Target, Award } from 'lucide-react';
import { StatsCard } from '@/components/dashboard/stats-card';

export interface TeamSummary {
  total: number;
  active: number;
  needsSupport: number;
  avgPlacement: number;
  topPerformer: { mentor_name: string; score: number };
}

interface TeamKPICardsProps {
  summary: TeamSummary;
}

export function TeamKPICards({ summary }: TeamKPICardsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatsCard
        title="Total Mentors"
        value={summary.total}
        subtitle={`${summary.active} performing well`}
        icon={UserCheck}
        color="indigo"
        info={{
          description: "Total number of active mentors managed under your organization.",
          metrics: "Count of mentor accounts.",
          calculation: "Simple sum of active mentors in the system.",
          importance: "Baseline context for overall managerial load and team size."
        }}
      />
      <StatsCard
        title="Needs Support"
        value={summary.needsSupport}
        subtitle={summary.needsSupport > 0 ? 'Action required' : 'All good ✓'}
        icon={UserX}
        color={summary.needsSupport > 0 ? 'red' : 'emerald'}
        info={{
          description: "Mentors identified as requiring curriculum or operational assistance.",
          metrics: "Calculated dynamically based on active flagging stats.",
          calculation: "Count of mentors marked as needing support.",
          importance: "Highlights potential bottlenecks or coaching staff needing intervention."
        }}
      />
      <StatsCard
        title="Avg Placement Rate"
        value={`${summary.avgPlacement}%`}
        subtitle="Across all mentors"
        icon={Target}
        color="blue"
        info={{
          description: "The combined average placement rate across all mentors.",
          metrics: "Overall Placed Students / Overall Active Students.",
          calculation: "(Total placed / Total active) * 100",
          importance: "Reflects the general success rate of the entire academic program."
        }}
      />
      <StatsCard
        title="Top Performer"
        value={summary.topPerformer.mentor_name.split(' ')[0]}
        subtitle={`${summary.topPerformer.score} pts`}
        icon={Award}
        color="amber"
        info={{
          description: "The mentor with the highest health and activity score.",
          metrics: "Combined Mentor Performance Score.",
          calculation: "Highest score computed from local placement and activity factors.",
          importance: "Recognizes excellence and identifies role models for peer learning."
        }}
      />
    </div>
  );
}
