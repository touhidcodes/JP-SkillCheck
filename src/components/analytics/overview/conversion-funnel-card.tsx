'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricPopover } from '@/components/shared/metric-popover';
import { ArrowDown } from 'lucide-react';

interface FunnelItem {
  stage: string;
  label: string;
  count: number;
}

interface ConversionFunnelCardProps {
  funnelData: FunnelItem[];
}

export function ConversionFunnelCard({ funnelData }: ConversionFunnelCardProps) {
  const processedFunnel = useMemo(() => {
    return funnelData.map((entry, idx) => {
      const prevCount = idx === 0 ? entry.count : funnelData[idx - 1].count;
      const dropoff = prevCount > 0 ? Math.round(((prevCount - entry.count) / prevCount) * 100) : 0;
      return { ...entry, dropoffPct: dropoff };
    });
  }, [funnelData]);

  const maxCount = useMemo(() => {
    return Math.max(1, ...funnelData.map(e => e.count));
  }, [funnelData]);

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3 pt-4 px-5">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          Conversion Funnel
          <MetricPopover
            title="Conversion Funnel"
            description="Visual representation of active student volumes progressing through placement stages."
            metrics="Stage totals calculated dynamically from live student states."
            calculation="Step-by-step dropoff rate = ((Previous Stage - Current Stage) / Previous Stage) * 100."
            importance="Pinpoints bottlenecks where students encounter challenges in applying or securing offers."
          />
        </CardTitle>
        <p className="text-xs text-muted-foreground">Progression velocity and drop-off ratios</p>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-4">
        {processedFunnel.map((item, idx) => (
          <React.Fragment key={item.stage}>
            {idx > 0 && <DropoffIndicator percentage={item.dropoffPct} />}
            <FunnelBarRow item={item} maxCount={maxCount} />
          </React.Fragment>
        ))}
      </CardContent>
    </Card>
  );
}

function FunnelBarRow({ item, maxCount }: { item: any; maxCount: number }) {
  const percentageOfMax = Math.round((item.count / maxCount) * 100);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-xs font-semibold text-foreground">
        <span>{item.label}</span>
        <span className="font-bold tabular-nums">{item.count} <span className="text-muted-foreground font-normal">students</span></span>
      </div>
      <div className="w-full h-7 bg-muted/40 rounded-lg overflow-hidden relative border border-border/20">
        <div
          className="h-full bg-gradient-to-r from-primary/80 to-primary rounded-r-md transition-all duration-500 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
          style={{ width: `${Math.max(4, percentageOfMax)}%` }}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-foreground tabular-nums">
          {percentageOfMax}%
        </span>
      </div>
    </div>
  );
}

function DropoffIndicator({ percentage }: { percentage: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
      <ArrowDown className="w-3 h-3 text-red-500 animate-pulse" />
      <span className="bg-red-500/10 border border-red-500/10 px-2 py-0.5 rounded-full text-red-600 dark:text-red-400">
        -{percentage}% drop-off
      </span>
    </div>
  );
}
