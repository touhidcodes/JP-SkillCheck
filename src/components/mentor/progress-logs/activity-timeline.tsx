'use client';

import { useMemo } from 'react';
import { ProgressLog, ProgressLogType, MockInterviewType } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import {
  Phone, Briefcase, MessageSquare, ClipboardList, CheckCircle2,
  FileText, Star, Edit3, Trash2, ExternalLink, Calendar, Clock,
  ChevronRight, Award
} from 'lucide-react';

interface ActivityTimelineProps {
  logs: ProgressLog[];
  onEdit: (log: ProgressLog) => void;
  onDelete: (id: string) => void;
}

const LOG_TYPE_CONFIG: Record<ProgressLogType, {
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}> = {
  'Interview Call': { icon: Phone,        color: 'text-blue-700 dark:text-blue-400',    bg: 'bg-blue-50 dark:bg-blue-950/30',    border: 'border-blue-200 dark:border-blue-900/50'    },
  'Job Applied':    { icon: Briefcase,    color: 'text-indigo-700 dark:text-indigo-400',  bg: 'bg-indigo-50 dark:bg-indigo-950/30',  border: 'border-indigo-200 dark:border-indigo-900/50'  },
  'Mock Interview': { icon: MessageSquare,color: 'text-purple-700 dark:text-purple-400',  bg: 'bg-purple-50 dark:bg-purple-950/30',  border: 'border-purple-200 dark:border-purple-900/50'  },
  'Job Task':       { icon: ClipboardList,color: 'text-amber-700 dark:text-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/30',   border: 'border-amber-200 dark:border-amber-900/50'   },
  'Offer':          { icon: CheckCircle2,  color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-900/50' },
  'Other':          { icon: FileText,     color: 'text-slate-600 dark:text-slate-400',   bg: 'bg-slate-50 dark:bg-slate-900/40',   border: 'border-slate-200 dark:border-slate-800'   },
};

const MOCK_INTERVIEW_TYPES: Record<MockInterviewType, string> = {
  technical: 'Technical Mock',
  behavioral: 'Behavioral Mock',
  system_design: 'System Design Mock',
  hr: 'HR Round Mock',
  mock: 'General Mock Practice',
};

function getDateLabel(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const d = parseISO(dateStr);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

function getLoggedAgo(loggedAt: string): string {
  try {
    const diff = Date.now() - new Date(loggedAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return 'Just now';
    if (mins < 60)  return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  } catch {
    return '';
  }
}

function initials(name: string): string {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export function ActivityTimeline({ logs, onEdit, onDelete }: ActivityTimelineProps) {
  // Sort chronologically descending
  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => {
      const timeA = a.logged_at ? new Date(a.logged_at).getTime() : 0;
      const timeB = b.logged_at ? new Date(b.logged_at).getTime() : 0;
      return timeB - timeA;
    });
  }, [logs]);

  return (
    <TooltipProvider>
      <div className="relative pl-6 sm:pl-8 py-2">
        {/* The solid track line */}
        <div className="absolute left-3.5 sm:left-[22px] top-0 bottom-0 w-0.5 bg-border/60 dark:bg-border/30" />

        {sortedLogs.length === 0 ? (
          <div className="text-center py-10 text-xs text-muted-foreground">
            No activity history matches the current filters.
          </div>
        ) : (
          <div className="space-y-6">
            {sortedLogs.map((log) => {
              const typeConfig = LOG_TYPE_CONFIG[log.log_type] || LOG_TYPE_CONFIG.Other;
              const Icon = typeConfig.icon;
              const timeLabel = getLoggedAgo(log.logged_at);

              return (
                <div key={log.id} className="relative group transition-all duration-300">
                  {/* Timeline indicator node */}
                  <div className={cn(
                    "absolute -left-[29px] sm:-left-[37px] top-1.5 w-6 h-6 rounded-full flex items-center justify-center border-2 bg-background ring-4 ring-background transition-transform duration-300 group-hover:scale-110 shadow-sm z-10",
                    typeConfig.border,
                    typeConfig.color
                  )}>
                    <Icon className="w-3 h-3" />
                  </div>

                  {/* Main Event Card */}
                  <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-5 shadow-sm hover:shadow-md hover:border-border transition-all duration-300">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/40">
                      
                      {/* Left side: Avatar + Student info */}
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-100 dark:border-indigo-900/30">
                          {initials(log.student_name)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-foreground hover:underline cursor-pointer">
                              {log.student_name}
                            </span>
                            <Badge variant="secondary" className={cn(
                              "text-[10px] px-1.5 py-0 border leading-none font-medium",
                              typeConfig.bg, typeConfig.color, typeConfig.border
                            )}>
                              {log.log_type}
                            </Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{log.student_email}</span>
                        </div>
                      </div>

                      {/* Right side: Action triggers & time info */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{timeLabel ? `${timeLabel} ago` : 'recently'}</span>
                        </div>

                        {/* Interactive operations */}
                        <div className="flex items-center gap-1 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <Tooltip>
                            <TooltipTrigger render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground"
                                onClick={() => onEdit(log)}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </Button>
                            } />
                            <TooltipContent>Edit Log</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger render={
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/20 text-muted-foreground hover:text-red-600"
                                onClick={() => onDelete(log.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            } />
                            <TooltipContent>Delete Log</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </div>

                    {/* Event Body */}
                    <div className="pt-3.5 space-y-3">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-xs font-semibold text-muted-foreground">Target Recruiter:</span>
                        <span className="text-sm font-bold text-foreground">{log.company_name}</span>

                        {log.log_type === 'Job Applied' && log.job_url && (
                          <a
                            href={log.job_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-indigo-600 hover:text-indigo-700 hover:underline ml-1"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                            View job posting
                          </a>
                        )}
                      </div>

                      {/* Scheduled timing parameters */}
                      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-indigo-500" />
                          <span>Event Date: {getDateLabel(log.scheduled_date)}</span>
                        </div>
                        {log.scheduled_time && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-indigo-500" />
                            <span>Scheduled Time: {log.scheduled_time}</span>
                          </div>
                        )}
                      </div>

                      {/* Note summary statement */}
                      {log.note ? (
                        <div className="rounded-lg bg-muted/30 dark:bg-muted/10 border border-border/30 p-3 text-xs text-muted-foreground leading-relaxed">
                          {log.note}
                        </div>
                      ) : null}

                      {/* Mock Interview scores */}
                      {log.log_type === 'Mock Interview' && (
                        <div className="rounded-lg border border-purple-100 dark:border-purple-900/30 bg-purple-50/20 dark:bg-purple-950/10 p-3 sm:p-4 space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-400">
                              <Award className="w-4 h-4" />
                              <span>
                                {log.mock_interview_type
                                  ? MOCK_INTERVIEW_TYPES[log.mock_interview_type] || log.mock_interview_type
                                  : 'General Practice Session'}
                              </span>
                              {log.mock_interviewer && (
                                <span className="text-[10px] font-normal text-muted-foreground">
                                  by {log.mock_interviewer}
                                </span>
                              )}
                            </div>

                            {log.mock_score != null && log.mock_score > 0 && (
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-xs font-bold text-purple-900 dark:text-purple-300">
                                  Rating: {log.mock_score}/10
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Graphical Score Meter */}
                          {log.mock_score != null && log.mock_score > 0 && (
                            <div className="space-y-1">
                              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden flex">
                                <div 
                                  className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    log.mock_score >= 8 ? 'bg-emerald-500' : log.mock_score >= 6 ? 'bg-amber-500' : 'bg-rose-500'
                                  )}
                                  style={{ width: `${log.mock_score * 10}%` }}
                                />
                              </div>
                              <div className="flex justify-between text-[9px] text-muted-foreground">
                                <span>Developing (1-5)</span>
                                <span>Proficient (6-7)</span>
                                <span>Outstanding (8-10)</span>
                              </div>
                            </div>
                          )}

                          {/* Strengths & Improvements */}
                          <div className="grid gap-3 sm:grid-cols-2 pt-1 text-[11px]">
                            {log.mock_strengths && (
                              <div className="space-y-0.5">
                                <span className="font-semibold text-emerald-700 dark:text-emerald-400">✓ Strengths:</span>
                                <p className="text-muted-foreground">{log.mock_strengths}</p>
                              </div>
                            )}
                            {log.mock_improvements && (
                              <div className="space-y-0.5">
                                <span className="font-semibold text-rose-700 dark:text-rose-400">✗ Areas for Growth:</span>
                                <p className="text-muted-foreground">{log.mock_improvements}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Offer Special Highlight */}
                      {log.log_type === 'Offer' && (
                        <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/10 p-3 flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-400">
                          <Star className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-spin-slow shrink-0" />
                          <span>
                            <strong>Offer received!</strong> Officially extended from <strong>{log.company_name}</strong> to {log.student_name}. Keep tracking recruitment milestones.
                          </span>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
