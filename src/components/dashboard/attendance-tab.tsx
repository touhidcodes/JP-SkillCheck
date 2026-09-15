'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { Loader2, Plus, CalendarDays, CheckCircle2, XCircle, Pencil } from 'lucide-react';
import type { Student, AbsenceExcuse } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  present: boolean;
  logged_by: string;
  session_label: string;
  excuse: string;
  excuse_note: string;
}

interface AttendanceTabProps {
  student: Student;
}

const EXCUSE_LABELS: Record<string, string> = {
  exam: '📝 Exam',
  sick: '🤒 Sick',
  personal: '🏠 Personal',
  other: '📌 Other',
};

// ── Pill ───────────────────────────────────────────────────────────────────
function AttendancePill({
  present,
  excuse,
  onClick,
  disabled,
}: {
  present: boolean | null;
  excuse?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  if (present === null) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className="w-full h-7 rounded-full text-[11px] font-medium border-2 border-dashed border-border/40 bg-muted/30 text-muted-foreground/50 hover:border-primary/40 hover:bg-primary/5 transition-colors"
      >
        —
      </button>
    );
  }

  const isExcused = !present && excuse && excuse.trim() !== '';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={`Click to mark ${present ? 'Absent' : 'Present'}`}
      className={cn(
        'w-full h-7 rounded-full text-[11px] font-semibold transition-all duration-150 flex items-center justify-center gap-1 truncate px-2',
        present
          ? 'bg-green-200 text-green-800 hover:bg-green-300 border border-green-300'
          : isExcused
          ? 'bg-amber-200 text-amber-800 hover:bg-amber-300 border border-amber-300'
          : 'bg-red-200 text-red-800 hover:bg-red-300 border border-red-300',
        disabled && 'cursor-default',
      )}
    >
      {present ? 'Present' : isExcused ? (EXCUSE_LABELS[excuse!] ?? 'Excused') : 'Absent'}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function AttendanceTab({ student }: AttendanceTabProps) {
  const queryClient = useQueryClient();
  const [showAddSession, setShowAddSession] = useState(false);
  // Tracks which date cell is showing the excuse picker
  const [excusePickerDate, setExcusePickerDate] = useState<string | null>(null);
  const [pendingExcuse, setPendingExcuse] = useState<AbsenceExcuse | ''>('');
  const [pendingExcuseNote, setPendingExcuseNote] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', student.id],
    queryFn: async () => {
      const res = await fetch(`/api/attendance?student_id=${student.id}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<{ data: AttendanceRecord[]; total: number }>;
    },
  });

  const records = data?.data ?? [];
  const dates = Array.from(new Set(records.map(r => r.date))).sort();
  const byDate = records.reduce<Record<string, AttendanceRecord>>((acc, r) => {
    acc[r.date] = r;
    return acc;
  }, {});

  const presentCount = records.filter(r => r.present).length;
  const absentCount = records.filter(r => !r.present).length;
  const excusedCount = records.filter(r => !r.present && r.excuse).length;
  const rate = records.length > 0 ? Math.round((presentCount / records.length) * 100) : null;

  const toggleMutation = useMutation({
    mutationFn: async (payload: {
      date: string;
      present: boolean;
      session_label: string;
      excuse?: AbsenceExcuse | '';
      excuse_note?: string;
    }) => {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: student.id, ...payload }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', student.id] });
      setExcusePickerDate(null);
      setPendingExcuse('');
      setPendingExcuseNote('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const editExcuseMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      excuse: AbsenceExcuse | '';
      excuse_note: string;
    }) => {
      const res = await fetch(`/api/attendance/${payload.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excuse: payload.excuse, excuse_note: payload.excuse_note }),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Failed to update');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', student.id] });
      setExcusePickerDate(null);
      setPendingExcuse('');
      setPendingExcuseNote('');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCellClick = (date: string, rec: AttendanceRecord | undefined) => {
    if (!rec) {
      toggleMutation.mutate({ date, present: true, session_label: '' });
      return;
    }
    if (rec.present) {
      setExcusePickerDate(date);
      setPendingExcuse('');
      setPendingExcuseNote('');
    } else {
      toggleMutation.mutate({ date, present: true, session_label: rec.session_label, excuse: '', excuse_note: '' });
    }
  };

  const handleExcuseSubmit = (date: string, rec: AttendanceRecord) => {
    toggleMutation.mutate({
      date,
      present: false,
      session_label: rec.session_label,
      excuse: pendingExcuse || '',
      excuse_note: pendingExcuseNote || '',
    });
  };

  const handleExcuseEdit = (rec: AttendanceRecord) => {
    setExcusePickerDate(rec.date);
    setPendingExcuse((rec.excuse as AbsenceExcuse) || '');
    setPendingExcuseNote(rec.excuse_note || '');
  };

  const handleExcuseUpdate = (rec: AttendanceRecord) => {
    editExcuseMutation.mutate({
      id: rec.id,
      excuse: pendingExcuse || '',
      excuse_note: pendingExcuseNote || '',
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />
          <span className="font-medium">{presentCount}</span>
          <span className="text-muted-foreground">Present</span>
        </div>
        <div className="flex items-center gap-1.5 text-sm">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" />
          <span className="font-medium">{absentCount}</span>
          <span className="text-muted-foreground">Absent</span>
        </div>
        {excusedCount > 0 && (
          <div className="flex items-center gap-1.5 text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
            <span className="font-medium">{excusedCount}</span>
            <span className="text-muted-foreground">Excused</span>
          </div>
        )}
        {rate !== null && (
          <Badge
            variant="outline"
            className={cn(
              'text-xs font-semibold',
              rate >= 80 ? 'text-green-700 border-green-300 bg-green-50'
                : rate >= 60 ? 'text-amber-700 border-amber-300 bg-amber-50'
                : 'text-red-700 border-red-300 bg-red-50',
            )}
          >
            {rate}% attendance
          </Badge>
        )}
        <div className="ml-auto">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setShowAddSession(v => !v)}>
            <Plus className="h-3.5 w-3.5" /> Add Session
          </Button>
        </div>
      </div>

      {showAddSession && (
        <AddSessionForm
          studentId={student.id}
          onSuccess={() => { setShowAddSession(false); queryClient.invalidateQueries({ queryKey: ['attendance', student.id] }); }}
          onCancel={() => setShowAddSession(false)}
        />
      )}

      {dates.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
          <CalendarDays className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No attendance records yet</p>
        </div>
      ) : (
        <ScrollArea className="w-full rounded-lg border border-border/60">
          <div className="min-w-max">
            {/* Header */}
            <div
              className="grid bg-violet-700 text-white text-xs font-semibold"
              style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(110px, 1fr))` }}
            >
              {dates.map(date => {
                const rec = byDate[date];
                const label = rec?.session_label || '';
                let display = date;
                try { display = format(parseISO(date), 'd MMM'); } catch { /* noop */ }
                return (
                  <div key={date} className="px-3 py-2.5 text-center border-r border-violet-600 last:border-r-0">
                    <div className="font-semibold">{label || display}</div>
                    {label && <div className="text-violet-200 text-[10px] font-normal mt-0.5">{display}</div>}
                  </div>
                );
              })}
            </div>

            {/* Row */}
            <div
              className="grid bg-white"
              style={{ gridTemplateColumns: `repeat(${dates.length}, minmax(110px, 1fr))` }}
            >
              {dates.map(date => {
                const rec = byDate[date];
                const isPickerOpen = excusePickerDate === date;
                return (
                  <div key={date} className="px-2 py-2 border-r border-b border-border/40 last:border-r-0">
                    <div className="relative">
                      <AttendancePill
                        present={rec ? rec.present : null}
                        excuse={rec?.excuse}
                        onClick={() => handleCellClick(date, rec)}
                        disabled={toggleMutation.isPending}
                      />
                      {rec && !rec.present && (
                        <button
                          onClick={() => handleExcuseEdit(rec)}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-violet-100 border border-violet-300 flex items-center justify-center hover:bg-violet-200 transition-colors"
                          title="Edit excuse"
                        >
                          <Pencil className="w-2.5 h-2.5 text-violet-600" />
                        </button>
                      )}
                    </div>
                    {/* Excuse picker/editor — shown when opening from present or editing existing */}
                    {isPickerOpen && rec && (
                      <div className="mt-2 p-2 rounded-lg border border-amber-200 bg-amber-50 space-y-2 text-xs">
                        <p className="font-semibold text-amber-800">{rec.present ? 'Mark Absent' : 'Edit Excuse'}</p>
                        <Select value={pendingExcuse} onValueChange={v => setPendingExcuse(v as AbsenceExcuse | '')}>
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Select reason" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">No excuse</SelectItem>
                            <SelectItem value="exam">📝 Exam</SelectItem>
                            <SelectItem value="sick">🤒 Sick</SelectItem>
                            <SelectItem value="personal">🏠 Personal</SelectItem>
                            <SelectItem value="other">📌 Other</SelectItem>
                          </SelectContent>
                        </Select>
                        {(pendingExcuse || rec.excuse) && (
                          <Input
                            className="h-7 text-xs"
                            placeholder={pendingExcuse === 'other' ? 'Note required *' : 'Note (optional)'}
                            value={pendingExcuseNote}
                            onChange={e => setPendingExcuseNote(e.target.value)}
                          />
                        )}
                        {(pendingExcuse === 'other' && !pendingExcuseNote.trim()) && (
                          <p className="text-[10px] text-red-500">Note required for &quot;other&quot; excuse</p>
                        )}
                        <div className="flex gap-1.5">
                          {rec.present ? (
                            <Button
                              size="sm"
                              className="h-6 text-[11px] bg-red-600 hover:bg-red-700 px-2"
                              onClick={() => handleExcuseSubmit(date, rec)}
                              disabled={toggleMutation.isPending || (pendingExcuse === 'other' && !pendingExcuseNote.trim())}
                            >
                              Mark Absent
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="h-6 text-[11px] bg-violet-600 hover:bg-violet-700 px-2"
                              onClick={() => handleExcuseUpdate(rec)}
                              disabled={editExcuseMutation.isPending || (pendingExcuse === 'other' && !pendingExcuseNote.trim())}
                            >
                              {editExcuseMutation.isPending ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Update'}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-[11px] px-2"
                            onClick={() => setExcusePickerDate(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}
    </div>
  );
}

// ── Add session form ───────────────────────────────────────────────────────
function AddSessionForm({ studentId, onSuccess, onCancel }: { studentId: string; onSuccess: () => void; onCancel: () => void }) {
  const [date, setDate] = useState('');
  const [sessionLabel, setSessionLabel] = useState('');
  const [present, setPresent] = useState(true);
  const [excuse, setExcuse] = useState<AbsenceExcuse | ''>('');
  const [excuseNote, setExcuseNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) { toast.error('Date is required'); return; }
    if (!present && excuse === 'other' && !excuseNote.trim()) {
      toast.error('A note is required when excuse is "other"');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: studentId,
          date,
          present,
          session_label: sessionLabel.trim(),
          ...((!present && excuse) ? { excuse, excuse_note: excuseNote } : {}),
        }),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.message || 'Failed'); return; }
      toast.success('Attendance recorded');
      onSuccess();
    } catch { toast.error('An error occurred'); }
    finally { setIsLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-violet-200 bg-violet-50/40 p-4 space-y-3">
      <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">New Session</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Date</label>
          <Input type="date" className="h-8 text-xs" value={date} onChange={e => setDate(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Session label <span className="text-muted-foreground font-normal">(optional)</span></label>
          <Input className="h-8 text-xs" placeholder="e.g. Orientation" value={sessionLabel} onChange={e => setSessionLabel(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={() => setPresent(true)}
          className={cn('flex-1 h-8 rounded-full text-xs font-semibold border transition-all',
            present ? 'bg-green-200 text-green-800 border-green-300' : 'bg-muted text-muted-foreground border-border hover:bg-green-50')}>
          <CheckCircle2 className="inline w-3.5 h-3.5 mr-1" /> Present
        </button>
        <button type="button" onClick={() => setPresent(false)}
          className={cn('flex-1 h-8 rounded-full text-xs font-semibold border transition-all',
            !present ? 'bg-red-200 text-red-800 border-red-300' : 'bg-muted text-muted-foreground border-border hover:bg-red-50')}>
          <XCircle className="inline w-3.5 h-3.5 mr-1" /> Absent
        </button>
      </div>
      {!present && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Excuse <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Select value={excuse} onValueChange={v => setExcuse(v as AbsenceExcuse | '')}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                <SelectItem value="exam">📝 Exam</SelectItem>
                <SelectItem value="sick">🤒 Sick</SelectItem>
                <SelectItem value="personal">🏠 Personal</SelectItem>
                <SelectItem value="other">📌 Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(excuse === 'other' ? (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Note <span className="text-red-500">*</span></label>
                  <Input
                    className="h-8 text-xs"
                    placeholder="Required for 'other' excuse"
                    value={excuseNote}
                    onChange={e => setExcuseNote(e.target.value)}
                    required
                  />
                </div>
              ) : excuse ? (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Note <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Input className="h-8 text-xs" placeholder="Details…" value={excuseNote} onChange={e => setExcuseNote(e.target.value)} />
                </div>
              ) : null)}
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <Button type="submit" size="sm" className="bg-violet-600 hover:bg-violet-700 h-8 text-xs" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Save
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8 text-xs" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
