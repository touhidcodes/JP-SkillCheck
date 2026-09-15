'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricPopover } from '@/components/shared/metric-popover';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { getPerformanceTier, type PerformanceTier } from '@/components/analytics/mentor-leaderboard-card';
import { cn } from '@/lib/utils';

const MENTOR_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#06b6d4',
];

const TIER_STYLES: Record<PerformanceTier, string> = {
  'Elite':         'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/25',
  'Strong':        'bg-blue-100    text-blue-700    border-blue-200    dark:bg-blue-500/10    dark:text-blue-400    dark:border-blue-500/25',
  'Developing':    'bg-amber-100   text-amber-700   border-amber-200   dark:bg-amber-500/10   dark:text-amber-400   dark:border-amber-500/25',
  'Needs Support': 'bg-red-100     text-red-700     border-red-200     dark:bg-red-500/10     dark:text-red-400     dark:border-red-500/25',
};

interface LeaderboardTableProps {
  mentors: any[];
}

export function LeaderboardTable({ mentors }: LeaderboardTableProps) {
  const [expandedMentor, setExpandedMentor] = useState<string | null>(null);

  const toggleExpand = (email: string) => {
    setExpandedMentor(prev => prev === email ? null : email);
  };

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-2xl font-semibold gap-2 flex items-center">
          Mentor Comparison
          <MetricPopover
            title="Mentor Comparison"
            description="A master ranking of all mentors ordered dynamically by core metrics."
            metrics="Placement Rate, Students, Hires, Trend, At-Risk warnings."
            calculation="Sortable live grid of system-aggregated logs."
            importance="Acts as the primary managerial command center for evaluating entire team operations."
          />
        </CardTitle>
        <p className="text-xs text-muted-foreground">Sorted by placement rate · click row to expand monthly breakdown</p>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="rounded-xl border border-border/50 bg-background overflow-hidden mx-5 mb-5">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/60">
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3 pl-4">Mentor</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3">Tier</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3 text-right">Students</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3 text-right">Active</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3 text-right">Hired</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3 text-right">Placement</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3 text-right">Trend</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3 text-right">At Risk</TableHead>
                <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3 text-right">Interviews</TableHead>
                <TableHead className="w-8 py-3" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {mentors.map((mentor, idx) => (
                <LeaderboardRow
                  key={mentor.mentor_email}
                  mentor={mentor}
                  idx={idx}
                  isExpanded={expandedMentor === mentor.mentor_email}
                  onToggle={() => toggleExpand(mentor.mentor_email)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function LeaderboardRow({ mentor, idx, isExpanded, onToggle }: { mentor: any; idx: number; isExpanded: boolean; onToggle: () => void }) {
  const lastMonth = mentor.months[mentor.months.length - 1];
  const tier = getPerformanceTier(
    mentor.current_placement_rate >= 30 ? 80 : mentor.current_placement_rate >= 15 ? 60 : 40,
    mentor.current_placement_rate
  );

  return (
    <>
      <TableRow
        className="border-b border-border/40 hover:bg-muted/30 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <TableCell className="py-3 pl-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: MENTOR_COLORS[idx % MENTOR_COLORS.length] }} />
            <span className="text-sm font-semibold text-foreground">{mentor.mentor_name}</span>
          </div>
        </TableCell>
        <TableCell className="py-3">
          <Badge className={cn('text-[10px] px-2 py-0.5 h-5 font-semibold border shadow-none bg-transparent', TIER_STYLES[tier])}>
            {tier}
          </Badge>
        </TableCell>
        <TableCell className="py-3 text-right tabular-nums text-sm">{mentor.total_students_now}</TableCell>
        <TableCell className="py-3 text-right tabular-nums text-sm text-emerald-600 font-medium">{lastMonth?.active ?? 0}</TableCell>
        <TableCell className="py-3 text-right tabular-nums text-sm font-semibold text-emerald-700">{mentor.total_hired_all_time}</TableCell>
        <TableCell className="py-3 text-right">
          <span className={cn('text-sm font-bold tabular-nums',
            mentor.current_placement_rate >= 30 ? 'text-emerald-600' :
            mentor.current_placement_rate >= 15 ? 'text-amber-600' : 'text-red-600',
          )}>
            {mentor.current_placement_rate}%
          </span>
        </TableCell>
        <TableCell className="py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            <span className={cn('text-xs font-semibold',
              mentor.placement_trend === 'up' ? 'text-emerald-600' :
              mentor.placement_trend === 'down' ? 'text-red-600' : 'text-muted-foreground'
            )}>
              {mentor.placement_trend === 'up' ? 'Improving' : mentor.placement_trend === 'down' ? 'Declining' : 'Stable'}
            </span>
          </div>
        </TableCell>
        <TableCell className="py-3 text-right">
          {lastMonth?.at_risk ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/25">
              <AlertTriangle className="w-3 h-3" />
              {lastMonth.at_risk}
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/25">0</span>
          )}
        </TableCell>
        <TableCell className="py-3 text-right tabular-nums text-sm">{lastMonth?.interviews ?? 0}</TableCell>
        <TableCell className="py-3 pr-4">
          {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground ml-auto" /> : <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />}
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow className="bg-muted/10 hover:bg-muted/10">
          <TableCell colSpan={10} className="px-5 py-4">
            <MonthlyBreakdown name={mentor.mentor_name} months={mentor.months} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function MonthlyBreakdown({ name, months }: { name: string; months: any[] }) {
  const headers = ['Month', 'Students', 'Active', 'Hired', 'Interviews', 'Tasks', 'Offers', 'Applied', 'Attend.', 'New'];
  return (
    <div className="rounded-xl border border-border/40 overflow-hidden bg-card">
      <div className="px-4 py-2.5 bg-muted/40 border-b border-border/40">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{name} — Monthly Breakdown</p>
      </div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/20 hover:bg-muted/20 border-b border-border/40">
            {headers.map(h => (
              <TableHead key={h} className={cn('py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide', h === 'Month' ? 'pl-4' : 'text-right')}>{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {months.map((month, i) => (
            <TableRow key={month.month} className={cn(
              'border-b border-border/20 transition-colors',
              i === months.length - 1 ? 'font-semibold bg-primary/5' : 'hover:bg-muted/20',
            )}>
              <TableCell className="py-2 pl-4 text-xs">{month.monthLabel}</TableCell>
              <TableCell className="py-2 text-right tabular-nums text-xs">{month.student_count}</TableCell>
              <TableCell className="py-2 text-right tabular-nums text-xs text-blue-600">{month.active}</TableCell>
              <TableCell className="py-2 text-right tabular-nums text-xs text-emerald-600">{month.hired}</TableCell>
              <TableCell className="py-2 text-right tabular-nums text-xs">{month.interviews}</TableCell>
              <TableCell className="py-2 text-right tabular-nums text-xs">{month.tasks}</TableCell>
              <TableCell className="py-2 text-right tabular-nums text-xs">{month.offers}</TableCell>
              <TableCell className="py-2 text-right tabular-nums text-xs">{month.jobs_applied}</TableCell>
              <TableCell className="py-2 text-right tabular-nums text-xs">{month.avg_attendance_rate > 0 ? `${month.avg_attendance_rate}%` : '—'}</TableCell>
              <TableCell className="py-2 text-right tabular-nums text-xs">
                {month.pipeline_growth > 0 ? <span className="text-emerald-600 font-semibold">+{month.pipeline_growth}</span> : <span className="text-muted-foreground">0</span>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
