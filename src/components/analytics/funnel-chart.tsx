import {
  BarChart, Bar, XAxis, YAxis, Cell,
} from 'recharts';
import {
  ChartContainer, ChartTooltip,
} from '@/components/ui/chart';
import type { FunnelEntry } from '@/lib/analytics/engine';

const STAGE_COLORS: Record<string, string> = {
  learning:      'hsl(220 14% 70%)',
  applying:      'hsl(217 91% 65%)',
  interviewing:  'hsl(38 92% 55%)',
  offer_pending: 'hsl(25 95% 55%)',
  placed:        'hsl(142 71% 45%)',
  hired:         'hsl(142 76% 32%)',
};

const STAGE_LABELS: Record<string, string> = {
  learning:      'Learning',
  applying:      'Applying',
  interviewing:  'Interviewing',
  offer_pending: 'Offer Pending',
  placed:        'Placed',
  hired:         'Hired',
};

interface FunnelChartProps {
  data: FunnelEntry[];
  totalInPipeline: number;
  totalPlaced: number;
  totalHired: number;
}

export function FunnelChart({ data, totalInPipeline, totalPlaced, totalHired }: FunnelChartProps) {
  const chartConfig = Object.fromEntries(
    data.map(d => [d.stage, { label: d.stage.replace('_', ' '), color: STAGE_COLORS[d.stage] }])
  );

  const totalStudents = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="space-y-3">
      <ChartContainer config={chartConfig} className="h-[280px] w-full">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 64, left: 8, bottom: 4 }}>
          <XAxis type="number" hide />
          <YAxis
            dataKey="stage"
            type="category"
            tickLine={false}
            axisLine={false}
            width={100}
            tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={v => v.replace('_', ' ')}
          />
          <ChartTooltip
            cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const entry = payload[0].payload as FunnelEntry;
              const pct = totalStudents > 0 ? Math.round((entry.count / totalStudents) * 100) : 0;
              return (
                <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl space-y-1">
                  <p className="font-semibold text-foreground">{STAGE_LABELS[entry.stage]}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Students:</span>
                    <span className="font-medium text-foreground">{entry.count}</span>
                    <span className="text-muted-foreground">({pct}%)</span>
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={22} minPointSize={2}>
            {data.map((entry) => (
              <Cell key={entry.stage} fill={STAGE_COLORS[entry.stage] ?? '#ccc'} />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>{totalInPipeline} active in pipeline</span>
        <span>{totalPlaced} placed · {totalHired} hired</span>
      </div>
    </div>
  );
}