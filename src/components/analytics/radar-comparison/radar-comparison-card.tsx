'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricPopover } from '@/components/shared/metric-popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, Legend, Tooltip } from 'recharts';

const MENTOR_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4',
];

interface RadarComparisonCardProps {
  mentors: any[];
}

export function RadarComparisonCard({ mentors }: RadarComparisonCardProps) {
  const [radarMetric, setRadarMetric] = useState<'all' | 'Placement' | 'Activity' | 'Pipeline' | 'Growth' | 'Hire Rate'>('all');
  const top4 = useMemo(() => mentors.slice(0, 4), [mentors]);

  const radarData = useMemo(() => {
    if (top4.length < 2) return [];
    const metricsDef = [
      { key: 'Placement', fn: (m: any) => m.current_placement_rate },
      {
        key: 'Activity', fn: (m: any) => {
          const last = m.months[m.months.length - 1];
          return last ? Math.min(100, (last.interviews + last.tasks) * 5) : 0;
        }
      },
      {
        key: 'Pipeline', fn: (m: any) => {
          const last = m.months[m.months.length - 1];
          return last ? Math.min(100, (last.active / Math.max(1, last.student_count)) * 100) : 0;
        }
      },
      {
        key: 'Growth', fn: (m: any) => {
          const total = m.months.reduce((s: number, mo: any) => s + mo.pipeline_growth, 0);
          return Math.min(100, total * 10);
        }
      },
      {
        key: 'Hire Rate', fn: (m: any) => {
          return m.total_students_now > 0 ? Math.round((m.total_hired_all_time / m.total_students_now) * 100) : 0;
        }
      }
    ];

    const mapped = metricsDef.map(d => {
      const row: Record<string, string | number> = { metric: d.key };
      for (const m of top4) {
        row[m.mentor_name.split(' ')[0]] = d.fn(m);
      }
      return row;
    });

    return radarMetric === 'all' ? mapped : mapped.filter(r => r.metric === radarMetric);
  }, [top4, radarMetric]);

  if (top4.length < 2) return null;

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="flex items-start justify-between pb-2 pt-4 px-5">
        <div>
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            Top 4 Comparison
            <MetricPopover
              title="Top 4 Comparison"
              description="Multi-dimensional radar chart comparing key traits of the top 4 mentors."
              metrics="Placement, Activity, Pipeline, Growth, Hire Rate."
              calculation="Normalized multivariate plotting representing relative metric strength."
              importance="Identifies precise strengths/weaknesses uniquely for each top mentor."
            />
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Multi-dimension mentor radar</p>
        </div>
        <RadarSelector value={radarMetric} onChange={setRadarMetric} />
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <RadarChartRender data={radarData} top4={top4} />
      </CardContent>
    </Card>
  );
}

function RadarSelector({ value, onChange }: { value: string; onChange: (v: any) => void }) {
  const items = ['all', 'Placement', 'Activity', 'Pipeline', 'Growth', 'Hire Rate'] as const;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[150px] h-7 text-xs rounded-md">
        <SelectValue placeholder="Select Metric" />
      </SelectTrigger>
      <SelectContent>
        {items.map(item => (
          <SelectItem key={item} value={item}>
            {item === 'all' ? 'All Metrics' : item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function RadarChartRender({ data, top4 }: { data: any[]; top4: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
        {top4.map((m, i) => (
          <Radar
            key={m.mentor_email}
            name={m.mentor_name.split(' ')[0]}
            dataKey={m.mentor_name.split(' ')[0]}
            stroke={MENTOR_COLORS[i % MENTOR_COLORS.length]}
            fill={MENTOR_COLORS[i % MENTOR_COLORS.length]}
            fillOpacity={0.12}
            strokeWidth={2}
          />
        ))}
        <Legend wrapperStyle={{ fontSize: '11px' }} />
        <Tooltip contentStyle={{
          backgroundColor: 'hsl(var(--card))',
          border: '1px solid hsl(var(--border))',
          borderRadius: '8px', fontSize: '11px',
        }} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
