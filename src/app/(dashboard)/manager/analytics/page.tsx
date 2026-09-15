'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Award, Target, Activity, BarChart3 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatsCard } from '@/components/dashboard/stats-card';
import { AnalyticsFilterBar, type FilterState } from '@/components/analytics/overview/analytics-filter-bar';
import { CompanyPipeline } from '@/components/analytics/overview/company-pipeline';
import { ConversionFunnelCard } from '@/components/analytics/overview/conversion-funnel-card';
import { CohortMatrix } from '@/components/analytics/overview/cohort-matrix';
import { ForecastInsights } from '@/components/analytics/overview/forecast-insights';

export default function ManagerAnalyticsPage() {
  const [filters, setFilters] = useState<FilterState>({
    timeRange: 'all',
    cohort: 'all',
    mentor: 'all',
    riskLevel: 'all',
    performanceCategory: 'all',
  });

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/overview');
      if (!res.ok) throw new Error('Failed to load analytics data');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const rawCohorts = data?.cohort ?? [];
  const rawMentors = data?.mentors ?? [];

  const dropdowns = useMemo(() => ({
    cohorts: Array.from(new Set(rawCohorts.map((c: any) => c.batch as string))) as string[],
    mentors: Array.from(new Set(rawMentors.map((m: any) => m.email as string))) as string[],
  }), [rawCohorts, rawMentors]);

  // Compute filtered metrics dynamically client-side for immediate visual updates
  const computedData = useMemo(() => {
    if (!data) return null;
    let filteredCohorts = [...rawCohorts];
    let filteredMentors = [...rawMentors];

    if (filters.cohort !== 'all') {
      filteredCohorts = filteredCohorts.filter(c => c.batch === filters.cohort);
    }
    if (filters.mentor !== 'all') {
      filteredMentors = filteredMentors.filter(m => m.email === filters.mentor);
    }
    if (filters.performanceCategory !== 'all') {
      filteredMentors = filteredMentors.filter(m => {
        const tier = m.placed >= 5 ? 'Elite' : m.placed >= 3 ? 'Strong' : m.placed >= 1 ? 'Developing' : 'Needs Support';
        return tier === filters.performanceCategory;
      });
    }

    const totalMentees = filteredCohorts.reduce((s, c) => s + c.total, 0);
    const totalHired = filteredCohorts.reduce((s, c) => s + c.hired, 0);
    const totalAtRisk = filteredMentors.reduce((s, m) => s + m.atRisk, 0);
    const avgScore = filteredMentors.length > 0 ? Math.round(filteredMentors.reduce((s, m) => s + m.activityScore, 0) / filteredMentors.length) : 0;

    return { totalMentees, totalHired, totalAtRisk, avgScore, cohorts: filteredCohorts, mentors: filteredMentors };
  }, [data, filters, rawCohorts, rawMentors]);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev: FilterState) => ({ ...prev, [key]: value }));
  };

  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Error loading analytics'} />;
  if (isLoading || !computedData) return <LoadingSkeletonState />;

  return (
    <div className="space-y-6 pb-8 animate-fade-up">
      <AnalyticsFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        availableCohorts={dropdowns.cohorts}
        availableMentors={dropdowns.mentors}
      />

      <AnalyticsKPIGrid data={computedData} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <CompanyPipeline companies={data?.companies ?? []} />
          <CohortMatrix cohorts={computedData.cohorts} />
        </div>
        <div className="space-y-5">
          <ConversionFunnelCard funnelData={data?.funnel?.entries ?? []} />
          <ForecastInsights funnel={data?.funnel ?? { entries: [], totalInPipeline: 0, totalHired: 0 }} weeklyAverages={data?.weeklyAverages ?? { placementsPerWeek: 0, atRiskPerWeek: 0 }} />
        </div>
      </div>
    </div>
  );
}

function AnalyticsKPIGrid({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
      <StatsCard
        title="Total Students"
        value={data.totalMentees}
        subtitle="Enrolled in scope"
        icon={Users}
        color="indigo"
        info={{
          description: "Total volume of students enrolled under this analytics scope.",
          metrics: "All tracked active/graduated students.",
          calculation: "Absolute count.",
          importance: "Baseline context for pipeline conversion metrics."
        }}
      />
      <StatsCard
        title="Total Hired"
        value={data.totalHired}
        subtitle="Successful placements"
        icon={Award}
        color="emerald"
        info={{
          description: "Total students who have fully secured job offers.",
          metrics: "Stage = Hired.",
          calculation: "Sum of hired students.",
          importance: "The ultimate success metric of the placement platform."
        }}
      />
      <StatsCard
        title="At Risk"
        value={data.totalAtRisk}
        subtitle={data.totalAtRisk > 0 ? 'Immediate attention' : 'All clear ✓'}
        icon={Target}
        color="red"
        info={{
          description: "Students identified across all mentors as struggling.",
          metrics: "Low attendance, missed tasks, declining health score.",
          calculation: "Sum of explicit at-risk flags.",
          importance: "Critical metric for managerial intervention and resource allocation."
        }}
      />
      <StatsCard
        title="Avg Activity Score"
        value={data.avgScore}
        subtitle="Engagement level"
        icon={Activity}
        color="violet"
        info={{
          description: "The holistic engagement metric across all tracked activities.",
          metrics: "Tasks, Logs, Interactions.",
          calculation: "Rolling mathematical average of underlying activity scores.",
          importance: "Key predictor of future placement success."
        }}
      />
    </div>
  );
}

function LoadingSkeletonState() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-16 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Skeleton className="lg:col-span-2 h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-2">
        <BarChart3 className="w-8 h-8 text-muted-foreground/30 mx-auto" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
