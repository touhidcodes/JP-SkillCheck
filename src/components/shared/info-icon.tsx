'use client';

import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface InfoIconProps {
  title: string;
  description: string;
  metrics?: string;
  calculation?: string;
  importance?: string;
}

export function InfoIcon({
  title,
  description,
  metrics,
  calculation,
  importance,
}: InfoIconProps) {
  return (
    <TooltipProvider delay={0}>
      <Tooltip>
        <TooltipTrigger render={<span />}>
          <div
            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 hover:text-blue-700 transition-colors cursor-help flex-shrink-0"
            role="button"
            tabIndex={0}
            aria-label={`Information about ${title}`}
          >
            <Info className="w-4 h-4" />
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="right" 
          sideOffset={8}
          className="max-w-sm p-4 shadow-lg border border-border/50 bg-background"
        >
          <div className="space-y-3 text-xs">
            <div>
              <p className="font-semibold text-foreground">{title}</p>
            </div>
            <div className="border-t border-border/30 pt-2">
              <p className="text-muted-foreground">{description}</p>
            </div>
            {metrics && (
              <div className="border-t border-border/30 pt-2">
                <p className="font-semibold text-foreground mb-1">📊 Data:</p>
                <p className="text-muted-foreground">{metrics}</p>
              </div>
            )}
            {calculation && (
              <div className="border-t border-border/30 pt-2">
                <p className="font-semibold text-foreground mb-1">🧮 Formula:</p>
                <code className="bg-muted px-2 py-1 rounded text-xs text-muted-foreground block break-words">{calculation}</code>
              </div>
            )}
            {importance && (
              <div className="border-t border-border/30 pt-2">
                <p className="font-semibold text-foreground mb-1">⭐ Why:</p>
                <p className="text-muted-foreground">{importance}</p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
