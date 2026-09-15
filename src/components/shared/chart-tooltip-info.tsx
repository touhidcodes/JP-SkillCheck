'use client';

import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ChartTooltipInfoProps {
  title: string;
  description: string;
  metrics?: string;
  calculation?: string;
  importance?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

/**
 * Reusable info tooltip for charts and analytics components.
 * Displays detailed information about what a chart measures and why it matters.
 */
export function ChartTooltipInfo({
  title,
  description,
  metrics,
  calculation,
  importance,
  side = 'right',
}: ChartTooltipInfoProps) {
  return (
    <TooltipProvider delay={0}>
      <Tooltip>
        <TooltipTrigger render={<span />}>
          <button
            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 hover:text-blue-700 transition-colors cursor-help"
            aria-label={`Information about ${title}`}
          >
            <Info className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent 
          side={side} 
          sideOffset={8}
          className="max-w-sm p-4 shadow-lg border border-border/50 bg-background"
        >
          <div className="space-y-3">
            <div>
              <p className="font-semibold text-foreground text-sm">{title}</p>
            </div>
            <div className="border-t border-border/30 pt-2">
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            {metrics && (
              <div className="border-t border-border/30 pt-2">
                <p className="text-xs font-semibold text-foreground mb-1">📊 Metrics:</p>
                <p className="text-xs text-muted-foreground">{metrics}</p>
              </div>
            )}
            {calculation && (
              <div className="border-t border-border/30 pt-2">
                <p className="text-xs font-semibold text-foreground mb-1">🧮 Calculation:</p>
                <code className="bg-muted px-2 py-1 rounded text-xs text-muted-foreground block break-words">{calculation}</code>
              </div>
            )}
            {importance && (
              <div className="border-t border-border/30 pt-2">
                <p className="text-xs font-semibold text-foreground mb-1">⭐ Why it matters:</p>
                <p className="text-xs text-muted-foreground">{importance}</p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
