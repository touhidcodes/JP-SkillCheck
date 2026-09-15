'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import { Student, StudentStage } from '@/types';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { FilterState } from '@/components/dashboard/student-filters';

const STAGE_STYLES: Record<string, string> = {
  learning:      'bg-slate-100 text-slate-700 border-slate-200/60 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  applying:      'bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40',
  interviewing:  'bg-orange-50 text-orange-700 border-orange-200/60 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/40',
  offer_pending: 'bg-yellow-50 text-yellow-800 border-yellow-200/60 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-900/40',
  placed:        'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40',
  hired:         'bg-green-50 text-green-700 border-green-200/60 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900/40',
};

const STAGE_LABELS: Record<string, string> = {
  learning: 'Learning', applying: 'Applying', interviewing: 'Interviewing',
  offer_pending: 'Offer Pending', placed: 'Placed', hired: 'Hired',
};

const JOB_FOCUS_STYLES: Record<string, string> = {
  remote: 'bg-sky-50 text-sky-700 border-sky-200/60 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/40',
  onsite: 'bg-orange-50 text-orange-700 border-orange-200/60 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/40',
  hybrid: 'bg-purple-50 text-purple-700 border-purple-200/60 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/40',
};

interface StudentTableProps {
  filters: FilterState;
}

export function StudentTable({ filters }: StudentTableProps) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStage, setBulkStage] = useState<StudentStage | ''>('');
  const limit = 20;

  useEffect(() => { setPage(1); }, [filters]);

  // Build clean query params - only include defined filter values
  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      queryParams.set(key, String(value));
    }
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['students', filters, page],
    queryFn: async () => {
      const res = await fetch(`/api/students?${queryParams.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const students: Student[] = data?.data || [];
  const total: number = data?.total || 0;
  const totalPages: number = data?.pages || 1;

  const bulkMoveMutation = useMutation({
    mutationFn: async ({ ids, stage }: { ids: string[]; stage: StudentStage }) => {
      const res = await fetch('/api/students/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_ids: ids, updates: { stage } }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || 'Bulk update failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Updated ${data.updated} students`);
      setSelectedIds(new Set());
      setBulkStage('');
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(students.map(s => s.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const handleBulkMove = () => {
    if (!bulkStage || selectedIds.size === 0) return;
    bulkMoveMutation.mutate({ ids: Array.from(selectedIds), stage: bulkStage as StudentStage });
  };

  return (
    <div className="space-y-3">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/30">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <Select value={bulkStage} onValueChange={(v) => setBulkStage(v as StudentStage)}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="Move to stage…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="learning">Learning</SelectItem>
                <SelectItem value="applying">Applying</SelectItem>
                <SelectItem value="interviewing">Interviewing</SelectItem>
                <SelectItem value="offer_pending">Offer Pending</SelectItem>
                <SelectItem value="placed">Placed</SelectItem>
                <SelectItem value="hired">Hired</SelectItem>
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5"
              disabled={!bulkStage || bulkMoveMutation.isPending}
              onClick={handleBulkMove}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              Apply
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      <div className="rounded-2xl border border-border/40 bg-card overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/60">
              <TableHead className="py-3 pl-4 w-10">
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-input accent-primary cursor-pointer"
                  checked={students.length > 0 && selectedIds.size === students.length}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3">Name</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3">Project</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3">Batch</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3">Stage</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3">Risk</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3">Focus</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3">Exp.</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3">Status</TableHead>
              <TableHead className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-3">Last Active</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={10} className="py-16 text-center">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : error ? (
              <TableRow>
                <TableCell colSpan={10} className="py-12 text-center text-sm text-destructive">
                  Failed to load students
                </TableCell>
              </TableRow>
            ) : students.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="py-12 text-center text-sm text-muted-foreground">
                  No students found
                </TableCell>
              </TableRow>
            ) : (
              students.map((student) => {
                const inactiveDays = (() => {
                  if (!student.last_activity_date) return 999;
                  const date = new Date(student.last_activity_date);
                  if (Number.isNaN(date.getTime())) return 999;
                  return differenceInDays(new Date(), date);
                })();

                return (
                  <TableRow
                    key={student.id}
                    className={cn(
                      'border-b border-border/40 transition-colors hover:bg-muted/15',
                      student.terminated
                        ? 'bg-red-500/5 text-muted-foreground/80 dark:bg-red-950/10'
                        : student.hired
                        ? 'bg-emerald-500/5 dark:bg-emerald-950/10'
                        : selectedIds.has(student.id)
                        ? 'bg-primary/5'
                        : '',
                    )}
                  >
                    <TableCell className="py-3 pl-4">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-input accent-primary cursor-pointer"
                        checked={selectedIds.has(student.id)}
                        onChange={(e) => handleSelectRow(student.id, e.target.checked)}
                      />
                    </TableCell>
                    <TableCell className="py-3">
                      <div className="flex items-start gap-2">
                        <div className="mt-1.5">
                          {student.terminated && (
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 block" />
                          )}
                          {student.hired && !student.terminated && (
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0 block" />
                          )}
                        </div>
                        <div>
                          <div className={cn(
                            'text-sm font-semibold text-foreground leading-snug',
                            student.terminated && 'line-through text-muted-foreground'
                          )}>
                            {student.name}
                          </div>
                          {student.student_email && (
                            <div className="text-[10px] font-medium text-muted-foreground dark:text-slate-400 mt-0.5">
                              {student.student_email}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="py-3">
                      {student.project ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-indigo-50 text-indigo-700 border-indigo-200/60 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/40 whitespace-nowrap">
                          {student.project}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="py-3">
                      <span className="text-xs text-muted-foreground font-medium">{student.batch || '—'}</span>
                    </TableCell>

                    <TableCell className="py-3">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border',
                        STAGE_STYLES[student.stage] ?? 'bg-slate-100 text-slate-700 border-slate-200/60 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
                      )}>
                        {STAGE_LABELS[student.stage] ?? student.stage}
                      </span>
                    </TableCell>

                    <TableCell className="py-3">
                      {student.risk_status === 'at_risk' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/40">
                          At Risk
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40">
                          Safe
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="py-3">
                      {student.job_focus ? (
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize',
                          JOB_FOCUS_STYLES[student.job_focus] ?? '',
                        )}>
                          {student.job_focus}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="py-3">
                      {student.experience === 'fresher' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-sky-50 text-sky-700 border-sky-200/60 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900/40">
                          Fresher
                        </span>
                      )}
                      {student.experience === 'experienced' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-violet-50 text-violet-700 border-violet-200/60 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/40">
                          Experienced
                        </span>
                      )}
                      {!student.experience && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="py-3">
                      <div className="flex gap-1">
                        {student.hired && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-emerald-600/10 text-emerald-700 border-emerald-500/20 dark:border-emerald-900/30 dark:bg-emerald-950/40 dark:text-emerald-400">
                            Hired
                          </span>
                        )}
                        {student.terminated && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-red-600/10 text-red-700 border-red-500/20 dark:border-red-900/30 dark:bg-red-950/40 dark:text-red-400">
                            Terminated
                          </span>
                        )}
                        {!student.hired && !student.terminated && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="py-3">
                      <span className={cn(
                        'text-xs font-semibold',
                        student.last_activity_date
                          ? (inactiveDays > 14
                              ? 'text-red-600 dark:text-red-400'
                              : inactiveDays >= 7
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400')
                          : 'text-muted-foreground'
                      )}>
                        {student.last_activity_date
                          ? formatDistanceToNow(new Date(student.last_activity_date), { addSuffix: true })
                          : 'No activity'}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <p className="text-xs text-muted-foreground">
            Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}