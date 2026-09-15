'use client';

import React from 'react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { RiskLevel, Student, StudentStage } from '@/types';
import { STAGE_LABEL, BADGE, riskLabel, RowActions } from './mentees-table-row';
import { usePlacementStore } from '@/lib/placement/store';
import { Calendar, CheckCircle2, AlertTriangle, Activity, Target, ShieldAlert } from 'lucide-react';

interface MenteeCardProps {
  student: Student;
  risk: any;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  onAction: (type: string, student: Student) => void;
  onUpdate: (id: string, updates: Partial<Student>) => void;
}

const STAGE_PROGRESS: Record<StudentStage, number> = {
  learning: 10,
  applying: 30,
  interviewing: 60,
  offer_pending: 80,
  placed: 100,
  hired: 100,
};

const RISK_THEMES = {
  safe: {
    border: 'border-l-4 border-l-emerald-500',
    hoverBorder: 'hover:border-emerald-500/25',
    gradient: 'from-emerald-500/5 via-transparent to-transparent',
    iconColor: 'text-emerald-500',
    badge: 'bg-emerald-500/10 text-emerald-700 border-emerald-200/50 hover:bg-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40 dark:hover:bg-emerald-950/60',
  },
  medium: {
    border: 'border-l-4 border-l-amber-500',
    hoverBorder: 'hover:border-amber-500/25',
    gradient: 'from-amber-500/5 via-transparent to-transparent',
    iconColor: 'text-amber-500',
    badge: 'bg-amber-500/10 text-amber-700 border-amber-200/50 hover:bg-amber-500/20 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40 dark:hover:bg-amber-950/60',
  },
  high: {
    border: 'border-l-4 border-l-red-500',
    hoverBorder: 'hover:border-red-500/25',
    gradient: 'from-red-500/5 via-transparent to-transparent',
    iconColor: 'text-red-600 dark:text-red-400',
    badge: 'bg-red-500/10 text-red-700 border-red-200/50 hover:bg-red-500/20 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/40 dark:hover:bg-red-950/60',
  },
};

