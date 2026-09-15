'use client';

import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { AlertCircle, Clock, ArrowRight, RefreshCw } from 'lucide-react';
import { Student } from '@/types';
import { Button } from '@/components/ui/button';
import { StudentProfileSheet } from './student-profile-sheet';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface RiskTableProps {
  students: Student[];
  maxRows?: number;
}

const RISK_REASON_LABELS: Record<string, { label: string; color: string }> = {
  no_recent_activity:          { label: 'No recent activity',    color: 'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40' },
  inactive_login_pattern:      { label: 'Inactive login pattern', color: 'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40' },
  slow_progress:               { label: 'Slow progress',          color: 'bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/40' },
  absent_2_consecutive_days:   { label: '2 consecutive absences', color: 'bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/40' },
  no_progress_update_7_days:   { label: 'No update in 7 days',    color: 'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40' },
  no_interview_or_task_7_days: { label: 'No interview/task 7d',   color: 'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40' },
};

function getRiskReasonBadge(reason: string) {
  const normalized = reason.trim().toLowerCase().replace(/\s+/g, '_');
  const config = RISK_REASON_LABELS[normalized];
  return config ?? { label: reason.trim(), color: 'bg-slate-50 text-slate-650 border-slate-200/60 dark:bg-slate-800/40 dark:text-slate-450 dark:border-slate-700/50' };
}

export function RiskTable({ students, maxRows = 5 }: RiskTableProps) {
  const [selected, setSelected] = useState<Student | null>(null);
  const display = students.slice(0, maxRows);

  // Fetch risk frequency map — how many times each student has been at-risk
  const { data: historyData } = useQuery({
    queryKey: ['risk-history-freq'],
    queryFn: async () => {
      const res = await fetch('/api/risk-history');
      if (!res.ok) return { frequently_at_risk: [] };
      return res.json() as Promise<{
        frequently_at_risk: { student_id: string; times_at_risk: number }[];
      }>;
    },
    staleTime: 5 * 60 * 1000,
  });

  const freqMap = new Map<string, number>(
    (historyData?.frequently_at_risk ?? []).map(e => [e.student_id, e.times_at_risk])
  );

  if (display.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
          <span className="text-2xl">🎉</span>
        </div>
        <p className="text-sm font-medium text-foreground">All clear!</p>
        <p className="text-xs text-muted-foreground">No at-risk students right now.</p>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-border/60">
        {display.map((student) => {
          const reasons = student.risk_reasons
            ? student.risk_reasons.split(',').filter(Boolean)
            : [];

          const lastActivity = student.last_activity_date
            ? formatDistanceToNow(new Date(student.last_activity_date), { addSuffix: true })
            : null;

          const timesAtRisk = freqMap.get(student.id) ?? 0;
          const isFrequent = timesAtRisk >= 2;
          const inactiveDays = student.last_activity_date
            ? differenceInDays(new Date(), new Date(student.last_activity_date))
            : 999;

          return (
            <div
              key={student.id}
              className="flex items-start justify-between gap-4 py-3.5 px-1 group hover:bg-muted/15 rounded-xl transition-colors"
            >
              {/* Left — name + batch */}
              <div className="flex items-start gap-3 min-w-0">
                <div className="mt-0.5 shrink-0 w-7 h-7 rounded-full bg-red-500/10 dark:bg-red-950/30 flex items-center justify-center">
                  <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground leading-tight truncate">
                      {student.name}
                    </p>
                    {/* Frequently at-risk badge — priority support indicator */}
                    {isFrequent && (
                      <span
                        title={`At-risk ${timesAtRisk} times — needs priority support`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-black border bg-red-500/15 text-red-700 border-red-500/20 dark:bg-red-950/50 dark:text-red-400 dark:border-red-900/30"
                      >
                        <RefreshCw className="w-2.5 h-2.5" />
                        {timesAtRisk}×
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{student.batch}</p>

                  {/* Risk reason badges */}
                  {reasons.length > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {reasons.map((r, i) => {
                        const { label, color } = getRiskReasonBadge(r);
                        return (
                          <span
                            key={i}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${color}`}
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 mt-1.5 rounded-full text-[10px] font-medium border bg-slate-50 text-slate-650 border-slate-200/60 dark:bg-slate-800/40 dark:text-slate-450 dark:border-slate-700/50">
                      No specific reason
                    </span>
                  )}
                </div>
              </div>

              {/* Right — last activity + action */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                {lastActivity && (
                  <span className={cn(
                    "flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap",
                    inactiveDays > 14
                      ? 'text-red-600 dark:text-red-400'
                      : inactiveDays >= 7
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  )}>
                    <Clock className="w-3 h-3 shrink-0" />
                    {lastActivity}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1"
                  onClick={() => setSelected(student)}
                >
                  View
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <StudentProfileSheet
        student={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}
