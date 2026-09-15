'use client';

import { useQuery } from '@tanstack/react-query';
import { format, subDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface DayData {
  date: string;
  status: 'present' | 'absent' | 'excused' | 'no_session';
  session_label?: string;
  note?: string;
}

interface AttendanceHeatmapProps {
  studentId: string;
  days?: number;
}

const STATUS_COLORS = {
  present: 'bg-emerald-400',
  absent: 'bg-red-400',
  excused: 'bg-amber-400',
  no_session: 'bg-muted',
};

const STATUS_LABELS = {
  present: 'Present',
  absent: 'Absent (unexcused)',
  excused: 'Absent (excused)',
  no_session: 'No session',
};

export function AttendanceHeatmap({ studentId, days = 90 }: AttendanceHeatmapProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['attendance-heatmap', studentId, days],
    queryFn: async () => {
      const from = format(subDays(new Date(), days), 'yyyy-MM-dd');
      const to = format(new Date(), 'yyyy-MM-dd');
      const res = await fetch(`/api/analytics/attendance?studentId=${studentId}&from=${from}&to=${to}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const dayData: DayData[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = format(subDays(new Date(), i), 'yyyy-MM-dd');

    const sessionsOnDate: Array<{ date: string; present: boolean; excuse?: string; session_label?: string; excuse_note?: string }> = [];
    if (data?.logs) {
      for (const log of data.logs) {
        if (log.date === date) sessionsOnDate.push(log);
      }
    }

    if (sessionsOnDate.length === 0) {
      dayData.push({ date, status: 'no_session' });
    } else {
      const first = sessionsOnDate[0];
      if (first.present) {
        dayData.push({ date, status: 'present', session_label: first.session_label });
      } else if (first.excuse && first.excuse.trim()) {
        dayData.push({ date, status: 'excused', session_label: first.session_label, note: first.excuse_note });
      } else {
        dayData.push({ date, status: 'absent', session_label: first.session_label });
      }
    }
  }

  const weeks: DayData[][] = [];
  for (let i = 0; i < dayData.length; i += 7) {
    weeks.push(dayData.slice(i, i + 7));
  }

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-emerald-400" />
          <span>Present</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-400" />
          <span>Absent</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-amber-400" />
          <span>Excused</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-muted border border-border" />
          <span>No session</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-0.5 min-w-max">
          <div className="flex flex-col gap-0.5 mr-1">
            {dayLabels.map(label => (
              <div key={label} className="h-4 flex items-center">
                <span className="text-[10px] text-muted-foreground w-6">{label}</span>
              </div>
            ))}
          </div>

          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-0.5">
              {week.map((day, di) => {
                const firstDate = week[0]?.date;
                let showMonthLabel = false;
                if (firstDate && di === 0) {
                  try {
                    const d = parseISO(firstDate);
                    showMonthLabel = d.getDate() <= 7;
                  } catch { /* noop */ }
                }

                return (
                  <div key={di} className="relative group">
                    {showMonthLabel && (
                      <span className="absolute -top-4 left-0 text-[9px] text-muted-foreground">
                        {format(parseISO(day.date), 'MMM')}
                      </span>
                    )}
                    <div
                      className={cn(
                        'w-4 h-4 rounded-sm cursor-pointer transition-opacity hover:opacity-80',
                        STATUS_COLORS[day.status]
                      )}
                      title={`${format(parseISO(day.date), 'MMM d, yyyy')}\n${STATUS_LABELS[day.status]}${day.session_label ? ` — ${day.session_label}` : ''}`}
                    />
                    <div className={cn(
                      'absolute z-10 hidden group-hover:block',
                      'bottom-full left-1/2 -translate-x-1/2 mb-1',
                      'bg-background border border-border rounded-lg shadow-lg',
                      'p-2 text-xs whitespace-nowrap pointer-events-none'
                    )}>
                      <p className="font-medium text-foreground">{format(parseISO(day.date), 'MMM d, yyyy')}</p>
                      <p className="text-muted-foreground">{STATUS_LABELS[day.status]}</p>
                      {day.session_label && (
                        <p className="text-muted-foreground">{day.session_label}</p>
                      )}
                      {day.note && (
                        <p className="text-muted-foreground/70 mt-1">Note: {day.note}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}