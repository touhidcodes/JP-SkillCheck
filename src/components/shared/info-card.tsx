'use client';

import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface InfoCardProps {
  title: string;
  description: string;
  metrics?: string;
  calculation?: string;
  importance?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
  variant?: string;
}

/**
 * Info tooltip for charts, cards, and analytics components.
 * Uses base-ui Tooltip with the render prop pattern.
 */
export function InfoCard({
  title,
  description,
  metrics,
  calculation,
  importance,
  side = 'top',
  className,
}: InfoCardProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          className={cn(
            'inline-flex items-center justify-center w-[18px] h-[18px] rounded-full',
            'bg-blue-100 text-blue-600 hover:bg-blue-200 hover:text-blue-700',
            'transition-colors cursor-help shrink-0',
            className,
          )}
          aria-label={`Info: ${title}`}
        >
          <Info className="w-3 h-3" />
        </TooltipTrigger>
        <TooltipContent
          side={side}
          sideOffset={6}
          className={cn(
            'max-w-[300px] p-0 rounded-lg overflow-hidden',
            'border border-slate-200 bg-white text-slate-900 shadow-xl',
          )}
        >
          <div className="bg-slate-900 px-3 py-2">
            <p className="text-xs font-semibold text-white">{title}</p>
          </div>
          <div className="px-3 py-2.5 space-y-2">
            <p className="text-[11px] text-slate-600 leading-relaxed">{description}</p>
            {metrics && (
              <div className="space-y-0.5">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Data</p>
                <p className="text-[11px] text-slate-600 leading-relaxed">{metrics}</p>
              </div>
            )}
            {calculation && (
              <div className="space-y-0.5">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Formula</p>
                <p className="text-[11px] text-slate-700 font-mono bg-slate-50 rounded px-2 py-1 leading-relaxed">{calculation}</p>
              </div>
            )}
            {importance && (
              <div className="space-y-0.5 border-t border-slate-100 pt-2">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Why it matters</p>
                <p className="text-[11px] text-slate-600 leading-relaxed">{importance}</p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
