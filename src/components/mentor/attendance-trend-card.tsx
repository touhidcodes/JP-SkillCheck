'use client';

import { useState } from 'react';
import { CartesianGrid, XAxis, LineChart, Line } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { MetricPopover } from '@/components/shared/metric-popover';

const attendanceConfig = {
  views: { label: "Sessions" },
  attendance: { label: "Avg Attendance", color: "#7C3AED" },
  present: { label: "Present", color: "#10B981" },
  absent: { label: "Absent", color: "#EF4444" },
};

interface AttendanceTrendCardProps {
  attendanceTrend: { date: string; session: string; attendance: number; present: number; absent: number }[];
  avgAttendance: number;
}

interface MetricButtonProps {
  metric: 'attendance' | 'present' | 'absent';
  active: boolean;
  value: string | number;
  onClick: () => void;
}

function AttendanceMetricButton({ metric, active, value, onClick }: MetricButtonProps) {
  const activeBorders: Record<'attendance' | 'present' | 'absent', string> = {
    attendance: 'border-b-2 border-b-purple-500 dark:border-b-purple-400',
    present: 'border-b-2 border-b-emerald-500 dark:border-b-emerald-400',
    absent: 'border-b-2 border-b-red-500 dark:border-b-red-400',
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
        {attendanceConfig[metric].label}
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

export function AttendanceTrendCard({ attendanceTrend, avgAttendance }: AttendanceTrendCardProps) {
  const [activeMetric, setActiveMetric] = useState<'attendance' | 'present' | 'absent'>("attendance");

  const totals = {
    attendance: avgAttendance,
    present: attendanceTrend.reduce((acc, curr) => acc + curr.present, 0),
    absent: attendanceTrend.reduce((acc, curr) => acc + curr.absent, 0),
  };

  return (
    <Card className="flex flex-col rounded-2xl border border-border/50 bg-card shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden h-full group">
      <CardHeader className="flex flex-col items-stretch border-b border-border/50 p-0 sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 py-4 sm:py-5">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Attendance Trend</CardTitle>
            <MetricPopover
              title="Attendance Trend"
              description="Historical view of attendance rates over the last 8 sessions. Shows if engagement is improving or declining."
              metrics="Attendance logs grouped by session date, calculated as (Present / Total) per session"
              calculation="For each session: (Count Present) / (Count Total Logged) × 100"
              importance="Downward trends signal disengagement. Upward trends show your interventions are working. Use to adjust support strategies."
            />
          </div>
          <CardDescription className="text-xs text-muted-foreground font-semibold">
            Showing metrics for the last 8 sessions
          </CardDescription>
        </div>
        <div className="flex border-t border-border/50 sm:border-t-0">
          {(['attendance', 'present', 'absent'] as const).map((key) => (
            <AttendanceMetricButton
              key={key}
              metric={key}
              active={activeMetric === key}
              value={key === 'attendance' ? `${totals[key]}%` : totals[key].toLocaleString()}
              onClick={() => setActiveMetric(key)}
            />
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex-1 px-2 pt-6 pb-4 sm:px-6 min-h-[220px]">
        <ChartContainer id="attendance-interactive" config={attendanceConfig} className="aspect-auto h-[170px] w-full">
          <LineChart accessibilityLayer data={attendanceTrend} margin={{ left: 12, right: 12, top: 10, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-muted/20" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              minTickGap={32}
              className="text-[10px] font-bold text-muted-foreground"
              tickFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  className="w-[150px] rounded-xl border border-border/60 bg-card/95 shadow-md text-xs font-semibold"
                  nameKey="views"
                  labelFormatter={(value) => new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                />
              }
            />
            <Line
              dataKey={activeMetric}
              type="monotone"
              stroke={attendanceConfig[activeMetric].color}
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 1.5, fill: "#fff" }}
              activeDot={{ r: 6, strokeWidth: 2, fill: attendanceConfig[activeMetric].color }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
