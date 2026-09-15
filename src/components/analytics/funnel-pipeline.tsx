'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  LabelList,
  CartesianGrid,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { cn } from '@/lib/utils';

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface FunnelStage {
  stage: string;
  label: string;
  count: number;
  dropoffPct: number;
}

interface FunnelPipelineProps {
  entries: FunnelStage[];
  totalStudents: number;
}

/* ─── Stage colour map ───────────────────────────────────────────────────── */

const STAGE_COLORS: Record<string, string> = {
  learning:      'hsl(220 14% 55%)',   // slate
  applying:      'hsl(217 91% 60%)',   // blue
  interviewing:  'hsl(262 83% 62%)',   // violet
  offer_pending: 'hsl(38 92% 52%)',    // amber
  placed:        'hsl(142 71% 45%)',   // emerald
  hired:         'hsl(142 76% 36%)',   // green
};

/* ─── Main component ─────────────────────────────────────────────────────── */

export function FunnelPipeline({ entries, totalStudents }: FunnelPipelineProps) {
  if (!entries.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No pipeline data available
      </p>
    );
  }

  /* Build chart data */
  const chartData = entries.map(e => ({
    stage: e.stage,
    label: e.label,
    count: e.count,
    pct: totalStudents > 0 ? Math.round((e.count / totalStudents) * 100) : 0,
    fill: STAGE_COLORS[e.stage] ?? 'hsl(220 14% 55%)',
  }));

  /* shadcn ChartConfig — one key per stage */
  const chartConfig: ChartConfig = Object.fromEntries(
    entries.map(e => [
      e.stage,
      { label: e.label, color: STAGE_COLORS[e.stage] ?? 'hsl(220 14% 55%)' },
    ]),
  );

  return (
    <div className="space-y-4">
      {/* Vertical bar chart */}
      <ChartContainer config={chartConfig} className="h-[400px] w-full">
        <BarChart
          data={chartData}
          margin={{ top: 24, right: 8, left: 8, bottom: 2 }}
          barCategoryGap="28%"
        >
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fontWeight: 600, fill: 'hsl(var(--muted-foreground))' }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            allowDecimals={false}
          />
          <ChartTooltip
            cursor={{ fill: 'hsl(var(--muted) / 0.4)', radius: 6 }}
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(value, name, item) => (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-foreground">
                      {item.payload.label}
                    </span>
                    <span className="text-muted-foreground">
                      {value} students · {item.payload.pct}%
                    </span>
                  </div>
                )}
              />
            }
          />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56}>
            {chartData.map(entry => (
              <Cell key={entry.stage} fill={entry.fill} />
            ))}
            <LabelList
              dataKey="count"
              position="top"
              style={{
                fontSize: 12,
                fontWeight: 500,
                fill: 'hsl(var(--foreground))',
              }}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </div>
  );
}


interface ConversionMetricsProps {
  entries: FunnelStage[];
}

export function ConversionMetrics({ entries }: ConversionMetricsProps) {
  const stageMap = new Map(entries.map(e => [e.stage, e.count]));

  const conversions = [
    {
      from: 'Applying → Interview',
      rate: stageMap.get('applying') && stageMap.get('interviewing')
        ? Math.round(((stageMap.get('interviewing') ?? 0) / Math.max(1, stageMap.get('applying') ?? 0)) * 100)
        : 0,
    },
    {
      from: 'Interview → Offer',
      rate: stageMap.get('interviewing') && stageMap.get('offer_pending')
        ? Math.round(((stageMap.get('offer_pending') ?? 0) / Math.max(1, stageMap.get('interviewing') ?? 0)) * 100)
        : 0,
    },
    {
      from: 'Offer → Hired',
      rate: stageMap.get('offer_pending') && stageMap.get('hired')
        ? Math.round(((stageMap.get('hired') ?? 0) / Math.max(1, stageMap.get('offer_pending') ?? 0)) * 100)
        : 0,
    },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {conversions.map(c => (
          <div
            key={c.from}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/50 border border-border/50"
          >
            <span className="text-xs text-muted-foreground">{c.from}</span>
            <span
              className={cn(
                'text-sm font-base tabular-nums',
                c.rate >= 70 ? 'text-emerald-600' : c.rate >= 40 ? 'text-amber-600' : 'text-red-500',
              )}
            >
              {c.rate}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