export function MenteeCard({ student, risk, isSelected, onSelectChange, onAction, onUpdate }: MenteeCardProps) {
  const { attendance } = usePlacementStore();

  const riskValue = (risk?.level || 'safe') as RiskLevel;
  const theme = RISK_THEMES[riskValue] || RISK_THEMES.safe;
  
  const inactiveDays = student.last_activity_date ? differenceInDays(new Date(), new Date(student.last_activity_date)) : 999;
  const progressValue = STAGE_PROGRESS[student.stage as StudentStage] || 0;

  // Calculate dynamic attendance rate for this student
  const studentAttendance = attendance.filter((a) => a.student_id === student.id);
  const totalSessions = studentAttendance.length;
  const presentSessions = studentAttendance.filter((a) => a.present).length;
  const attendanceRate = totalSessions > 0 ? Math.round((presentSessions / totalSessions) * 100) : 100;

  // Get initials for Avatar
  const initials = student.name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Status Badge Logic: Active, Completed (Hired), At Risk (High Risk), Terminated
  let statusText = 'Active';
  let statusBadgeClass = 'bg-indigo-500/10 text-indigo-700 border-indigo-200/40 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/40';

  if (student.hired) {
    statusText = 'Completed';
    statusBadgeClass = 'bg-emerald-500/10 text-emerald-700 border-emerald-200/40 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40';
  } else if (student.terminated) {
    statusText = 'Terminated';
    statusBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200/40 dark:bg-slate-800 dark:text-slate-350 dark:border-slate-700';
  } else if (riskValue === 'high') {
    statusText = 'At Risk';
    statusBadgeClass = 'bg-red-500/10 text-red-700 border-red-200/40 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/40';
  }

  return (
    <Card 
      className={cn(
        "relative overflow-hidden transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group bg-card flex flex-col min-h-[290px] border border-border/50",
        theme.border,
        theme.hoverBorder,
        isSelected && "ring-2 ring-primary border-transparent bg-primary/5"
      )}
    >
      {/* Dynamic gradient overlay mesh */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br pointer-events-none opacity-40 transition-opacity duration-300 group-hover:opacity-60',
          theme.gradient
        )}
      />

      <div className="absolute top-4 left-4 z-10">
        <Checkbox 
          checked={isSelected} 
          onCheckedChange={onSelectChange}
          className={cn(
            "rounded-md border-border/60 transition-opacity",
            !isSelected && "opacity-0 group-hover:opacity-100"
          )}
        />
      </div>
      
      <div className="absolute top-3 right-3 z-10">
        <RowActions student={student} onUpdate={onUpdate} onAction={onAction} />
      </div>

      <CardContent className="p-5 flex flex-col flex-1 relative z-10">
        {/* Header side-by-side layout */}
        <div className="flex gap-4 items-start mt-2 mb-4">
          <Avatar className="h-12 w-12 border-2 border-background shadow-xs shrink-0 transition-transform duration-300 group-hover:scale-105">
            <AvatarFallback className="bg-primary/10 text-primary font-black text-sm">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 
              className="font-bold text-foreground text-base tracking-tight cursor-pointer hover:underline truncate pr-6 transition-colors" 
              onClick={() => onAction('view_profile', student)}
            >
              {student.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium truncate">
              {student.batch} · {student.project || 'No Project'}
            </p>
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <Badge variant="outline" className={statusBadgeClass}>
            {statusText}
          </Badge>
          <Badge variant="outline" className={BADGE.stage[student.stage as StudentStage]}>
            {STAGE_LABEL[student.stage as StudentStage] || student.stage}
          </Badge>
          <Badge variant="outline" className={theme.badge}>
            {riskLabel(riskValue)}{risk?.manual_override ? ' · Manual' : ''}
          </Badge>
        </div>

        {/* Mid section: placement progress */}
        <div className="mb-5 space-y-1.5">
          <div className="flex justify-between text-[11px] font-semibold">
            <span className="text-muted-foreground">Placement Progress</span>
            <span className="font-bold text-foreground">{progressValue}%</span>
          </div>
          <Progress value={progressValue} className="h-1.5 [&_[data-slot=progress-track]]:bg-muted/60" />
        </div>

        {/* Key stats 2x2 grid */}
        <div className="mt-auto grid grid-cols-2 gap-2 text-xs">
          <div className="bg-muted/20 hover:bg-muted/35 dark:bg-muted/10 dark:hover:bg-muted/20 rounded-xl p-2.5 flex flex-col justify-center items-center text-center border border-border/30 transition-colors">
            <span className="text-muted-foreground font-bold mb-1 text-[9px] uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3 h-3 text-slate-400" /> Attendance
            </span>
            <span className={cn(
              'font-black text-sm tracking-tight',
              attendanceRate >= 90 ? 'text-emerald-600 dark:text-emerald-400' : attendanceRate >= 75 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'
            )}>
              {attendanceRate}%
            </span>
          </div>

          <div className="bg-muted/20 hover:bg-muted/35 dark:bg-muted/10 dark:hover:bg-muted/20 rounded-xl p-2.5 flex flex-col justify-center items-center text-center border border-border/30 transition-colors">
            <span className="text-muted-foreground font-bold mb-1 text-[9px] uppercase tracking-wider flex items-center gap-1">
              <Target className="w-3 h-3 text-slate-400" /> Performance
            </span>
            <span className="font-black text-sm text-foreground tracking-tight">
              {student.assignment_completion_pct ?? 0}%
            </span>
          </div>

          <div className="col-span-2 bg-muted/20 hover:bg-muted/35 dark:bg-muted/10 dark:hover:bg-muted/20 rounded-xl px-3 py-2 flex items-center justify-between border border-border/30 transition-colors">
            <span className="text-muted-foreground font-bold text-[9px] uppercase tracking-wider flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-slate-400" /> Last Active
            </span>
            <span className={cn(
              'font-bold text-[11px]',
              inactiveDays > 14 ? 'text-red-600 dark:text-red-400' : inactiveDays >= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
            )}>
              {student.last_activity_date ? formatDistanceToNow(new Date(student.last_activity_date), { addSuffix: true }) : 'No activity'}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
