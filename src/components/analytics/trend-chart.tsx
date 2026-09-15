/**
 * WHY this file exists:
 * Weekly trend line chart for placements and at-risk counts over 8 weeks.
 * Extracted so it can appear in both the full analytics page and the
 * manager dashboard overview without code duplication.
 */

import {
  LineChart, Line, XAxis, YAxis,
} from 'recharts';
import {
  ChartContainer, ChartTooltip,
} from '@/components/ui/chart';
import type { TrendEntry } from '@/lib/analytics/engine';

interface TrendChartProps {
  data: TrendEntry[];
  weeklyAvgPlacements: number;
}

export function TrendChart({ data, weeklyAvgPlacements }: TrendChartProps) {
  const chartConfig = {
    placements: { label: 'Placements', color: 'hsl(142 71% 45%)' },
    atRisk: { label: 'At Risk', color: 'hsl(25 95% 55%)' },
  };

  return (
    <div className="space-y-2">
      <ChartContainer config={chartConfig} className="h-[240px] w-full">
        <LineChart data={data} margin={{ top: 4, right: 16, left: -20, bottom: 4 }}>
          <XAxis
            dataKey="week"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={24}
          />
          <ChartTooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl space-y-1">
                  <p className="font-semibold text-foreground">Week of {label}</p>
                  {payload.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-muted-foreground">
                        {entry.name === 'placements' ? '✅ Placements' : '⚠️ At-Risk'}:
                      </span>
                      <span className="font-medium text-foreground">{entry.value}</span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          <Line
            type="monotone"
            dataKey="placements"
            stroke="hsl(142 71% 45%)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'hsl(142 71% 45%)' }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="atRisk"
            stroke="hsl(25 95% 55%)"
            strokeWidth={2}
            strokeDasharray="4 2"
            dot={{ r: 2, fill: 'hsl(25 95% 55%)' }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ChartContainer>
      <div className="flex items-center gap-4 text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-emerald-500 rounded-full inline-block" />
          Placements
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-amber-500 rounded-full inline-block border-dashed" />
          At-Risk count
        </span>
        <span className="ml-auto">
          ~{weeklyAvgPlacements} placements/week avg
        </span>
      </div>
    </div>
  );
}