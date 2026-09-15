'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricPopover } from '@/components/shared/metric-popover';
import { Sparkles, TrendingUp, AlertCircle, Calendar } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ForecastInsightsProps {
  funnel: {
    entries: any[];
    totalInPipeline: number;
    totalHired: number;
  };
  weeklyAverages: {
    placementsPerWeek: number;
    atRiskPerWeek: number;
  };
}

export function ForecastInsights({ funnel, weeklyAverages }: ForecastInsightsProps) {
  const calculations = useMemo(() => {
    const activeStats = Object.fromEntries(funnel.entries.map(e => [e.stage, e.count]));
    const learning = activeStats.learning || 0;
    const applying = activeStats.applying || 0;
    const interviewing = activeStats.interviewing || 0;
    const offerPending = activeStats.offer_pending || 0;

    const weightedProjected = Math.round(
      (offerPending * 0.6) + (interviewing * 0.3) + (applying * 0.1) + (learning * 0.02)
    );

    const runRateProjected = weeklyAverages.placementsPerWeek * 4;

    return { weightedProjected, runRateProjected, learning, applying, interviewing, offerPending };
  }, [funnel, weeklyAverages]);

  return (
    <Card className="border-border/50 shadow-sm relative overflow-hidden bg-card/60">
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
          Predictive Forecasting
          <MetricPopover
            title="Predictive Forecasting"
            description="Forecasting calculations projecting potential placements in the next 30 days."
            metrics="Aggregates student pipelines and historical run-rates."
            calculation="Weighted projected = (Offer * 0.6) + (Interviewing * 0.3) + (Applying * 0.1) + (Learning * 0.02)."
            importance="Allows management to anticipate resource needs, align corporate hiring partners, and flag low-growth cohorts early."
          />
        </CardTitle>
        <p className="text-xs text-muted-foreground">Mathematical forecasting & pipeline health indices</p>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ForecastMetricBox
            title="Pipeline-Weighted Forecast"
            value={`${calculations.weightedProjected}`}
            subtitle="Based on active status stages"
            icon={TrendingUp}
            color="emerald"
            progress={Math.min(100, (calculations.weightedProjected / Math.max(1, funnel.totalInPipeline)) * 100)}
          />
          <ForecastMetricBox
            title="Run-Rate Velocity Forecast"
            value={`${calculations.runRateProjected}`}
            subtitle="Based on 8-week historical averages"
            icon={Calendar}
            color="indigo"
            progress={Math.min(100, (calculations.runRateProjected / Math.max(1, funnel.totalInPipeline)) * 100)}
          />
        </div>
        <ForecastPipelineDetails calculations={calculations} />
      </CardContent>
    </Card>
  );
}

function ForecastMetricBox({ title, value, subtitle, icon: Icon, color, progress }: { title: string; value: string; subtitle: string; icon: any; color: 'emerald' | 'indigo'; progress: number }) {
  const barClass = color === 'emerald' ? 'bg-emerald-500' : 'bg-indigo-500';
  const textClass = color === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400';

  return (
    <div className="bg-background/40 border border-border/40 p-4 rounded-xl space-y-3 relative z-10">
      <div className="flex justify-between items-start">
        <div>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{title}</span>
          <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        <Icon className={`w-4 h-4 ${textClass}`} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-3xl font-extrabold ${textClass} tabular-nums`}>{value}</span>
        <span className="text-xs text-muted-foreground font-semibold">placements</span>
      </div>
      <div className="space-y-1">
        <Progress value={progress} className={`h-1.5 ${barClass}`} />
        <p className="text-[10px] text-muted-foreground text-right font-medium">Conversion velocity ratio: {Math.round(progress)}%</p>
      </div>
    </div>
  );
}

function ForecastPipelineDetails({ calculations }: { calculations: any }) {
  return (
    <div className="bg-muted/30 border border-border/20 rounded-xl p-4 flex gap-4 flex-wrap justify-between items-center text-xs">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-blue-500" />
        <span className="text-muted-foreground">Weighted factor weights:</span>
      </div>
      <div className="flex gap-4 flex-wrap text-[11px] font-mono">
        <span>Offer (60%): <strong className="text-foreground font-semibold">{calculations.offerPending}</strong></span>
        <span>Intv. (30%): <strong className="text-foreground font-semibold">{calculations.interviewing}</strong></span>
        <span>Apply (10%): <strong className="text-foreground font-semibold">{calculations.applying}</strong></span>
        <span>Learn (2%): <strong className="text-foreground font-semibold">{calculations.learning}</strong></span>
      </div>
    </div>
  );
}
