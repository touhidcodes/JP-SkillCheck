'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PerformanceKPICards, type PerformanceStats } from '@/components/analytics/mentor-performance/performance-kpi-cards';
import { MonthlyTrendsCard } from '@/components/analytics/mentor-performance/monthly-trends-card';
import { RadarComparisonCard } from '@/components/analytics/radar-comparison/radar-comparison-card';
import { LeaderboardTable } from '@/components/analytics/mentor-performance/leaderboard-table';

export default function MentorPerformancePage() {
  const [monthsBack, setMonthsBack] = useState('6');

  const { data, isLoading } = useQuery({
    queryKey: ['mentor-performance-trends', monthsBack],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/mentor-performance/trends?months=${monthsBack}`);
      if (!res.ok) throw new Error('Failed to load mentor performance trends');
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const mentors = useMemo(() => data?.data ?? [], [data?.data]);

  const stats = useMemo<PerformanceStats | null>(() => {
    if (mentors.length === 0) return null;
    const avgPlacement = Math.round(mentors.reduce((sum: number, m: any) => sum + m.current_placement_rate, 0) / mentors.length);
    const topPerformer = mentors.reduce((best: any, m: any) => m.current_placement_rate > best.current_placement_rate ? m : best, mentors[0]);
    const declining = mentors.filter((m: any) => m.placement_trend === 'down');
    const improving = mentors.filter((m: any) => m.placement_trend === 'up');
    const totalHired = mentors.reduce((sum: number, m: any) => sum + m.total_hired_all_time, 0);
    return {
      avgPlacement,
      topPerformer: { mentor_name: topPerformer.mentor_name, current_placement_rate: topPerformer.current_placement_rate },
      decliningCount: declining.length,
      improvingCount: improving.length,
      totalHired,
      totalMentors: mentors.length,
    };
  }, [mentors]);

  if (isLoading) return <LoadingSkeletonState />;
  if (!mentors.length) return <EmptyDataState />;

  return (
    <div className="space-y-6 pb-8 animate-fade-up">
      <div className="flex items-center justify-end">
        <Select value={monthsBack} onValueChange={setMonthsBack}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">Last 3 months</SelectItem>
            <SelectItem value="6">Last 6 months</SelectItem>
            <SelectItem value="9">Last 9 months</SelectItem>
            <SelectItem value="12">Last 12 months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {stats && <PerformanceKPICards stats={stats} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <MonthlyTrendsCard mentors={mentors} />
        <RadarComparisonCard mentors={mentors} />
      </div>

      <LeaderboardTable mentors={mentors} />
    </div>
  );
}

function LoadingSkeletonState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

function EmptyDataState() {
  return (
    <Card className="border-2 border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-20 text-center">
        <Users className="w-12 h-12 text-muted-foreground/20 mb-4" />
        <p className="text-sm font-semibold text-foreground">No mentor data available</p>
        <p className="text-xs text-muted-foreground mt-1">Assign students to mentors to see performance trends</p>
      </CardContent>
    </Card>
  );
}
