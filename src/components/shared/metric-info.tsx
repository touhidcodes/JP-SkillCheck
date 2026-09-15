import { Info } from "lucide-react";
import {
  TooltipProvider,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import React from "react";

interface MetricInfoProps {
  description: string;
  metrics: string;
  calculation: string;
  importance: string;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}

export function MetricInfo({
  description,
  metrics,
  calculation,
  importance,
  className,
  side = "right"
}: MetricInfoProps) {
  return (
    <TooltipProvider delay={0}>
      <Tooltip>
        <TooltipTrigger render={<span />}>
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center p-1 text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-full hover:bg-muted/50",
              className
            )}
          >
            <Info className="h-4 w-4" />
            <span className="sr-only">Information about this metric</span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          sideOffset={8}
          className="max-w-sm p-4 shadow-lg border border-border/50 bg-background"
        >
          <div className="flex flex-col gap-3 text-xs">
            <div>
              <p className="font-semibold text-foreground mb-1">Description</p>
              <p className="text-muted-foreground">{description}</p>
            </div>
            <div className="border-t border-border/30 pt-2">
              <p className="font-semibold text-foreground mb-1">📊 Data Sources</p>
              <p className="text-muted-foreground">{metrics}</p>
            </div>
            <div className="border-t border-border/30 pt-2">
              <p className="font-semibold text-foreground mb-1">🧮 Calculation</p>
              <code className="bg-muted px-2 py-1 rounded text-xs text-muted-foreground block break-words">{calculation}</code>
            </div>
            <div className="border-t border-border/30 pt-2">
              <p className="font-semibold text-foreground mb-1">⭐ Why it matters</p>
              <p className="text-muted-foreground">{importance}</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
