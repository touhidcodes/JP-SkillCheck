'use client';

import Link from 'next/link';
import { Sparkles, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface Student {
  id: string;
  name: string;
  stage: string;
  interview_count?: number;
}

interface ProgressLog {
  student_id: string;
  note?: string;
  logged_at?: string;
  scheduled_date?: string;
}

interface AttendanceRecord {
  date: string;
}

interface MentorSmartNudgesProps {
  students: Student[];
  progressLogs: ProgressLog[];
  attendance: AttendanceRecord[];
}

interface NudgeItem {
  text: string;
  href: string;
}

function computeNudges(students: Student[], progressLogs: ProgressLog[], attendance: AttendanceRecord[]): NudgeItem[] {
  const nudges: NudgeItem[] = [];

  const noNotes = students.filter((s) => !progressLogs.some((l) =>
    l.student_id === s.id && l.note &&
    Date.now() - new Date(l.logged_at || l.scheduled_date || '').getTime() < 14 * 24 * 60 * 60 * 1000
  )).length;
  if (noNotes > 0) {
    nudges.push({
      text: `Log progress notes for ${noNotes} students stalling past 14+ days`,
      href: '/mentor/students/progress-logs',
    });
  }

  const stalled = students.filter((s) => s.stage === 'applying' && (s.interview_count || 0) === 0).length;
  if (stalled > 0) {
    nudges.push({
      text: `Prep ${stalled} active mentees in 'Applying' stage with 0 mock interviews`,
      href: '/mentor/placement',
    });
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const takenToday = attendance.some((a) => a.date === todayStr);
  if (!takenToday) {
    nudges.push({
      text: "Take attendance session for today to keep tracking accurate",
      href: '/mentor/students/attendance',
    });
  }

  if (nudges.length === 0) {
    nudges.push({
      text: "All clear! You are fully caught up with no pending alerts.",
      href: '/mentor/students',
    });
  }
  return nudges;
}

export function MentorSmartNudges({ students, progressLogs, attendance }: MentorSmartNudgesProps) {
  const nudges = computeNudges(students, progressLogs, attendance);

  return (
    <Card className="rounded-2xl border border-border/50 bg-card shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group relative">
      {/* Decorative colored glow bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />
      
      <CardContent className="p-5">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <h2 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-amber-500 animate-pulse fill-amber-500/10" />
            <span>Smart Nudges</span>
          </h2>
          <span className="text-[9px] font-extrabold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
            AI Insights
          </span>
        </div>
        
        <div className="mt-4 space-y-2.5">
          {nudges.map((nudge, index) => (
            <Link
              key={index}
              href={nudge.href}
              className="flex items-center justify-between rounded-xl border border-amber-200/50 dark:border-amber-950/20 bg-amber-500/[0.03] dark:bg-amber-500/[0.04] px-3.5 py-3 text-xs text-amber-900 dark:text-amber-300 font-bold transition-all duration-300 hover:bg-amber-500/10 hover:border-amber-300 dark:hover:border-amber-900/40 hover:-translate-x-0.5 group/nudge cursor-pointer shadow-2xs"
            >
              <span className="flex-1 min-w-0 pr-2 leading-relaxed">{nudge.text}</span>
              <div className="h-6 w-6 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover/nudge:translate-x-0.5">
                <ArrowRight className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 stroke-[2.5]" />
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
