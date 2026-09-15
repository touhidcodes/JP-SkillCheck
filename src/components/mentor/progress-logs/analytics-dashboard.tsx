'use client';

import { useMemo, useState, useEffect } from 'react';
import { ProgressLog, ProgressLogType } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { BarChart3, LineChart } from 'lucide-react';
import { parseISO, format, subDays, eachDayOfInterval, isSameDay } from 'date-fns';
import { MetricPopover } from '@/components/shared/metric-popover';

interface AnalyticsDashboardProps {
  logs: ProgressLog[];
}

const TYPE_COLORS: Record<ProgressLogType, string> = {
  'Interview Call': '#3b82f6', // blue
  'Job Applied': '#6366f1',    // indigo
  'Mock Interview': '#a855f7', // purple
  'Job Task': '#f59e0b',       // amber
  'Offer': '#10b981',          // emerald
  'Other': '#64748b',          // slate
};

export function AnalyticsDashboard({ logs }: AnalyticsDashboardProps) {
  const [mounted, setMounted] = useState(false);

  // Avoid hydration shifts
  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. Data Processing for Milestone Distribution (Bar Chart)
  const distributionData = useMemo(() => {
    const counts: Record<ProgressLogType, number> = {
      'Interview Call': 0,
      'Job Applied': 0,
      'Mock Interview': 0,
      'Job Task': 0,
      'Offer': 0,
      'Other': 0,
    };

    logs.forEach((log) => {
      if (counts[log.log_type] !== undefined) {
        counts[log.log_type]++;
      }
    });

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      fill: TYPE_COLORS[name as ProgressLogType],
    }));
  }, [logs]);

  // 2. Data Processing for Activity Trend (Area Chart - Last 14 days)
  const trendData = useMemo(() => {
    const end = new Date();
    const start = subDays(end, 13); // last 14 days

    const days = eachDayOfInterval({ start, end });

    return days.map((day) => {
      const count = logs.filter((log) => {
        if (!log.logged_at) return false;
        try {
          const logDate = parseISO(log.logged_at);
          return isSameDay(logDate, day);
        } catch {
          return false;
        }
      }).length;

      return {
        date: format(day, 'MMM d'),
        count,
      };
    });
  }, [logs]);

  if (!mounted) {
    return (
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="h-[350px] rounded-2xl border border-border/50 bg-card shadow-sm flex items-center justify-center">
          <div className="text-muted-foreground text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 animate-pulse text-indigo-500" /> Loading chart...
          </div>
        </Card>
        <Card className="h-[350px] rounded-2xl border border-border/50 bg-card shadow-sm flex items-center justify-center">
          <div className="text-muted-foreground text-sm flex items-center gap-2">
            <LineChart className="h-4 w-4 animate-pulse text-indigo-500" /> Loading chart...
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* 1. Milestone Distribution Card */}
      <Card className="flex flex-col rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden h-full">
        <div className="flex flex-row items-start justify-between p-5 pb-0">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 dark:text-white text-base">Milestone Distribution</h2>
              <MetricPopover
                title="Milestone Distribution"
                description="This chart breaks down all logged progress actions by their category (Mock interviews, Job applications, Offers, etc.) to show where students are currently focused."
                metrics="Sum of all active progress logs matching specific category types."
                calculation="COUNT(progress_logs) GROUP BY log_type"
                importance="If Mock Interviews are high but external Interview Calls are low, students may require additional resume optimization or screening practice to secure interview calls."
              />
            </div>
            <p className="text-xs text-muted-foreground font-semibold">Breakdown of logged activities by recruitment stage</p>
          </div>
        </div>
        <CardContent className="h-[260px] p-5 pt-0 pb-4">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              No milestones recorded to plot.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.4)" />
                <XAxis 
                  dataKey="name" 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  allowDecimals={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(99, 102, 241, 0.04)' }}
                  contentStyle={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid rgba(226, 232, 240, 0.8)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                  }}
                  itemStyle={{ fontSize: '11px', color: '#1e293b' }}
                  labelStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#6366f1' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={32}>
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 2. Chronological Progress Trends Card */}
      <Card className="flex flex-col rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden h-full">
        <div className="flex flex-row items-start justify-between p-5 pb-0">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 dark:text-white text-base">Activity Trends</h2>
              <MetricPopover
                title="Activity Trends"
                description="This gradient area chart represents the daily volume of placement milestone entries logged. It tracks visual pace and coaching rhythm over a 14-day trailing cycle."
                metrics="Groups log entries chronologically matching their database commit timestamps."
                calculation="COUNT(progress_logs) GROUP BY DATE(logged_at)"
                importance="Consistent spikes signify active placement interview runs. If the line drops flat to zero across multiple days, check in with students to restart mock evaluations."
              />
            </div>
            <p className="text-xs text-muted-foreground font-semibold">Daily frequency of logs generated over the last 14 days</p>
          </div>
        </div>
        <CardContent className="h-[260px] p-5 pt-0 pb-4">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              No milestones recorded to plot.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(226, 232, 240, 0.4)" />
                <XAxis 
                  dataKey="date" 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fontSize: 10, fill: '#64748b' }} 
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid rgba(226, 232, 240, 0.8)',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                  }}
                  itemStyle={{ fontSize: '11px', color: '#1e293b' }}
                  labelStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#6366f1' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#6366f1" 
                  strokeWidth={2} 
                  fillOpacity={1} 
                  fill="url(#colorActivity)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
