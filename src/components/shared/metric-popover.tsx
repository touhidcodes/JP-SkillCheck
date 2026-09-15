'use client';

import React from 'react';
import { Info, HelpCircle, Database, Calculator, Lightbulb } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface MetricPopoverProps {
  title?: string;
  description: string;
  metrics: string;
  calculation: string;
  importance: string;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

export function MetricPopover({
  title = 'Metric Insights',
  description,
  metrics,
  calculation,
  importance,
  className,
  side = 'bottom',
  align = 'end',
}: MetricPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          'inline-flex items-center justify-center p-1.5 text-muted-foreground/60 transition-all duration-200 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded-full hover:bg-muted/60',
          className
        )}
      >
        <Info className="h-4 w-4" />
        <span className="sr-only">Information about {title}</span>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={8}
        className="w-80 p-0 overflow-hidden rounded-xl border border-border/60 bg-card/95 backdrop-blur-md shadow-xl animate-scale-in z-50"
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border-b border-border/50">
          <HelpCircle className="w-4 h-4 text-primary" />
          <h4 className="text-xs font-bold text-foreground tracking-wide uppercase">
            {title}
          </h4>
        </div>

        {/* Content sections */}
        <div className="p-4 space-y-4 text-xs">
          {/* Description */}
          <div className="space-y-1">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <span className="w-1 h-1.5 rounded bg-primary" />
              Description
            </p>
            <p className="text-muted-foreground leading-relaxed pl-2.5">
              {description}
            </p>
          </div>

          {/* Data Sources */}
          <div className="space-y-1 pt-1 border-t border-border/40">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-500" />
              Data Sources
            </p>
            <p className="text-muted-foreground leading-relaxed pl-5">
              {metrics}
            </p>
          </div>

          {/* Calculation */}
          <div className="space-y-1.5 pt-1 border-t border-border/40">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5 text-violet-500" />
              Formula
            </p>
            <div className="pl-5">
              <code className="block bg-muted/60 dark:bg-muted/30 px-2.5 py-1.5 rounded-lg text-[10px] text-muted-foreground font-mono break-all border border-border/40 leading-normal">
                {calculation}
              </code>
            </div>
          </div>

          {/* Strategic Importance / Actions */}
          <div className="space-y-1 pt-1 border-t border-border/40">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              Operational Strategy
            </p>
            <p className="text-muted-foreground leading-relaxed pl-5">
              {importance}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
