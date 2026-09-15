'use client';

import { useState, useMemo } from 'react';
import { TrendingUp, AlertTriangle } from 'lucide-react';
import { CartesianGrid, XAxis, YAxis, AreaChart, Area } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { MetricPopover } from '@/components/shared/metric-popover';

const riskConfig = {
  high: { label: "High Risk", color: "#EF4444" },
  medium: { label: "Medium Risk", color: "#F59E0B" },
  safe: { label: "Safe", color: "#10B981" },
};

interface RiskOverTimeCardProps {
  riskTrend: { week: string; safe: number; medium: number; high: number }[];
}

function RiskGradientDefs() {
  return (
    <defs>
      <linearGradient id="fillSafe" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
        <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="fillMedium" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.4} />
        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.02} />
      </linearGradient>
      <linearGradient id="fillHigh" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
        <stop offset="95%" stopColor="#EF4444" stopOpacity={0.02} />
      </linearGradient>
    </defs>
  );
}

function getRiskSummary(riskTrend: any[]) {
  if (riskTrend.length < 2) return { trend: "Risk levels stable", period: "Last few weeks" };
  const latest = riskTrend[riskTrend.length - 1];
  const previous = riskTrend[riskTrend.length - 2];
  const diff = (latest.high || 0) - (previous.high || 0);
  const trendText = diff > 0 
    ? `High risk increased by ${diff}` 
    : diff < 0 ? `High risk decreased by ${Math.abs(diff)}` : "Risk levels are stable";
  return { trend: trendText, period: `${riskTrend[0].week} - ${latest.week}` };
}

export function RiskOverTimeCard({ riskTrend }: RiskOverTimeCardProps) {
  const [timeRange, setTimeRange] = useState("90d");

  const filteredData = useMemo(() => {
    const sliceCount = timeRange === "7d" ? 1 : timeRange === "30d" ? 4 : 8;
    return riskTrend.slice(-sliceCount);
  }, [riskTrend, timeRange]);

  const summary = useMemo(() => getRiskSummary(riskTrend), [riskTrend]);

  // Determine trend color and icon based on high risk differences
  const latestDiff = riskTrend.length >= 2 
    ? (riskTrend[riskTrend.length - 1].high || 0) - (riskTrend[riskTrend.length - 2].high || 0)
    : 0;

  const isRiskIncreasing = latestDiff > 0;
  const isRiskDecreasing = latestDiff < 0;

  return (
    <Card className="flex flex-col rounded-2xl border border-border/50 bg-card shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden h-full group">
      <CardHeader className="flex items-center gap-2 space-y-0 border-b border-border/50 p-5 sm:flex-row">
        <div className="grid flex-1 gap-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Risk Over Time</CardTitle>
            <MetricPopover
              title="Risk Distribution Over Time"
              description="Weekly breakdown of how many students are in each risk level (Safe, Medium, High). Shows risk trajectory."
              metrics="Risk scores recalculated weekly, grouped by risk level (Safe: 0-25, Medium: 26-50, High: 51-100)"
              calculation="For each week: COUNT(students) GROUP BY risk_level"
              importance="Increasing high-risk count means your interventions need adjustment. Decreasing count shows progress."
            />
          </div>
          <CardDescription className="text-xs text-muted-foreground font-semibold">
            Historical risk level distribution
          </CardDescription>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="h-8 w-[140px] rounded-lg pl-2.5 text-xs font-semibold bg-card border-border/50 hover:bg-muted/30 transition-colors">
            <SelectValue placeholder="Last 3 months" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border/60">
            <SelectItem value="90d" className="text-xs font-semibold">Last 3 months</SelectItem>
            <SelectItem value="30d" className="text-xs font-semibold">Last 30 days</SelectItem>
            <SelectItem value="7d" className="text-xs font-semibold">Last 7 days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="flex-1 p-5 pt-6 pb-0 min-h-[220px]">
        <ChartContainer config={riskConfig} className="h-full min-h-[200px] w-full">
          <AreaChart accessibilityLayer data={filteredData} margin={{ left: -10, right: 0, top: 10, bottom: 0 }}>
            <RiskGradientDefs />
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-muted/20" />
            <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={12} className="text-[10px] font-bold text-muted-foreground" />
            <YAxis tickLine={false} axisLine={false} tickMargin={12} tickCount={3} className="text-[10px] font-bold text-muted-foreground" />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" className="rounded-xl border bg-card/95 p-2 font-semibold" />} />
            <Area dataKey="safe" type="natural" fill="url(#fillSafe)" stroke={riskConfig.safe.color} strokeWidth={2} stackId="a" />
            <Area dataKey="medium" type="natural" fill="url(#fillMedium)" stroke={riskConfig.medium.color} strokeWidth={2} stackId="a" />
            <Area dataKey="high" type="natural" fill="url(#fillHigh)" stroke={riskConfig.high.color} strokeWidth={2} stackId="a" />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className="p-5 pt-4 flex-col items-start gap-1 bg-transparent border-t border-border/40">
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
            isRiskIncreasing 
              ? 'bg-red-500/10 text-red-600 dark:text-red-400' 
              : isRiskDecreasing 
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
          }`}>
            {isRiskIncreasing && <AlertTriangle className="h-3.5 w-3.5" />}
            {isRiskDecreasing && <TrendingUp className="h-3.5 w-3.5" />}
            <span className="font-extrabold">{summary.trend}</span>
          </div>
        </div>
        <div className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none mt-2">
          Evaluation Period: {summary.period}
        </div>
      </CardFooter>
    </Card>
  );
}
