/**
 * WHY this file exists:
 * Cohort placement rate chart extracted for reuse. Shows placement rate %
 * per batch/cohort as a bar chart.
 */

import {
  BarChart, Bar, XAxis, YAxis,
} from 'recharts';
import {
  ChartContainer, ChartTooltip,
} from '@/components/ui/chart';
import type { CohortEntry } from '@/lib/analytics/engine';

interface CohortChartProps {
  data: CohortEntry[];
}

export function CohortChart({ data }: CohortChartProps) {
  const chartConfig = {
    placementRate: { label: 'Placement Rate (%)', color: 'hsl(217 91% 65%)' },
  };

  const chartData = data.map(d => ({
    batch: d.batch,
    placementRate: d.placementRate,
    hiredRate: d.hireRate,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <BarChart data={chartData} margin={{ top: 4, right: 16, left: -12, bottom: 4 }}>
        <XAxis
          dataKey="batch"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
          tickFormatter={v => `${v}%`}
        />
        <ChartTooltip
          cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const entry = payload[0].payload;
            return (
              <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl space-y-1">
                <p className="font-semibold text-foreground">{entry.batch}</p>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Placement Rate:</span>
                  <span className="font-medium text-blue-600">{entry.placementRate}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Hire Rate:</span>
                  <span className="font-medium text-emerald-600">{entry.hiredRate}%</span>
                </div>
              </div>
            );
          }}
        />
        <Bar dataKey="placementRate" radius={[4, 4, 0, 0]} barSize={28} fill="hsl(217 91% 65%)" />
      </BarChart>
    </ChartContainer>
  );
}