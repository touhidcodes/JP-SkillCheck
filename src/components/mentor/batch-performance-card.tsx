'use client';

import { useState } from 'react';
import { CartesianGrid, XAxis, BarChart, Bar } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { MetricPopover } from '@/components/shared/metric-popover';

const batchConfig = {
  views: { label: "Students" },
  placement: { label: "Placement Rate", color: "#7C3AED" },
  total: { label: "Total Students", color: "#3B82F6" },
  hired: { label: "Placed Students", color: "#10B981" },
};

interface BatchPerformanceCardProps {
  batchData: { batch: string; placement: number; total: number; hired: number }[];
}

interface MetricButtonProps {
  metric: 'placement' | 'total' | 'hired';
  active: boolean;
  value: string | number;
  onClick: () => void;
}

function BatchMetricButton({ metric, active, value, onClick }: MetricButtonProps) {
  const activeBorders: Record<'placement' | 'total' | 'hired', string> = {
    placement: 'border-b-2 border-b-purple-500 dark:border-b-purple-400',
    total: 'border-b-2 border-b-blue-500 dark:border-b-blue-400',
    hired: 'border-b-2 border-b-emerald-500 dark:border-b-emerald-400',
  };

  return (
    <button
      data-active={active}
      className={`relative flex flex-1 flex-col justify-center gap-1 border-t px-4 py-3 text-left even:border-l sm:border-t-0 sm:border-l sm:px-6 sm:py-4 transition-all duration-300 ${
        active 
          ? 'bg-slate-50/80 dark:bg-muted/30 font-black' 
          : 'bg-transparent hover:bg-muted/10 font-medium'
      }`}
      onClick={onClick}
    >
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-bold">
        {batchConfig[metric].label}
      </span>
      <span className="text-lg leading-none font-black text-slate-900 dark:text-white sm:text-2xl mt-0.5">
        {value}
      </span>
      {/* Premium subtle bottom active border accent */}
      {active && (
        <span className={`absolute bottom-0 left-0 right-0 h-[3px] transition-all duration-300 ${activeBorders[metric]}`} />
      )}
    </button>
  );
}

export function BatchPerformanceCard({ batchData }: BatchPerformanceCardProps) {
  const [activeMetric, setActiveMetric] = useState<'placement' | 'total' | 'hired'>("placement");

  const totals = {
    placement: batchData.length > 0 ? Math.round(batchData.reduce((acc, curr) => acc + curr.placement, 0) / batchData.length) : 0,
    total: batchData.reduce((acc, curr) => acc + curr.total, 0),
    hired: batchData.reduce((acc, curr) => acc + curr.hired, 0),
  };

  return (
    <Card className="flex flex-col rounded-2xl border border-border/50 bg-card shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden h-full group">
      <CardHeader className="flex flex-col items-stretch border-b border-border/50 p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-4 sm:py-5">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Batch Comparison</CardTitle>
            <MetricPopover
              title="Batch Performance"
              description="Placement rate and student count by batch/cohort. Compare performance across different groups."
              metrics="Students grouped by batch, with placement rate = (Placed + Hired) / Total × 100"
              calculation="For each batch: (COUNT(stage IN [placed, hired]) / COUNT(total)) × 100"
              importance="Identifies which batches need more support. Batches with <30% placement rate need curriculum or mentoring review."
            />
          </div>
          <CardDescription className="text-xs text-muted-foreground font-semibold">
            Performance across student cohorts
          </CardDescription>
        </div>
        <div className="flex border-t border-border/50 sm:border-t-0">
          {(['placement', 'total', 'hired'] as const).map((key) => (
            <BatchMetricButton
              key={key}
              metric={key}
              active={activeMetric === key}
              value={key === 'placement' ? `${totals[key]}%` : totals[key].toLocaleString()}
              onClick={() => setActiveMetric(key)}
            />
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-2 pt-6 pb-4 sm:px-6 min-h-[220px]">
        <ChartContainer id="batch-interactive" config={batchConfig} className="aspect-auto h-full min-h-[180px] w-full">
          <BarChart accessibilityLayer data={batchData} margin={{ left: 12, right: 12, top: 10, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-muted/20" />
            <XAxis
              dataKey="batch"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              className="text-[10px] font-bold text-muted-foreground"
              tickFormatter={(value) => value.replace("batch-", "")}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[150px] rounded-xl border border-border/60 bg-card/95 shadow-md text-xs font-semibold"
                  nameKey="views"
                />
              }
            />
            <Bar
              dataKey={activeMetric}
              fill={batchConfig[activeMetric].color}
              radius={[6, 6, 0, 0]}
              maxBarSize={45}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
