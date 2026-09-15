'use client';

import { useState, useMemo, useCallback } from 'react';
import { Sector, PieChart, Pie, Label } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChartContainer,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { MetricPopover } from '@/components/shared/metric-popover';

const STAGE_COLORS = ["#94A3B8", "#3B82F6", "#F59E0B", "#EAB308", "#10B981", "#059669"];

const stageConfig = {
  learning: { label: "Learning", color: STAGE_COLORS[0] },
  applying: { label: "Applying", color: STAGE_COLORS[1] },
  interviewing: { label: "Interviewing", color: STAGE_COLORS[2] },
  offer_pending: { label: "Offer Pending", color: STAGE_COLORS[3] },
  placed: { label: "Placed", color: STAGE_COLORS[4] },
  hired: { label: "Hired", color: STAGE_COLORS[5] },
};

interface StageDistributionCardProps {
  stageData: { stageId: string; name: string; value: number; fill: string }[];
  totalFiltered: number;
}

function renderPieShape(props: any, activeIndex: number) {
  const { index, outerRadius = 0 } = props;
  if (index === activeIndex) {
    return (
      <g>
        <Sector {...props} outerRadius={outerRadius + 8} />
        <Sector {...props} outerRadius={outerRadius + 20} innerRadius={outerRadius + 10} />
      </g>
    );
  }
  return <Sector {...props} outerRadius={outerRadius} />;
}

export function StageDistributionCard({ stageData, totalFiltered }: StageDistributionCardProps) {
  const [activeStage, setActiveStage] = useState<string>("all");
  const activeIndex = useMemo(() => stageData.findIndex((item) => item.stageId === activeStage), [stageData, activeStage]);
  const shapeRenderer = useCallback((props: any) => renderPieShape(props, activeIndex), [activeIndex]);

  const activeItem = activeStage === "all" ? null : stageData[activeIndex];
  const count = activeItem ? activeItem.value : totalFiltered;
  const labelText = activeItem ? activeItem.name : "Total Mentees";

  return (
    <Card className="flex flex-col rounded-2xl border border-border/50 bg-card shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden h-full group">
      <ChartStyle id="pie-interactive" config={stageConfig} />
      <div className="flex flex-row items-center justify-between p-5 pb-0">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-slate-900 dark:text-white text-base">Stage Distribution</h2>
            <MetricPopover
              title="Pipeline Stage Distribution"
              description="Shows how many students are in each stage of the hiring pipeline. Identifies bottlenecks and progress."
              metrics="Student count per stage: Learning → Applying → Interviewing → Offer Pending → Placed → Hired"
              calculation="COUNT(students) GROUP BY stage"
              importance="Reveals where students are getting stuck. Large groups in 'Applying' or 'Interviewing' may need interview prep or CV help."
            />
          </div>
          <p className="text-xs text-muted-foreground font-semibold">Current Pipeline Status</p>
        </div>
        <Select value={activeStage} onValueChange={setActiveStage}>
          <SelectTrigger className="w-[130px] h-8 rounded-lg pl-2.5 text-xs font-semibold bg-card border-border/50 hover:bg-muted/30 transition-colors">
            <SelectValue placeholder="Select stage" />
          </SelectTrigger>
          <SelectContent align="end" className="rounded-xl border-border/60">
            <SelectItem value="all" className="text-xs font-semibold">All Stages</SelectItem>
            {stageData.map((item) => (
              <SelectItem key={item.stageId} value={item.stageId} className="text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: stageConfig[item.stageId as keyof typeof stageConfig]?.color }} />
                  {stageConfig[item.stageId as keyof typeof stageConfig]?.label}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col md:flex-row items-center justify-between px-6 py-2 gap-4">
        {/* Left/Top: Donut Chart container */}
        <div className="relative flex-1 flex justify-center items-center w-full max-h-[220px]">
          <ChartContainer id="pie-interactive" config={stageConfig} className="aspect-square w-full max-w-[190px]">
            <PieChart>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Pie 
                data={stageData} 
                dataKey="value" 
                nameKey="name" 
                innerRadius={55} 
                outerRadius={75} 
                strokeWidth={3} 
                shape={shapeRenderer}
                onClick={(_, index) => {
                  const stageId = stageData[index]?.stageId;
                  if (stageId) setActiveStage(stageId === activeStage ? "all" : stageId);
                }}
                className="cursor-pointer"
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={viewBox.cy} dy="-0.1em" className="fill-slate-900 dark:fill-white text-3xl font-black tracking-tight">{count.toLocaleString()}</tspan>
                          <tspan x={viewBox.cx} y={viewBox.cy} dy="1.4em" className="fill-muted-foreground text-[9px] font-bold uppercase tracking-widest">{labelText}</tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        </div>

        {/* Right/Bottom: Beautiful legends breakdown */}
        <div className="flex flex-col gap-2 w-full md:w-[150px] shrink-0 border-t md:border-t-0 md:border-l border-border/50 pt-3 md:pt-0 md:pl-4">
          {stageData.map((item) => {
            const config = stageConfig[item.stageId as keyof typeof stageConfig];
            const pct = totalFiltered > 0 ? Math.round((item.value / totalFiltered) * 100) : 0;
            const isHighlighted = activeStage === "all" || activeStage === item.stageId;
            return (
              <button
                key={item.stageId}
                onClick={() => setActiveStage(item.stageId === activeStage ? "all" : item.stageId)}
                className={`flex items-center justify-between text-left text-xs font-semibold py-0.5 px-1.5 rounded-md hover:bg-muted/40 transition-colors w-full ${isHighlighted ? 'opacity-100' : 'opacity-40'}`}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: config?.color }} />
                  <span className="text-muted-foreground/90 dark:text-slate-300 truncate">{config?.label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span className="font-bold text-slate-800 dark:text-slate-100">{item.value}</span>
                  <span className="text-[10px] text-muted-foreground/70 font-semibold">({pct}%)</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
