'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Users, Award, TrendingUp, ShieldCheck,
  ArrowRight, Activity, Target, GitBranch, AlertCircle, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { MetricPopover } from '@/components/shared/metric-popover';
import { StatsCard } from '@/components/dashboard/stats-card';
import { computeHealthScore } from '@/components/analytics/program-health-gauge';
import { FunnelPipeline, ConversionMetrics } from '@/components/analytics/funnel-pipeline';
import { DetailedAnalyticsTable } from '@/components/dashboard/detailed-analytics-table';
import { getPerformanceTier, TIER_STYLES, TIER_DOT } from '@/components/analytics/mentor-leaderboard-card';
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from '@/components/ui/chart';
import { PieChart, Pie, Cell, Sector } from 'recharts';
import { cn } from '@/lib/utils';
import type { AnalyticsOverview } from '@/lib/analytics/engine';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid,
} from 'recharts';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const AVATAR_PALETTE = [
  'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

export default function ManagerDashboardPage() {
  const [healthFilter, setHealthFilter] = useState<'all' | 'placement' | 'activity' | 'risk'>('all');
  const [trendRange, setTrendRange] = useState<'week' | 'month' | '3months' | 'all'>('all');

  const { data: analytics, isLoading, isError, refetch } = useQuery<AnalyticsOverview>({
    queryKey: ['analytics-overview'],
    queryFn: async () => {
      const res = await fetch('/api/analytics/overview');
      if (!res.ok) throw new Error('Failed to fetch analytics data');
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: leaderboardData } = useQuery({
    queryKey: ['leaderboard', 'mentors', 'monthly'],
    queryFn: async () => {
      const res = await fetch('/api/leaderboard?type=mentors&period=monthly');
      if (!res.ok) throw new Error('Failed to fetch leaderboard data');
      return res.json() as Promise<{ data: {
        rank: number; mentor_email: string; mentor_name: string;
        total_students: number; hired: number; placement_rate: number;
        interviews_this_period: number; offers_this_period: number;
        at_risk: number; needs_support: boolean; score: number;
      }[]; period_label: string }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <ManagerDashboardSkeleton />;
  
  if (isError) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 text-center">
        <AlertCircle className="w-10 h-10 text-red-500 animate-bounce" />
        <h3 className="text-lg font-bold text-foreground">Analytics Synced Failed</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          We encountered an error fetching live dashboard indicators from the Google Sheets database.
        </p>
        <Button onClick={() => refetch()} className="gap-2 rounded-xl h-9.5 text-xs font-bold shadow-sm">
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Connection
        </Button>
      </div>
    );
  }

  const mentors     = analytics?.mentors ?? [];
  const funnel      = analytics?.funnel;
  const trends      = analytics?.trends ?? [];
  const healthScore = computeHealthScore(mentors);

  const totalMentors      = mentors.length;
  const totalHired        = mentors.reduce((s, m) => s + m.hired, 0);
  const totalMentees      = mentors.reduce((s, m) => s + m.totalMentees, 0);
  const totalAtRisk       = mentors.reduce((s, m) => s + m.atRisk, 0);
  const avgPlacementRate  = totalMentees > 0
    ? Math.round((mentors.reduce((s, m) => s + m.placed + m.hired, 0) / totalMentees) * 100) : 0;

  const avgActivityScore  = mentors.length > 0
    ? Math.round(mentors.reduce((s, m) => s + m.activityScore, 0) / mentors.length) : 0;

  const leaderboardEntries = leaderboardData?.data ?? [];
  const trendChartData = trends.map(t => ({
    week: t.week,
    weekStart: t.weekStart ?? '',
    'Placements': t.placements,
    'At Risk': t.atRisk,
    'Active': t.activeCount,
  }));

  const now = new Date();
  const filteredTrendData = trendChartData.filter(t => {
    if (trendRange === 'all') return true;
    if (!t.weekStart) return true;
    const d = new Date(t.weekStart);
    if (trendRange === 'week')    return (now.getTime() - d.getTime()) <= 7  * 24 * 60 * 60 * 1000;
    if (trendRange === 'month')   return (now.getTime() - d.getTime()) <= 30 * 24 * 60 * 60 * 1000;
    if (trendRange === '3months') return (now.getTime() - d.getTime()) <= 90 * 24 * 60 * 60 * 1000;
    return true;
  });

  const totalPipeline = funnel?.totalInPipeline ?? 0;

  return (
    <div className="space-y-6 animate-fade-up pb-10">
      {/* 6 Stats / KPI Grid Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatsCard
          info={{
            description: 'The complete count of registered mentors on the platform.',
            metrics: 'Total users with the role "mentor".',
            calculation: "COUNT(users WHERE role = 'mentor')",
            importance: 'Helps assess mentor availability and distribution load against the total student pipeline.'
          }}
          title="Total Mentors"
          value={totalMentors}
          subtitle={`${mentors.filter(m => m.activityScore >= 60).length} active`}
          icon={Users}
          color="indigo"
        />
        <StatsCard
          info={{
            description: 'The average placement rate achieved per mentor.',
            metrics: 'Hired Students / Total Mentored Students.',
            calculation: 'AVERAGE(mentors.placementRate)',
            importance: 'A key indicator of overall mentor and curriculum effectiveness.'
          }}
          title="Avg Placement"
          value={`${avgPlacementRate}%`}
          subtitle="Across all mentors"
          icon={Target}
          color="emerald"
        />
        <StatsCard
          info={{
            description: 'The absolute number of students who have secured a job.',
            metrics: "Students with stage = 'hired'.",
            calculation: "COUNT(students WHERE stage = 'hired')",
            importance: 'The ultimate success metric of the placement program.'
          }}
          title="Total Hired"
          value={totalHired}
          subtitle="All time"
          icon={Award}
          color="amber"
        />
        <StatsCard
          info={{
            description: 'Students identified as having a high risk of dropping out or failing to secure placement.',
            metrics: "Students flagged with 'at_risk' status.",
            calculation: "COUNT(students WHERE risk_status = 'at_risk')",
            importance: 'Highlights immediate intervention needs to improve overall placement success.'
          }}
          title="At Risk"
          value={totalAtRisk}
          subtitle={totalAtRisk > 0 ? 'Needs attention' : 'All clear ✓'}
          icon={ShieldCheck}
          color={totalAtRisk > 0 ? 'red' : 'emerald'}
        />
        <StatsCard
          info={{
            description: 'Students who are actively engaged and looking for jobs, but not yet hired or terminated.',
            metrics: 'Active students.',
            calculation: 'COUNT(students WHERE terminated = false AND hired = false)',
            importance: 'Shows the volume of current work required from mentors.'
          }}
          title="In Pipeline"
          value={totalPipeline}
          subtitle="Active students"
          icon={GitBranch}
          color="blue"
        />
        <StatsCard
          info={{
            description: "The average number of students changing their status to 'hired' per week.",
            metrics: 'Recent placements / Recent weeks.',
            calculation: 'SUM(hired_last_30_days) / 4',
            importance: 'Provides a pulse check on immediate placement momentum compared to long-term trends.'
          }}
          title="Weekly Placements"
          value={analytics?.weeklyAverages.placementsPerWeek ?? 0}
          subtitle="Avg / week"
          icon={TrendingUp}
          color="violet"
        />
      </div>

      {/* Row 2: Program Health Donut Chart + 8-Week Placement Trend Area Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Health Donut Chart Card - 30% Width on desktop */}
        <Card className="border-border/50 shadow-sm overflow-hidden animate-scale-in">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <Activity className="w-4 h-4 text-primary shrink-0" />
                Program Health
                <MetricPopover
                  title="Program Health"
                  description="A high-level health score of the placement program."
                  metrics="Placement Rate, Activity Score, and Risk Ratio."
                  calculation="Score = (Placement Rate * 100) * 0.4 + (100 - Risk Ratio * 100) * 0.3 + Activity Score * 0.3"
                  importance="Gives a quick pulse check on whether the program is running optimally or needs immediate intervention."
                />
              </CardTitle>
              <Select value={healthFilter} onValueChange={(v) => setHealthFilter(v as typeof healthFilter)}>
                <SelectTrigger className="h-7 w-32 text-[10px] border-border/50 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-lg border-border/60">
                  <SelectItem value="all">All Metrics</SelectItem>
                  <SelectItem value="placement">Placement Rate</SelectItem>
                  <SelectItem value="activity">Activity Score</SelectItem>
                  <SelectItem value="risk">At-Risk Ratio</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="pt-2 pb-5 flex flex-col items-center gap-3">
            <HealthDonutChart
              healthScore={healthScore}
              filter={healthFilter}
              avgPlacementRate={avgPlacementRate}
              avgActivityScore={avgActivityScore}
              totalAtRisk={totalAtRisk}
              totalMentees={totalMentees}
            />
          </CardContent>
        </Card>

        {/* 8-Week Trend - 70% Width on desktop */}
        <Card className="border-border/50 shadow-sm animate-fade-up lg:col-span-2">
          <CardHeader className="pb-2 pt-4 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                <TrendingUp className="w-4 h-4 text-indigo-500 shrink-0" />
                8-Week Placement Trend
                <MetricPopover
                  title="8-Week Placement Trend"
                  description="Visualizes student placement outcomes and rolling totals over the last 8 weeks."
                  metrics="Placed Students, At-Risk Students, and Total Active."
                  calculation="Rolling 8-week historical count mapped to timeline."
                  importance="Reveals positive or negative momentum in overall program outcomes."
                />
              </CardTitle>
              {/* Filter controls */}
              <div className="flex items-center gap-1 bg-muted/60 rounded-xl p-0.5 border border-border/30">
                {(['week', 'month', '3months', 'all'] as const).map((range) => {
                  const labels = { week: 'Week', month: 'Month', '3months': '3 Mo', all: 'All Time' };
                  return (
                    <button
                      key={range}
                      onClick={() => setTrendRange(range)}
                      className={cn(
                        'px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all',
                        trendRange === range
                          ? 'bg-white dark:bg-card shadow-sm text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {labels[range]}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4">
            {/* Color keys legend */}
            <div className="flex flex-wrap justify-end gap-x-5 gap-y-2 mb-4 px-3 py-2 border border-border/40 rounded-xl bg-muted/20">
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500" />
                <span className="text-[10px] font-bold text-muted-foreground">Placements</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-[10px] font-bold text-muted-foreground">At Risk</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-muted-foreground">Active Pipeline</span>
              </div>
            </div>

            {filteredTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={filteredTrendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradPlacement" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="gradRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 10, fontWeight: 500 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fontWeight: 500 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border)/60)',
                      borderRadius: '12px',
                      fontSize: '11px',
                      boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)',
                    }}
                    formatter={(value, name) => {
                      const labels: Record<string, string> = {
                        Placements: '✅ Placements',
                        'At Risk': '⚠️ At-Risk Students',
                        Active: '🟢 Active Pipeline',
                      };
                      const key = String(name ?? '');
                      return [value, labels[key] ?? key];
                    }}
                    labelFormatter={(label) => `Week of ${label}`}
                    cursor={{ fill: 'hsl(var(--muted) / 0.3)', radius: 8 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Placements"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    fill="url(#gradPlacement)"
                    dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
                    activeDot={{ r: 4.5, fill: '#6366f1' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="At Risk"
                    stroke="#ef4444"
                    strokeWidth={2.5}
                    fill="url(#gradRisk)"
                    dot={{ r: 3, fill: '#ef4444', strokeWidth: 0 }}
                    activeDot={{ r: 4.5, fill: '#ef4444' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="Active"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#gradActive)"
                    dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
                    activeDot={{ r: 4.5, fill: '#10b981' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[260px] flex items-center justify-center">
                <p className="text-xs text-muted-foreground font-semibold">No data for this time period</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Hiring Funnel Card (Conversion Rates) + Mentor Leaderboard Cards (Dynamic Podium) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Hiring Pipeline Funnel - 40% Width (2 columns on desktop) */}
        <div className="lg:col-span-2">
          <Card className="border-border/50 shadow-sm animate-fade-up h-full flex flex-col">
            <CardHeader className="pb-3 pt-4 px-5 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <GitBranch className="w-4 h-4 text-violet-500 shrink-0" />
                  Hiring Pipeline Funnel
                  <MetricPopover
                    title="Hiring Pipeline Funnel"
                    description="Shows the distribution of students across sequential hiring stages."
                    metrics="Learning, Applying, Interviewing, Offer Pending, Placed, Hired."
                    calculation="Total count of active students residing in each specific stage."
                    importance="Identifies bottlenecks in the pipeline where candidates are stalling."
                  />
                </CardTitle>
                <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {totalPipeline + totalHired} total students
                </span>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 flex-1 flex flex-col justify-between gap-4">
              {funnel?.entries ? (
                <>
                  <FunnelPipeline
                    entries={funnel.entries}
                    totalStudents={totalPipeline + totalHired}
                  />
                  <div className="border-t border-border/40 pt-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">
                      Conversion Rates
                    </p>
                    <ConversionMetrics entries={funnel.entries} />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground font-semibold">No funnel records available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Mentor Leaderboard - 60% Width (3 columns on desktop) */}
        <div className="lg:col-span-3">
          <Card className="border-border/50 shadow-sm animate-fade-up h-full flex flex-col">
            <CardHeader className="pb-3 pt-4 px-5 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                  <Award className="w-4 h-4 text-amber-500 shrink-0" />
                  Mentor Leaderboard
                  <span className="text-[10px] text-muted-foreground font-bold">· This Month</span>
                  <MetricPopover
                    title="Mentor Leaderboard"
                    side="bottom"
                    align="end"
                    description="Ranks mentors by a combined performance score."
                    metrics="Activity Score (Tasks, Logs) and Placement Rate (% Hired)."
                    calculation="Combined Score = Activity * 0.4 + Placement * 0.6"
                    importance="Identifies top-performing mentors so their strategies can be shared, and highlights mentors needing support." 
                  />
                </CardTitle>
                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 h-7 text-xs font-bold rounded-lg p-0 pr-1">
                  <Link href="/manager/leaderboard" className="flex items-center gap-1">
                    View All <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5 flex-1 flex flex-col gap-5 justify-between">
              {leaderboardEntries.length > 0 ? (
                <>
                  {/* Dynamic Top-3 Podium pedestals */}
                  <div className="border-b border-border/40 pb-5">
                    <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-3 leading-none">
                      Top Performers Podium
                    </p>
                    <MentorPodiumList entries={leaderboardEntries} />
                  </div>

                  {/* Leaderboard Entries list */}
                  <div className="space-y-2 flex-1">
                    <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-2 leading-none">
                      High Density Leaderboard Rank
                    </p>
                    {leaderboardEntries.slice(0, 5).map((entry, idx) => {
                      const tier = getPerformanceTier(entry.score, entry.placement_rate);
                      const ac = avatarColor(entry.mentor_name);
                      return (
                        <div
                          key={entry.mentor_email}
                          className={cn(
                            'flex items-center gap-3 px-3.5 py-2.5 rounded-xl border transition-all duration-200 hover:shadow-sm group',
                            idx < 3
                              ? 'bg-gradient-to-r from-white to-muted/20 border-border/70 dark:from-card dark:to-muted/5'
                              : 'bg-background border-border/50 hover:bg-muted/15'
                          )}
                        >
                          <span className="w-6 shrink-0 text-center font-bold text-xs text-muted-foreground">
                            {idx < 3 ? MEDAL[idx + 1] : idx + 1}
                          </span>
                          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 border border-border/30', ac)}>
                            {getInitials(entry.mentor_name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-foreground leading-tight truncate">
                                {entry.mentor_name}
                              </span>
                              <span className={cn(
                                'text-[9px] font-black px-1.5 py-0.5 rounded-full border leading-none shrink-0 scale-90 origin-left',
                                TIER_STYLES[tier]
                              )}>
                                <span className={cn('inline-block w-1 h-1 rounded-full mr-1 align-middle', TIER_DOT[tier])} />
                                {tier}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
                              {entry.total_students} mentees · <span className="text-emerald-600 font-semibold">{entry.hired} hired</span>
                            </p>
                          </div>
                          <div className="w-16 shrink-0 text-right">
                            <span className="text-xs font-black text-foreground">{entry.score}</span>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase leading-none mt-0.5">Score</p>
                          </div>
                          <div className="w-16 shrink-0 text-right">
                            <span className="text-xs font-black text-emerald-600">{entry.placement_rate}%</span>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase leading-none mt-0.5">Placed</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground font-semibold">No leaderboard metrics available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Row 4: Detailed Analytics Table */}
      <div className="animate-fade-up">
        <DetailedAnalyticsTable
          mentors={mentors}
          cohorts={analytics?.cohort ?? []}
        />
      </div>
    </div>
  );
}

/* ─── Health Donut Chart ─────────────────────────────────────────────────── */

function getHealthLabel(score: number) {
  if (score >= 80) return { label: 'Excellent', color: '#10b981' };
  if (score >= 60) return { label: 'Good',      color: '#6366f1' };
  if (score >= 40) return { label: 'Fair',      color: '#f59e0b' };
  return { label: 'Needs Attention', color: '#ef4444' };
}

interface HealthDonutChartProps {
  healthScore: number;
  filter: 'all' | 'placement' | 'activity' | 'risk';
  avgPlacementRate: number;
  avgActivityScore: number;
  totalAtRisk: number;
  totalMentees: number;
}

function HealthDonutChart({
  healthScore, filter, avgPlacementRate, avgActivityScore, totalAtRisk, totalMentees,
}: HealthDonutChartProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const { label: healthLabel, color: healthColor } = getHealthLabel(healthScore);
  const atRiskPct = totalMentees > 0 ? Math.round((totalAtRisk / totalMentees) * 100) : 0;

  // --- All Metrics Mode ---
  if (filter === 'all') {
    const segments = [
      { name: 'placement', label: 'Placement Rate', value: avgPlacementRate, fill: '#10b981' },
      { name: 'activity',  label: 'Activity Score', value: avgActivityScore, fill: '#6366f1' },
      { name: 'risk',      label: 'At-Risk Ratio',  value: atRiskPct,        fill: '#ef4444' },
    ];

    const chartConfig: ChartConfig = Object.fromEntries(
      segments.map(s => [s.name, { label: s.label, color: s.fill }])
    );

    const active = segments[activeIndex] ?? segments[0];
    const activeDisplay = active.name === 'activity' ? String(active.value) : `${active.value}%`;

    const renderShape = (props: {
      cx: number; cy: number; innerRadius: number; outerRadius: number;
      startAngle: number; endAngle: number; fill: string; index: number;
    }) => {
      const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, index } = props;
      const isActive = index === activeIndex;
      return (
        <g>
          {index === 0 && (
            <>
              <text x={cx} y={cy - 12} textAnchor="middle" dominantBaseline="middle"
                style={{ fontSize: 26, fontWeight: 900, fill: active.fill }}>
                {activeDisplay}
              </text>
              <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="middle"
                style={{ fontSize: 11, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }}>
                {active.label}
              </text>
            </>
          )}
          <Sector cx={cx} cy={cy} innerRadius={innerRadius}
            outerRadius={isActive ? outerRadius + 8 : outerRadius}
            startAngle={startAngle} endAngle={endAngle} fill={fill} />
        </g>
      );
    };

    return (
      <div className="flex flex-col items-center w-full">
        <ChartContainer config={chartConfig} className="h-[220px] w-full max-w-[260px]">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  nameKey="label"
                  formatter={(value, _name, item) => (
                    <div className="flex flex-col gap-1">
                      <span className="font-bold text-xs" style={{ color: item.payload.fill }}>
                        {item.payload.label}
                      </span>
                      <span className="text-[10px] font-semibold text-muted-foreground">
                        {item.payload.name === 'activity' ? String(value) : `${value}%`}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Pie
              data={segments}
              cx="50%" cy="50%"
              innerRadius={70} outerRadius={92}
              dataKey="value" nameKey="label"
              strokeWidth={3} stroke="hsl(var(--card))"
              shape={renderShape as any}
              onMouseEnter={(data: any) => setActiveIndex(Number(data?.index ?? 0))}
            >
              {segments.map((entry, index) => (
                <Cell key={index} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        {/* Custom Legend */}
        <div className="flex items-center justify-center gap-4 mt-2">
          {segments.map((seg, i) => (
            <button key={seg.name} className="flex items-center gap-1.5"
              onMouseEnter={() => setActiveIndex(i)}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0 transition-transform"
                style={{ backgroundColor: seg.fill, transform: activeIndex === i ? 'scale(1.2)' : 'scale(1)' }} />
              <span className={cn('text-[10px] transition-colors',
                activeIndex === i ? 'text-foreground font-black' : 'text-muted-foreground font-semibold')}>
                {seg.label}
              </span>
            </button>
          ))}
        </div>

        {/* Footer info */}
        <div className="text-center mt-4 border-t border-border/40 pt-3 w-full">
          <p className="text-sm font-black" style={{ color: healthColor }}>
            {healthLabel} · {healthScore} / 100
          </p>
          <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Overall Program Health Score</p>
        </div>
      </div>
    );
  }

  // --- Single Metric Mode ---
  const metricMap = {
    placement: { value: avgPlacementRate, label: `${avgPlacementRate}%`, sublabel: 'Placement Rate', color: '#10b981', trackColor: 'rgba(16,185,129,0.15)' },
    activity:  { value: avgActivityScore, label: String(avgActivityScore), sublabel: 'Activity Score', color: '#6366f1', trackColor: 'rgba(99,102,241,0.15)' },
    risk:      { value: atRiskPct, label: `${atRiskPct}%`, sublabel: 'At-Risk Ratio', color: '#ef4444', trackColor: 'rgba(239,68,68,0.15)' },
  };

  const metric = metricMap[filter];
  const filled = Math.min(100, Math.max(0, metric.value));
  const singleData = [
    { name: 'filled', label: metric.sublabel, value: filled,       fill: metric.color },
    { name: 'empty',  label: 'Remaining',     value: 100 - filled, fill: metric.trackColor },
  ];

  const chartConfig: ChartConfig = {
    filled: { label: metric.sublabel, color: metric.color },
    empty:  { label: 'Remaining',    color: metric.trackColor },
  };

  const renderSingleShape = (props: {
    cx: number; cy: number; innerRadius: number; outerRadius: number;
    startAngle: number; endAngle: number; fill: string; index: number;
  }) => {
    const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, index } = props;
    return (
      <g>
        {index === 0 && (
          <>
            <text x={cx} y={cy - 12} textAnchor="middle" dominantBaseline="middle"
              style={{ fontSize: 26, fontWeight: 900, fill: metric.color }}>
              {metric.label}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="middle"
              style={{ fontSize: 11, fontWeight: 700, fill: 'hsl(var(--muted-foreground))' }}>
              {metric.sublabel}
            </text>
          </>
        )}
        <Sector cx={cx} cy={cy} innerRadius={innerRadius}
          outerRadius={index === 0 ? outerRadius + 8 : outerRadius}
          startAngle={startAngle} endAngle={endAngle} fill={fill} />
      </g>
    );
  };

  return (
    <div className="flex flex-col items-center w-full">
      <ChartContainer config={chartConfig} className="h-[220px] w-full max-w-[260px]">
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(_value, name) =>
                  name === 'filled' ? (
                    <span className="font-bold text-xs" style={{ color: metric.color }}>
                      {metric.sublabel}: {metric.label}
                    </span>
                  ) : null
                }
              />
            }
          />
          <Pie
            data={singleData}
            cx="50%" cy="50%"
            innerRadius={70} outerRadius={92}
            dataKey="value"
            strokeWidth={3} stroke="hsl(var(--card))"
            shape={renderSingleShape as any}
          >
            {singleData.map((entry, index) => (
              <Cell key={index} fill={entry.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      {/* Footer info */}
      <div className="text-center mt-4 border-t border-border/40 pt-3 w-full">
        <p className="text-sm font-black" style={{ color: healthColor }}>
          {healthLabel} · {healthScore} / 100
        </p>
        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">Overall Program Health Score</p>
      </div>
    </div>
  );
}

/* ─── Top-3 Leaderboard Podium Component ─────────────────────────────────── */

function MentorPodiumList({ entries }: { entries: any[] }) {
  const top3 = entries.slice(0, 3);
  if (top3.length === 0) return null;

  // SILVER (2nd), GOLD (1st), BRONZE (3rd)
  const order = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;

  const heights = [ 'h-16', 'h-24', 'h-12' ];
  const bgColors = [
    'bg-gradient-to-b from-slate-200 to-slate-300 dark:from-slate-800 dark:to-slate-900 border-slate-300 dark:border-slate-800',
    'bg-gradient-to-b from-amber-200 to-amber-300 dark:from-amber-800/80 dark:to-amber-900/60 border-amber-300 dark:border-amber-800',
    'bg-gradient-to-b from-orange-200 to-orange-300 dark:from-orange-850 dark:to-orange-950 border-orange-300 dark:border-orange-900',
  ];

  return (
    <div className="flex items-end justify-center gap-4 pt-3 max-w-sm mx-auto">
      {order.map((entry, idx) => {
        const podIdx = order.length === 3 ? idx : (entry.rank === 1 ? 1 : (entry.rank === 2 ? 0 : 2));
        const tier = getPerformanceTier(entry.score, entry.placement_rate);
        const ac = avatarColor(entry.mentor_name);

        return (
          <div key={entry.mentor_email} className="flex flex-col items-center flex-1 min-w-0">
            {/* Podium bubble info */}
            <div className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl bg-muted/40 border border-border/40 shadow-sm w-full text-center mb-2">
              <span className="text-base select-none leading-none">{MEDAL[entry.rank]}</span>
              
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold border border-border/30 shadow-inner', ac)}>
                {getInitials(entry.mentor_name)}
              </div>
              
              <p className="text-[10px] font-black text-foreground truncate w-full leading-tight">
                {entry.mentor_name.split(' ')[0]}
              </p>
              
              <span className={cn(
                'text-[8px] font-black px-1.5 py-0.5 rounded-full border leading-none scale-90 select-none uppercase tracking-wide shrink-0',
                TIER_STYLES[tier]
              )}>
                {tier.split(' ')[0]}
              </span>
              
              <span className="text-xs font-black text-emerald-600 leading-none mt-1">
                {entry.placement_rate}%
              </span>
            </div>

            {/* Podium Block element */}
            <div className={cn(
              'w-full rounded-t-xl border border-b-0 flex flex-col items-center justify-center shadow-inner shrink-0',
              heights[podIdx],
              bgColors[podIdx]
            )}>
              <span className="text-sm font-black text-foreground/80 dark:text-foreground/90">
                #{entry.rank}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Skeleton Screen Loader Component ──────────────────────────────────── */

function ManagerDashboardSkeleton() {
  return (
    <div className="space-y-6 pb-10">
      {/* KPI Stats cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-[110px] rounded-2xl border" />
        ))}
      </div>

      {/* Health and Trend row skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-[360px] rounded-2xl" />
        <Skeleton className="lg:col-span-2 h-[360px] rounded-2xl" />
      </div>

      {/* Funnel and Leaderboard row skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Skeleton className="lg:col-span-2 h-[520px] rounded-2xl" />
        <Skeleton className="lg:col-span-3 h-[520px] rounded-2xl" />
      </div>

      {/* Table skeleton */}
      <Skeleton className="h-[400px] rounded-2xl" />
    </div>
  );
}
