'use client';

import { Flame, Trophy, Database, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface Alert {
  id: string;
  student_name: string;
  level: string;
  created_at: string;
}

interface Student {
  id: string;
  name: string;
  hired: boolean;
  hired_date?: string;
  updated_at: string;
}

interface ImportHistory {
  id: string;
  imported: number;
  updated: number;
  created_at: string;
}

interface MentorActivityFeedProps {
  alerts: Alert[];
  students: Student[];
  importHistory: ImportHistory[];
}

function FeedItem({ text, date, tone }: { text: string; date?: string; tone: 'risk' | 'success' | 'import' }) {
  const configs = {
    risk: {
      bg: 'bg-red-500/5 dark:bg-red-500/10 border-red-100 dark:border-red-950/30',
      iconBg: 'bg-red-500/15 dark:bg-red-500/20 text-red-600 dark:text-red-400',
      icon: Flame,
    },
    success: {
      bg: 'bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-950/30',
      iconBg: 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400',
      icon: Trophy,
    },
    import: {
      bg: 'bg-purple-500/5 dark:bg-purple-500/10 border-purple-100 dark:border-purple-950/30',
      iconBg: 'bg-purple-500/15 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400',
      icon: Database,
    },
  };

  const config = configs[tone];
  const Icon = config.icon;

  return (
    <div className={`flex gap-3.5 rounded-xl border p-3.5 shadow-xs transition-all duration-300 hover:shadow-sm hover:-translate-x-0.5 ${config.bg}`}>
      <div className={`p-2 rounded-lg shrink-0 flex items-center justify-center h-9 w-9 ${config.iconBg}`}>
        <Icon className="h-4.5 w-4.5 stroke-[2.2]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-normal">
          {text}
        </p>
        <div className="flex items-center gap-1.5 text-muted-foreground/70 dark:text-slate-400 mt-1.5">
          <Calendar className="h-3 w-3 shrink-0" />
          <span className="text-[9px] font-bold uppercase tracking-wider">
            {date ? new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "today"}
          </span>
        </div>
      </div>
    </div>
  );
}

export function MentorActivityFeed({ alerts, students, importHistory }: MentorActivityFeedProps) {
  const feedItems = [
    ...alerts.slice(0, 4).map((alert) => ({
      id: alert.id,
      text: `${alert.student_name} crossed ${alert.level.toUpperCase()} RISK threshold`,
      date: alert.created_at,
      tone: 'risk' as const,
    })),
    ...students.filter((s) => s.hired).slice(0, 3).map((s) => ({
      id: s.id,
      text: `${s.name} marked as Hired`,
      date: s.hired_date || s.updated_at,
      tone: 'success' as const,
    })),
    ...importHistory.slice(0, 3).map((item) => ({
      id: item.id,
      text: `Excel import: ${item.imported + item.updated} students synced`,
      date: item.created_at,
      tone: 'import' as const,
    })),
  ].sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());

  return (
    <Card className="rounded-2xl border border-border/50 bg-card shadow-sm hover:shadow-md transition-all duration-300">
      <CardContent className="p-5">
        <div className="flex items-center justify-between border-b border-border/40 pb-3">
          <h2 className="font-bold text-slate-900 dark:text-white text-base">Activity Feed</h2>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted px-2 py-0.5 rounded-full">
            Realtime Logs
          </span>
        </div>
        <div className="mt-4 space-y-3 max-h-[360px] overflow-y-auto pr-1">
          {feedItems.slice(0, 8).map((item) => (
            <FeedItem key={item.id} {...item} />
          ))}
          {feedItems.length === 0 && (
            <p className="rounded-xl border border-dashed border-border/60 p-8 text-center text-xs text-muted-foreground font-semibold">
              Activity appears here after imports and updates.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
