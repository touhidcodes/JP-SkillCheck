'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricPopover } from '@/components/shared/metric-popover';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  AreaChart, Area, BarChart, Bar, CartesianGrid,
} from 'recharts';

const MENTOR_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4',
];

interface MonthlyTrendsCardProps {
  mentors: any[];
}

export function MonthlyTrendsCard({ mentors }: MonthlyTrendsCardProps) {
  const [chartView, setChartView] = useState<'placement' | 'pipeline' | 'activity'>('placement');
  const [trendTimeRange, setTrendTimeRange] = useState<'3' | '6' | '12' | 'all'>('6');

  // Chart datasets computed on-demand
  const baseChartData = useMemo(() => {
    if (!mentors.length) return [];
    const labels = mentors[0]?.months.map((m: any) => m.monthLabel) ?? [];
    return labels.map((label: string, i: number) => {
      const point: Record<string, string | number> = { month: label };
      for (const m of mentors.slice(0, 6)) {
        const md = m.months[i];
        if (chartView === 'placement') {
          point[m.mentor_name] = md ? Math.round((md.hired / Math.max(1, md.student_count)) * 100) : 0;
        } else if (chartView === 'pipeline') {
          point[m.mentor_name] = md?.active ?? 0;
        } else {
          point[m.mentor_name] = md ? md.interviews + md.tasks : 0;
        }
      }
      return point;
    });
  }, [mentors, chartView]);

  const filteredData = useMemo(() => {
    if (trendTimeRange === 'all') return baseChartData;
    const n = parseInt(trendTimeRange, 10);
    return baseChartData.slice(-n);
  }, [baseChartData, trendTimeRange]);

  return (
    <Card className="lg:col-span-2 border-border/50 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            Monthly Trends
            <MetricPopover
              title="Monthly Trends"
              description="Compares mentor success rates plotted across a historical timeline."
              metrics="Placement %, Pipeline status, or Activity volume."
              calculation="Time-series generation mapping individual metric values by month."
              importance="Helps visualize performance consistency and long-term momentum."
            />
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <TimeRangePills value={trendTimeRange} onChange={setTrendTimeRange} />
            <MetricTypePills value={chartView} onChange={setChartView} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <div className="h-[360px] w-full">
          {chartView === 'placement' && <TrendsLineChart data={filteredData} mentors={mentors} />}
          {chartView === 'pipeline' && <TrendsAreaChart data={filteredData} mentors={mentors} />}
          {chartView === 'activity' && <TrendsBarChart data={filteredData} mentors={mentors} />}
        </div>
      </CardContent>
    </Card>
  );
}

function TimeRangePills({ value, onChange }: { value: string; onChange: (v: any) => void }) {
  const ranges = ['3', '6', '12', 'all'] as const;
  return (
    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
      {ranges.map(r => (
        <button
          key={r}
          onClick={() => onChange(r)}
          className={cn(
            'px-2.5 py-1 text-[11px] font-medium rounded-md transition-all',
            value === r ? 'bg-white dark:bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {r === 'all' ? 'All' : `${r}M`}
        </button>
      ))}
    </div>
  );
}

function MetricTypePills({ value, onChange }: { value: string; onChange: (v: any) => void }) {
  const views = ['placement', 'pipeline', 'activity'] as const;
  return (
    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
      {views.map(view => (
        <button
          key={view}
          onClick={() => onChange(view)}
          className={cn(
            'px-2.5 py-1 text-[11px] font-medium rounded-md transition-all',
            value === view ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {view === 'placement' ? 'Placement %' : view === 'pipeline' ? 'Pipeline' : 'Activity'}
        </button>
      ))}
    </div>
  );
}

function TrendsLineChart({ data, mentors }: { data: any[]; mentors: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} />
        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} unit="%" />
        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
        <Legend wrapperStyle={{ fontSize: '11px' }} />
        {mentors.slice(0, 6).map((m, i) => (
          <Line
            key={m.mentor_email}
            type="monotone"
            dataKey={m.mentor_name}
            stroke={MENTOR_COLORS[i % MENTOR_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

function TrendsAreaChart({ data, mentors }: { data: any[]; mentors: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} />
        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
        <Legend wrapperStyle={{ fontSize: '11px' }} />
        {mentors.slice(0, 6).map((m, i) => (
          <Area
            key={m.mentor_email}
            type="monotone"
            dataKey={m.mentor_name}
            stroke={MENTOR_COLORS[i % MENTOR_COLORS.length]}
            fill={MENTOR_COLORS[i % MENTOR_COLORS.length]}
            fillOpacity={0.1}
            strokeWidth={2}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TrendsBarChart({ data, mentors }: { data: any[]; mentors: any[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
        <XAxis dataKey="month" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} />
        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
        <Legend wrapperStyle={{ fontSize: '11px' }} />
        {mentors.slice(0, 6).map((m, i) => (
          <Bar
            key={m.mentor_email}
            dataKey={m.mentor_name}
            fill={MENTOR_COLORS[i % MENTOR_COLORS.length]}
            fillOpacity={0.8}
            radius={[3, 3, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
