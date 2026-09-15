'use client';

import { useMemo } from 'react';
import { ProgressLog } from '@/types';
import { StatsCard } from '@/components/dashboard/stats-card';
import { parseISO, startOfDay } from 'date-fns';
import { Activity, Trophy, GraduationCap, Calendar } from 'lucide-react';

interface StatsCardsProps {
  logs: ProgressLog[];
}

export function StatsCards({ logs }: StatsCardsProps) {
  const stats = useMemo(() => {
    const total = logs.length;
    const offers = logs.filter((l) => l.log_type === 'Offer').length;

    // Mock interviews
    const mockLogs = logs.filter((l) => l.log_type === 'Mock Interview' && l.mock_score !== undefined && l.mock_score > 0);
    const mockCount = mockLogs.length;
    const mockSum = mockLogs.reduce((acc, curr) => acc + (curr.mock_score || 0), 0);
    const avgMockScore = mockCount > 0 ? Number((mockSum / mockCount).toFixed(1)) : 0;

    // Upcoming schedules
    const today = startOfDay(new Date());
    const upcoming = logs.filter((l) => {
      if (!l.scheduled_date) return false;
      try {
        const d = startOfDay(parseISO(l.scheduled_date));
        return d >= today;
      } catch {
        return false;
      }
    }).length;

    // Engagement summary
    let engagementLevel: 'High' | 'Moderate' | 'Low' = 'Low';
    if (total > 15) {
      engagementLevel = 'High';
    } else if (total > 5) {
      engagementLevel = 'Moderate';
    }

    return {
      total,
      offers,
      avgMockScore,
      mockCount,
      upcoming,
      engagementLevel,
    };
  }, [logs]);

  // Mock performance status label
  const mockStatus = useMemo(() => {
    if (stats.mockCount === 0) return { label: 'No mocks conducted' };
    if (stats.avgMockScore >= 8.0) return { label: 'Excellent' };
    if (stats.avgMockScore >= 6.0) return { label: 'Proficient' };
    return { label: 'Needs Focus' };
  }, [stats]);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Activities Card */}
      <StatsCard
        title="Total Activities"
        value={stats.total}
        subtitle={`${stats.engagementLevel} Engagement`}
        icon={Activity}
        color="indigo"
        info={{
          description: "Total number of student placement activities and milestones logged.",
          metrics: "Aggregate count of all progress log entries.",
          calculation: "COUNT(progress_logs)",
          importance: "Measures overall tracking activity volume and student engagement pace."
        }}
      />

      {/* Offers Secured Card */}
      <StatsCard
        title="Offers Secured"
        value={stats.offers}
        subtitle={stats.offers > 0 ? "Placement Milestone" : "Placement successes"}
        icon={Trophy}
        color="emerald"
        info={{
          description: "Total number of job offers secured by your assigned mentees.",
          metrics: "Count of progress logs categorized as 'Offer'.",
          calculation: "COUNT(progress_logs WHERE log_type = 'Offer')",
          importance: "Primary success metric indicating final stage placement conversions."
        }}
      />

      {/* Mock Evaluation Card */}
      <StatsCard
        title="Mock Evaluation"
        value={stats.mockCount > 0 ? `${stats.avgMockScore}/10` : '—'}
        subtitle={mockStatus.label}
        icon={GraduationCap}
        color="purple"
        info={{
          description: "Average score across all logged candidate practice mock interviews.",
          metrics: "Calculated average rating of student mock evaluations.",
          calculation: "AVERAGE(mock_score WHERE log_type = 'Mock Interview')",
          importance: "Evaluates the candidate's core interview readiness and technical proficiency."
        }}
      />

      {/* Upcoming Activities Card */}
      <StatsCard
        title="Upcoming Tasks"
        value={stats.upcoming}
        subtitle={stats.upcoming > 0 ? "Action Required" : "All Caught Up"}
        icon={Calendar}
        color="amber"
        info={{
          description: "Milestones, recruiter tasks, or interviews scheduled for future dates.",
          metrics: "Count of logs with scheduled dates greater than or equal to today.",
          calculation: "COUNT(progress_logs WHERE scheduled_date >= today)",
          importance: "Ensures visibility of upcoming student pipeline commitments."
        }}
      />
    </div>
  );
}
