/**
 * WHY this file exists:
 * Top hiring companies as a donut chart + list. Extracted for reuse and
 * to keep the analytics page manageable in size.
 */

import {
  PieChart, Pie, Cell,
} from 'recharts';
import {
  ChartContainer, ChartTooltip,
} from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';
import type { CompanyEntry } from '@/lib/analytics/engine';

const COLORS = [
  'hsl(217 91% 65%)', 'hsl(38 92% 55%)', 'hsl(142 71% 45%)',
  'hsl(25 95% 55%)', 'hsl(280 65% 60%)', 'hsl(220 14% 55%)',
];

interface CompaniesChartProps {
  data: CompanyEntry[];
}

export function CompaniesChart({ data }: CompaniesChartProps) {
  const chartData = data.slice(0, 6).map(d => ({
    name: d.company,
    value: d.offerCount,
    hires: d.hiredCount,
  }));

  const chartConfig = Object.fromEntries(
    chartData.map((d, i) => [d.name, { label: d.name, color: COLORS[i % COLORS.length] }])
  );

  const totalOffers = chartData.reduce((sum, d) => sum + d.value, 0);
  const totalHires = chartData.reduce((sum, d) => sum + d.hires, 0);

  return (
    <div className="space-y-4">
      <ChartContainer config={chartConfig} className="h-[240px] w-full">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <ChartTooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              const pct = totalOffers > 0 ? Math.round((d.value / totalOffers) * 100) : 0;
              const hireRate = d.value > 0 ? Math.round((d.hires / d.value) * 100) : 0;
              return (
                <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl space-y-1">
                  <p className="font-semibold text-foreground">{d.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Offers:</span>
                    <span className="font-medium text-foreground">{d.value}</span>
                    <span className="text-muted-foreground">({pct}%)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Hired:</span>
                    <span className="font-medium text-emerald-600">{d.hires}</span>
                    <span className="text-muted-foreground">({hireRate}%)</span>
                  </div>
                </div>
              );
            }}
          />
        </PieChart>
      </ChartContainer>
      <div className="space-y-2">
        {data.slice(0, 5).map((c) => (
          <div key={c.company} className="flex items-center justify-between text-xs">
            <span className="text-foreground font-medium truncate mr-2">{c.company}</span>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="text-[10px]">{c.offerCount} offers</Badge>
              {c.hiredCount > 0 && (
                <Badge variant="outline" className="text-[10px] border-emerald-200 text-emerald-600">
                  {c.hiredCount} hired
                </Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}