'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricPopover } from '@/components/shared/metric-popover';
import { Building2 } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList } from 'recharts';
import { ChartContainer, ChartTooltip, type ChartConfig } from '@/components/ui/chart';

interface CompanyEntry {
  company: string;
  interviewCount: number;
  offerCount: number;
  hiredCount: number;
  students: string[];
}

interface CompanyPipelineProps {
  companies: CompanyEntry[];
}

const chartConfig = {
  interviews: {
    label: "Interviews",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export function CompanyPipeline({ companies }: CompanyPipelineProps) {
  const top = useMemo(() => companies.slice(0, 15), [companies]);

  const chartData = useMemo(() => top.map(c => ({
    company: c.company,
    interviews: c.interviewCount,
    offers: c.offerCount,
    hired: c.hiredCount,
  })), [top]);

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3 pt-4 px-5">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Building2 className="w-4 h-4 text-blue-500" />
          Top Hiring Companies
          <MetricPopover
            side="bottom"
            title="Top Hiring Companies"
            description="The most active companies hiring or interviewing students."
            metrics="Sum of progression logs marked as 'Interview Call' or 'Offer', grouped by company name."
            calculation="COUNT(progress_logs WHERE type IN ('Offer', 'Interview Call') GROUP BY company_name) ordered descending"
            importance="Reveals which corporate partnerships are yielding the most opportunities and directs B2B strategy."
          />
        </CardTitle>
        <p className="text-xs text-muted-foreground">Sorted by interview volume</p>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        {companies.length ? (
          <div className="h-[400px] w-full mt-4">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }} barGap={0}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                <XAxis
                  dataKey="company"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))", fontWeight: 600 }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <ChartTooltip cursor={{ fill: 'hsl(var(--muted)/0.2)' }} content={<CustomTooltip />} />
                <Bar dataKey="interviews" fill="var(--color-interviews)" radius={[4, 4, 0, 0]} barSize={50}>
                  <LabelList dataKey="interviews" position="top" offset={10} className="fill-muted-foreground font-bold text-[10px]" />
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.hired > 0 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.5)"}
                      className="transition-all duration-300 hover:opacity-85"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
            <LegendLabels />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">No company data yet</p>
        )}
      </CardContent>
    </Card>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const totalInterviews = data.interviews || 0;
  const offerRate = totalInterviews > 0 ? Math.round((data.offers / totalInterviews) * 100) : 0;
  const hireRate = data.offers > 0 ? Math.round((data.hired / data.offers) * 100) : 0;

  return (
    <div className="bg-card text-card-foreground p-3 rounded-lg border shadow-sm text-xs min-w-[160px] space-y-1.5 z-50">
      <p className="font-bold pb-2 border-b border-border/50">{label}</p>
      <div className="flex justify-between items-center gap-4">
        <span className="text-muted-foreground font-medium">Interviews</span>
        <span className="font-bold">{data.interviews}</span>
      </div>
      {data.offers > 0 && (
        <div className="flex justify-between items-center gap-4">
          <span className="text-amber-600 font-medium">Offers</span>
          <span className="font-bold">{data.offers} <span className="text-muted-foreground font-normal">({offerRate}%)</span></span>
        </div>
      )}
      {data.hired > 0 && (
        <div className="flex justify-between items-center gap-4">
          <span className="text-emerald-600 font-medium">Hired</span>
          <span className="font-bold">{data.hired} <span className="text-muted-foreground font-normal">({hireRate}%)</span></span>
        </div>
      )}
    </div>
  );
}

function LegendLabels() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6 pt-2 pb-2">
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-primary shadow-sm" />
        <span className="text-xs font-bold text-foreground/80 uppercase tracking-tight">Hired / Placed</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-primary/50 shadow-sm" />
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Interviewing</span>
      </div>
    </div>
  );
}
