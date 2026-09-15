'use client';

import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Loader2, Clock, ArrowRight, AlertTriangle } from 'lucide-react';
import type { StageTransition } from '@/lib/sheets/stage-history';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STAGE_COLORS: Record<string, string> = {
  learning:      'bg-slate-100 text-slate-700 border-slate-300',
  applying:      'bg-blue-100 text-blue-700 border-blue-300',
  interviewing:  'bg-violet-100 text-violet-700 border-violet-300',
  offer_pending: 'bg-amber-100 text-amber-700 border-amber-300',
  placed:        'bg-emerald-100 text-emerald-700 border-emerald-300',
  hired:         'bg-green-100 text-green-700 border-green-300',
};

const TRIGGER_BADGE: Record<string, string> = {
  api: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  admin: 'bg-purple-50 text-purple-600 border-purple-200',
  risk_engine: 'bg-red-50 text-red-600 border-red-200',
  discord_webhook: 'bg-sky-50 text-sky-600 border-sky-200',
  bulk_upload: 'bg-slate-50 text-slate-600 border-slate-200',
};

interface StageHistoryTabProps {
  studentId: string;
}

export function StageHistoryTab({ studentId }: StageHistoryTabProps) {
  const { data, isLoading } = useQuery<StageTransition[]>({
    queryKey: ['stage-history', studentId],
    queryFn: async () => {
      const res = await fetch(`/api/stage-history?student_id=${studentId}`);
      if (!res.ok) throw new Error('Failed to fetch stage history');
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const transitions = data ?? [];

  const currentStage = transitions[0]?.to_stage ?? null;
  const currentDays = transitions[0]
    ? Math.floor((Date.now() - new Date(transitions[0].transitioned_at).getTime()) / (24 * 60 * 60 * 1000))
    : 0;

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (transitions.length === 0) {
    return (
      <div className="text-center py-10">
        <Clock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No stage transitions recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {currentStage && (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-violet-50 border border-violet-200">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-violet-600 uppercase tracking-wide">Current Stage</p>
              <Badge className={cn('mt-0.5 text-xs font-semibold border capitalize', STAGE_COLORS[currentStage] ?? 'bg-slate-100')}>
                {currentStage.replace('_', ' ')}
              </Badge>
            </div>
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-bold text-violet-700">{currentDays}</p>
            <p className="text-xs text-violet-500">days in stage</p>
          </div>
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Stage Journey ({transitions.length} transitions)
        </p>
        <div className="relative">
          {transitions.map((transition, idx) => {
            const isRegression =
              idx < transitions.length - 1 &&
              transitions[idx + 1].from_stage !== '' &&
              transition.to_stage !== 'hired' &&
              transition.to_stage !== 'placed' &&
              (transitions[idx + 1].from_stage === 'interviewing' || transitions[idx + 1].from_stage === 'offer_pending') &&
              (transition.to_stage === 'applying' || transition.to_stage === 'learning');

            return (
              <div key={transition.id} className="relative">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'w-3 h-3 rounded-full border-2 bg-background z-10',
                      isRegression ? 'border-red-400 bg-red-100' : 'border-violet-400 bg-violet-100'
                    )}>
                      {isRegression && <AlertTriangle className="w-2 h-2 text-red-500 absolute inset-0 m-auto" />}
                    </div>
                    {idx < transitions.length - 1 && (
                      <div className="w-0.5 h-10 bg-border" />
                    )}
                  </div>

                  <div className={cn(
                    'flex-1 pb-4',
                    idx === 0 && 'pb-2'
                  )}>
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {transition.from_stage && (
                          <>
                            <Badge className={cn('text-xs border capitalize', STAGE_COLORS[transition.from_stage] ?? 'bg-slate-100')}>
                              {transition.from_stage.replace('_', ' ')}
                            </Badge>
                            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          </>
                        )}
                        <Badge className={cn('text-xs border capitalize font-bold', STAGE_COLORS[transition.to_stage] ?? 'bg-slate-100')}>
                          {transition.to_stage.replace('_', ' ')}
                        </Badge>
                        {isRegression && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-600 border border-red-200">
                            <AlertTriangle className="w-2.5 h-2.5" /> Regression
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge className={cn('text-[10px] border', TRIGGER_BADGE[transition.triggered_by] ?? 'bg-slate-50')}>
                          {transition.triggered_by}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {(() => {
                            try { return format(parseISO(transition.transitioned_at), 'MMM d, yyyy'); }
                            catch { return transition.transitioned_at; }
                          })()}
                        </span>
                      </div>
                    </div>
                    {transition.note && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{transition.note}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {(() => {
                        try { return format(parseISO(transition.transitioned_at), 'h:mm a'); }
                        catch { return ''; }
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}