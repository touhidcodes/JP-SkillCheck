'use client';

import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { isPast, isToday, formatDistanceToNow } from 'date-fns';
import {
  Search, X, Plus, CheckCircle2, Circle, Info,
  User, Calendar, Flag, Edit3, Trash2,
  MoreHorizontal, ListTodo, ArrowUpDown, ChevronUp, ChevronDown,
  Loader2, Check
} from 'lucide-react';

import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogMedia, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Pagination, PaginationContent, PaginationEllipsis,
  PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';

import { cn } from '@/lib/utils';
import { TaskStats } from '@/components/mentor/tasks/task-stats';
import { TaskAnalytics } from '@/components/mentor/tasks/task-analytics';
import { CreateTaskDialog } from '@/components/mentor/tasks/create-task-dialog';
import { EditTaskDialog } from '@/components/mentor/tasks/edit-task-dialog';
import { MentorTask, TaskPriority } from '@/types';

// ─── Constants & Weights ──────────────────────────────────────────────────────

const PRIORITY_WEIGHTS: Record<TaskPriority, number> = {
  critical: 0, high: 1, medium: 2, low: 3,
};

const PRIORITY_CONFIG: Record<TaskPriority, {
  dot: string; badge: string; label: string;
}> = {
  critical: { dot: 'bg-red-500',    badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30',       label: 'Critical' },
  high:     { dot: 'bg-amber-500',  badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30', label: 'High' },
  medium:   { dot: 'bg-blue-500',   badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30',    label: 'Medium' },
  low:      { dot: 'bg-slate-400',  badge: 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700', label: 'Low' },
};

// ─── Avatar Color Helpers ─────────────────────────────────────────────────────

function getInitials(name?: string) {
  if (!name) return 'ME';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

function getAvatarColor(name?: string) {
  if (!name) return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-350 border-slate-200 dark:border-slate-700';
  const colors = [
    'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400 border-indigo-100 dark:border-indigo-900/30',
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30',
    'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border-amber-100 dark:border-amber-900/30',
    'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border-rose-100 dark:border-rose-900/30',
    'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400 border-purple-100 dark:border-purple-900/30',
    'bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400 border-sky-100 dark:border-sky-900/30',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function TableRowSkeleton() {
  return (
    <TableRow>
      <TableCell className="w-10 pl-4"><Skeleton className="w-4 h-4 rounded" /></TableCell>
      <TableCell className="w-10"><Skeleton className="w-5 h-5 rounded-full" /></TableCell>
      <TableCell>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-4 w-14 rounded-full" />
          </div>
          <Skeleton className="h-3 w-64" />
          <div className="flex gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
      <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-14 rounded-full" /></TableCell>
      <TableCell className="text-right pr-4"><Skeleton className="h-7 w-7 ml-auto rounded-md" /></TableCell>
    </TableRow>
  );
}

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function MentorTasksPage() {
  const queryClient = useQueryClient();

  // ── State ──────────────────────────────────────────────────────────────────
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('pending');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  
  const [sortBy, setSortBy] = useState<'due_date' | 'priority' | 'student_name' | 'title' | 'task_type'>('due_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [editingTask, setEditingTask] = useState<MentorTask | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(val);
      setCurrentPage(1);
    }, 300);
  };

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: tasksData, isLoading: isLoadingTasks } = useQuery<{ data: MentorTask[]; total: number }>({
    queryKey: ['tasks', filter],
    queryFn: async () => {
      const res = await fetch(`/api/mentor/tasks?filter=${filter}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const { data: studentsData } = useQuery({
    queryKey: ['mentor-students'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/mentor');
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60 * 1000,
  });

  // ── Single Actions Mutations ───────────────────────────────────────────────
  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const res = await fetch('/api/mentor/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, completed }),
      });
      if (!res.ok) throw new Error('Failed to update task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/mentor/tasks?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete task');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTaskIds(prev => prev.filter(tid => tid !== deleteTargetId));
      toast.success('Task deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Bulk Actions Mutations ─────────────────────────────────────────────────
  const bulkToggleMutation = useMutation({
    mutationFn: async ({ ids, completed }: { ids: string[]; completed: boolean }) => {
      // Run sequentially to prevent row conflicts in Google Sheets
      for (const id of ids) {
        await fetch('/api/mentor/tasks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, completed }),
        });
      }
    },
    onMutate: () => {
      toast.loading(`Updating ${selectedTaskIds.length} tasks…`, { id: 'bulk-update' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTaskIds([]);
      toast.success('Tasks updated successfully', { id: 'bulk-update' });
    },
    onError: (err: Error) => {
      toast.error(`Failed to update tasks: ${err.message}`, { id: 'bulk-update' });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Run sequentially to prevent row index shifts in Google Sheets
      for (const id of ids) {
        await fetch(`/api/mentor/tasks?id=${id}`, { method: 'DELETE' });
      }
    },
    onMutate: () => {
      toast.loading(`Deleting ${selectedTaskIds.length} tasks…`, { id: 'bulk-delete' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTaskIds([]);
      toast.success('Tasks deleted successfully', { id: 'bulk-delete' });
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete tasks: ${err.message}`, { id: 'bulk-delete' });
    },
  });

  // ── Derived data ───────────────────────────────────────────────────────────
  const tasks = useMemo<MentorTask[]>(
    () => (Array.isArray(tasksData?.data) ? tasksData.data : []),
    [tasksData]
  );

  const students = useMemo(() =>
    Array.from(
      new Map(
        (studentsData?.activeMenteesList ?? [])
          .filter((s: { id: string; name: string }) => s.id && s.name)
          .map((s: { id: string; name: string }) => [s.id, { id: s.id, name: s.name }])
      ).values()
    ) as { id: string; name: string }[],
    [studentsData]
  );

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // search filter
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description && t.description.toLowerCase().includes(q)) ||
        (t.student_name && t.student_name.toLowerCase().includes(q))
      );
    }

    // priority filter
    if (priorityFilter !== 'all') {
      result = result.filter(t => t.priority === priorityFilter);
    }

    // type filter
    if (typeFilter !== 'all') {
      result = result.filter(t => t.task_type === typeFilter);
    }

    // sorting
    return result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'priority') {
        comparison = (PRIORITY_WEIGHTS[a.priority] ?? 4) - (PRIORITY_WEIGHTS[b.priority] ?? 4);
      } else if (sortBy === 'student_name') {
        comparison = (a.student_name || '').localeCompare(b.student_name || '');
      } else if (sortBy === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else if (sortBy === 'task_type') {
        comparison = a.task_type.localeCompare(b.task_type);
      } else {
        comparison = new Date(a.due_date || 0).getTime() - new Date(b.due_date || 0).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [tasks, debouncedSearch, sortBy, sortOrder, priorityFilter, typeFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTasks = filteredTasks.slice((safePage - 1) * pageSize, safePage * pageSize);

  const getPageNumbers = (): (number | 'ellipsis')[] => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('ellipsis');
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  // Stats
  const stats = useMemo(() => {
    const pending = tasks.filter(t => !t.completed);
    const overdue = pending.filter(t => isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date)));
    const total = tasksData?.total || tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    return {
      pendingCount: pending.length,
      overdueCount: overdue.length,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      totalMentees: students.length,
    };
  }, [tasks, tasksData, students]);

  const handleEdit = (task: MentorTask) => {
    setEditingTask(task);
    setEditOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const confirmDelete = () => {
    if (!deleteTargetId) return;
    deleteMutation.mutate(deleteTargetId);
    setDeleteTargetId(null);
  };

  const handleSort = (key: typeof sortBy) => {
    if (sortBy === key) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  // Row Selection logic
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const pageIds = paginatedTasks.map(t => t.id);
      setSelectedTaskIds(prev => Array.from(new Set([...prev, ...pageIds])));
    } else {
      const pageIds = paginatedTasks.map(t => t.id);
      setSelectedTaskIds(prev => prev.filter(id => !pageIds.includes(id)));
    }
  };

  const handleSelectRow = (taskId: string, checked: boolean) => {
    if (checked) {
      setSelectedTaskIds(prev => [...prev, taskId]);
    } else {
      setSelectedTaskIds(prev => prev.filter(id => id !== taskId));
    }
  };

  const isAllPageSelected = paginatedTasks.length > 0 && paginatedTasks.every(t => selectedTaskIds.includes(t.id));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <div className="w-full space-y-6 pb-24 animate-in fade-in duration-550">
        
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">Pending Tasks</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Create, organize, and monitor operational actions and tasks for your cohort.
            </p>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            className="sm:ml-auto gap-1.5 h-10 px-4 bg-indigo-600 hover:bg-indigo-700 font-bold rounded-xl transition-all shadow-sm text-white"
          >
            <Plus className="w-4.5 h-4.5" /> Add Task
          </Button>
        </div>

        {/* ── Stats KPI Cards ── */}
        <TaskStats {...stats} />

        {/* ── Collapsible Analytics Charts ── */}
        <TaskAnalytics tasks={tasks} isLoading={isLoadingTasks} />

        {/* ── Filter & Search controls ── */}
        <Card className="border border-border/40 shadow-xs bg-slate-50/40 dark:bg-slate-900/10 p-4 rounded-2xl">
          <div className="flex flex-col xl:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-9 h-10 text-xs w-full bg-white dark:bg-slate-950 border-border/60 focus-visible:ring-1 focus-visible:ring-indigo-500 rounded-xl"
                placeholder="Search by title, description or student…"
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
                aria-label="Search tasks"
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); setDebouncedSearch(''); setCurrentPage(1); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Dropdowns filters */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Select */}
              <div className="flex flex-col gap-1 w-full sm:w-auto">
                <Select
                  value={filter}
                  onValueChange={v => { setFilter(v as typeof filter); setCurrentPage(1); }}
                >
                  <SelectTrigger className="h-10 w-full sm:w-auto min-w-[145px] text-xs bg-white dark:bg-slate-950 border-border/60 rounded-xl focus:ring-1">
                    <span className="text-slate-500 font-medium mr-1">Status:</span>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-md border-border/60">
                    <SelectItem value="pending" className="rounded-lg text-xs font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Pending
                      </span>
                    </SelectItem>
                    <SelectItem value="all" className="rounded-lg text-xs font-semibold">All Tasks</SelectItem>
                    <SelectItem value="completed" className="rounded-lg text-xs font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Completed
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Priority Select */}
              <div className="flex flex-col gap-1 w-full sm:w-auto">
                <Select
                  value={priorityFilter}
                  onValueChange={v => { setPriorityFilter(v); setCurrentPage(1); }}
                >
                  <SelectTrigger className="h-10 w-full sm:w-auto min-w-[165px] text-xs bg-white dark:bg-slate-950 border-border/60 rounded-xl focus:ring-1">
                    <span className="text-slate-500 font-medium mr-1">Priority:</span>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-md border-border/60">
                    <SelectItem value="all" className="rounded-lg text-xs font-semibold">All Priorities</SelectItem>
                    <SelectItem value="critical" className="rounded-lg text-xs text-red-650 font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> Critical
                      </span>
                    </SelectItem>
                    <SelectItem value="high" className="rounded-lg text-xs text-amber-600 font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> High
                      </span>
                    </SelectItem>
                    <SelectItem value="medium" className="rounded-lg text-xs text-blue-600 font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Medium
                      </span>
                    </SelectItem>
                    <SelectItem value="low" className="rounded-lg text-xs text-slate-500 font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Low
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Type Select */}
              <div className="flex flex-col gap-1 w-full sm:w-auto">
                <Select
                  value={typeFilter}
                  onValueChange={v => { setTypeFilter(v); setCurrentPage(1); }}
                >
                  <SelectTrigger className="h-10 w-full sm:w-auto min-w-[165px] text-xs bg-white dark:bg-slate-950 border-border/60 rounded-xl focus:ring-1">
                    <span className="text-slate-500 font-medium mr-1">Type:</span>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-md border-border/60">
                    <SelectItem value="all" className="rounded-lg text-xs font-semibold">All Types</SelectItem>
                    <SelectItem value="follow_up" className="rounded-lg text-xs font-semibold">Follow Up</SelectItem>
                    <SelectItem value="schedule_interview" className="rounded-lg text-xs font-semibold">Interview</SelectItem>
                    <SelectItem value="review_progress" className="rounded-lg text-xs font-semibold">Review</SelectItem>
                    <SelectItem value="risk_check" className="rounded-lg text-xs font-semibold">Risk Check</SelectItem>
                    <SelectItem value="update_student_data" className="rounded-lg text-xs font-semibold">Update Data</SelectItem>
                    <SelectItem value="other" className="rounded-lg text-xs font-semibold">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sort selector dropdown */}
              <div className="flex flex-col gap-1 w-full sm:w-auto">
                <Select
                  value={sortBy}
                  onValueChange={v => { setSortBy(v as typeof sortBy); setCurrentPage(1); }}
                >
                  <SelectTrigger className="h-10 w-full sm:w-auto min-w-[165px] text-xs bg-white dark:bg-slate-950 border-border/60 rounded-xl focus:ring-1">
                    <span className="text-slate-500 font-medium mr-1">Sort:</span>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-md border-border/60">
                    <SelectItem value="due_date" className="rounded-lg text-xs font-semibold">Due Date</SelectItem>
                    <SelectItem value="priority" className="rounded-lg text-xs font-semibold">Priority</SelectItem>
                    <SelectItem value="student_name" className="rounded-lg text-xs font-semibold">Student Name</SelectItem>
                    <SelectItem value="title" className="rounded-lg text-xs font-semibold">Task Title</SelectItem>
                    <SelectItem value="task_type" className="rounded-lg text-xs font-semibold">Category Type</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Order selector button */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                className="h-10 w-10 border-border/60 bg-white dark:bg-slate-950 rounded-xl hover:bg-slate-100"
                aria-label="Toggle sort order"
              >
                {sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </Button>
            </div>
          </div>
        </Card>

        {/* ── Data Table Card ── */}
        <Card className="border-border/50 shadow-sm overflow-hidden rounded-2xl bg-card">
          <CardHeader className="pb-3 border-b border-border/40 bg-muted/15 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <ListTodo className="w-4.5 h-4.5 text-indigo-500" />
              <CardTitle className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {filter === 'pending' ? 'Pending Tasks' : filter === 'completed' ? 'Completed Tasks' : 'All Tasks'}
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-[11px] font-bold gap-1 px-2.5 py-0.5 rounded-full border-border/60 bg-slate-50 text-slate-600 dark:bg-slate-850 dark:text-slate-300">
              {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
            </Badge>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                {/* ── Table Header ── */}
                <TableHeader>
                  <TableRow className="bg-muted/5 hover:bg-muted/5 border-b">
                    <TableHead className="w-10 pl-4">
                      <Checkbox
                        checked={isAllPageSelected}
                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                        aria-label="Select all tasks on page"
                      />
                    </TableHead>
                    <TableHead className="w-10" />
                    
                    {/* Header: Task Title (Sortable) */}
                    <TableHead 
                      className="font-bold text-xs uppercase tracking-wider text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer select-none py-3"
                      onClick={() => handleSort('title')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Task & Assignee</span>
                        {sortBy === 'title' ? (
                          sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-indigo-500" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-500" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-muted-foreground/45 shrink-0" />
                        )}
                      </div>
                    </TableHead>
                    
                    {/* Header: Priority (Sortable) */}
                    <TableHead 
                      className="font-bold text-xs uppercase tracking-wider text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer select-none py-3 hidden md:table-cell"
                      onClick={() => handleSort('priority')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Priority</span>
                        {sortBy === 'priority' ? (
                          sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-indigo-500" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-500" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-muted-foreground/45 shrink-0" />
                        )}
                      </div>
                    </TableHead>
                    
                    {/* Header: Type (Sortable) */}
                    <TableHead 
                      className="font-bold text-xs uppercase tracking-wider text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer select-none py-3 hidden lg:table-cell"
                      onClick={() => handleSort('task_type')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Type</span>
                        {sortBy === 'task_type' ? (
                          sortOrder === 'asc' ? <ChevronUp className="w-3.5 h-3.5 text-indigo-500" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-500" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-muted-foreground/45 shrink-0" />
                        )}
                      </div>
                    </TableHead>
                    
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground text-right pr-4 py-3">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>

                {/* ── Table Body ── */}
                <TableBody>
                  {isLoadingTasks ? (
                    Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} />)
                  ) : paginatedTasks.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-muted/65 flex items-center justify-center border border-border/40">
                            {debouncedSearch
                              ? <Search className="w-5 h-5 text-muted-foreground/50" />
                              : <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                            }
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                              {debouncedSearch
                                ? 'No matching tasks found'
                                : filter === 'pending'
                                  ? 'All caught up!'
                                  : 'No tasks found'}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 max-w-[280px]">
                              {debouncedSearch
                                ? 'Try modifying your search criteria or resetting your priority/type filters.'
                                : filter === 'pending'
                                  ? 'Excellent work! You have resolved all pending mentee activities.'
                                  : 'No recorded tasks correspond to this status filter.'}
                            </p>
                          </div>
                          {debouncedSearch ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setSearch(''); setDebouncedSearch(''); }}
                              className="text-xs mt-2 rounded-xl"
                            >
                              Reset Search
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)} className="gap-1.5 rounded-xl mt-2 h-9 px-4">
                              <Plus className="w-4 h-4" /> Add Task
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTasks.map(task => {
                      const isOverdue = !task.completed && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
                      const isDueToday = !task.completed && isToday(new Date(task.due_date));
                      const pCfg = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;
                      const avatarClass = getAvatarColor(task.student_name);
                      const initials = getInitials(task.student_name);

                      return (
                        <TableRow
                          key={task.id}
                          className={cn(
                            'group transition-all duration-200 border-b border-border/40',
                            task.completed
                              ? 'opacity-65 hover:bg-muted/10'
                              : isOverdue
                                ? 'hover:bg-red-50/15 dark:hover:bg-red-950/5'
                                : isDueToday
                                  ? 'hover:bg-amber-50/15 dark:hover:bg-amber-950/5'
                                  : 'hover:bg-muted/20'
                          )}
                        >
                          {/* Row Checkbox */}
                          <TableCell className="pl-4 w-10">
                            <Checkbox
                              checked={selectedTaskIds.includes(task.id)}
                              onCheckedChange={(checked) => handleSelectRow(task.id, !!checked)}
                              aria-label={`Select task ${task.title}`}
                            />
                          </TableCell>

                          {/* Avatars */}
                          <TableCell className="w-10">
                            <div className={cn(
                              'w-8 h-8 rounded-full border flex items-center justify-center text-[10px] font-extrabold tracking-wider transition-transform group-hover:scale-105 shadow-xs shrink-0',
                              avatarClass
                            )}>
                              {initials}
                            </div>
                          </TableCell>

                          {/* Task details column */}
                          <TableCell>
                            <div className="space-y-1 py-1">
                              {/* Title line */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={cn(
                                  'text-sm font-bold leading-snug transition-all',
                                  task.completed ? 'line-through text-muted-foreground' : 'text-slate-900 dark:text-slate-100'
                                )}>
                                  {task.title}
                                </span>
                                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 md:hidden', pCfg.dot)} />
                                {isOverdue && (
                                  <Badge className="bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30 text-[9px] px-1.5 h-4 font-extrabold uppercase tracking-widest">
                                    Overdue
                                  </Badge>
                                )}
                                {isDueToday && (
                                  <Badge className="bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30 text-[9px] px-1.5 h-4 font-extrabold uppercase tracking-widest">
                                    Today
                                  </Badge>
                                )}
                              </div>

                              {/* Description snippet */}
                              {task.description && (
                                <p className="text-xs text-muted-foreground/80 line-clamp-1 max-w-[500px]">
                                  {task.description}
                                </p>
                              )}

                              {/* Metadata line */}
                              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 pt-0.5">
                                <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-semibold">
                                  <User className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                                  {task.student_name ? (
                                    <span className="text-slate-800 dark:text-slate-200">{task.student_name}</span>
                                  ) : (
                                    <span className="italic text-muted-foreground/60 font-medium">Personal Task</span>
                                  )}
                                </span>
                                <span className={cn(
                                  'flex items-center gap-1 text-[11px] font-bold',
                                  isOverdue ? 'text-red-500' : isDueToday ? 'text-amber-500' : 'text-muted-foreground'
                                )}>
                                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                                  {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
                                </span>
                                <Badge
                                  variant="outline"
                                  className="lg:hidden text-[9px] px-1.5 h-4 font-bold border-border/40 text-muted-foreground capitalize bg-slate-50/50"
                                >
                                  {task.task_type.replace(/_/g, ' ')}
                                </Badge>
                              </div>
                            </div>
                          </TableCell>

                          {/* Priority badge (Desktop) */}
                          <TableCell className="hidden md:table-cell">
                            <Badge className={cn('text-[10px] px-2.5 py-0.5 rounded-full border gap-1 font-bold tracking-wide uppercase', pCfg.badge)}>
                              <Flag className="w-2.5 h-2.5" />
                              {pCfg.label}
                            </Badge>
                          </TableCell>

                          {/* Type badge (Desktop) */}
                          <TableCell className="hidden lg:table-cell">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-2.5 py-0.5 font-bold border-border/50 text-slate-650 bg-slate-50 dark:bg-slate-850 dark:text-slate-300 rounded-full capitalize"
                            >
                              {task.task_type.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>

                          {/* Actions cells */}
                          <TableCell className="text-right pr-4">
                            <div className="flex items-center justify-end gap-1">
                              {/* Quick complete check button */}
                              <Tooltip>
                                <TooltipTrigger render={<span />}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => toggleMutation.mutate({ id: task.id, completed: !task.completed })}
                                    disabled={toggleMutation.isPending}
                                    className={cn(
                                      'h-7 w-7 rounded-lg transition-all',
                                      task.completed
                                        ? 'text-emerald-500 hover:text-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20'
                                        : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/40'
                                    )}
                                    aria-label="Toggle Complete"
                                  >
                                    <Check className="w-4 h-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  {task.completed ? 'Mark Pending' : 'Mark Completed'}
                                </TooltipContent>
                              </Tooltip>

                              {/* Dropdown Menu actions */}
                               <DropdownMenu>
                                <DropdownMenuTrigger render={
                                  <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-slate-100">
                                    <MoreHorizontal className="w-4 h-4 text-slate-500" />
                                  </Button>
                                } />
                                <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-md border border-border/60">
                                  <DropdownMenuItem
                                    onClick={() => toggleMutation.mutate({ id: task.id, completed: !task.completed })}
                                    className="text-xs font-semibold gap-2 cursor-pointer rounded-lg"
                                  >
                                    {task.completed ? (
                                      <><Circle className="w-3.5 h-3.5" /> Mark Pending</>
                                    ) : (
                                      <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-650" /> Mark Complete</>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleEdit(task)}
                                    className="text-xs font-semibold gap-2 cursor-pointer rounded-lg"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-indigo-500" /> Edit Details
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(task.id)}
                                    className="text-xs font-semibold gap-2 cursor-pointer rounded-lg text-red-650 focus:text-red-750 focus:bg-red-50/60"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete Task
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* ── Table Footer Controls (Pagination & Page Size Selection) ── */}
            {!isLoadingTasks && totalPages > 0 && (
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-border/40 bg-muted/5">
                <div className="flex items-center gap-4 order-2 md:order-1">
                  <p className="text-xs text-muted-foreground">
                    Showing {((safePage - 1) * pageSize) + 1}–{Math.min(safePage * pageSize, filteredTasks.length)} of {filteredTasks.length} tasks
                  </p>
                  
                  {/* Page Size select dropdown */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground font-semibold">Show:</span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={v => { setPageSize(Number(v)); setCurrentPage(1); }}
                    >
                      <SelectTrigger className="h-7 w-[65px] text-[11px] font-bold bg-white dark:bg-slate-950 border-border/60 rounded-md">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg shadow-md border-border/60">
                        <SelectItem value="5" className="rounded-md text-[11px] font-semibold">5</SelectItem>
                        <SelectItem value="10" className="rounded-md text-[11px] font-semibold">10</SelectItem>
                        <SelectItem value="20" className="rounded-md text-[11px] font-semibold">20</SelectItem>
                        <SelectItem value="50" className="rounded-md text-[11px] font-semibold">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="order-1 md:order-2">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={e => { e.preventDefault(); if (safePage > 1) setCurrentPage(safePage - 1); }}
                          className={cn(safePage <= 1 && 'pointer-events-none opacity-40')}
                          text="Prev"
                        />
                      </PaginationItem>
                      {getPageNumbers().map((page, idx) => (
                        <PaginationItem key={idx}>
                          {page === 'ellipsis' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              href="#"
                              isActive={page === safePage}
                              onClick={e => { e.preventDefault(); setCurrentPage(page); }}
                              className="rounded-lg text-xs"
                            >
                              {page}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={e => { e.preventDefault(); if (safePage < totalPages) setCurrentPage(safePage + 1); }}
                          className={cn(safePage >= totalPages && 'pointer-events-none opacity-40')}
                          text="Next"
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Floating Bulk Action Bar ── */}
        {selectedTaskIds.length > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 dark:bg-slate-950/95 text-white backdrop-blur-md px-5 py-3.5 rounded-2xl flex items-center gap-5 shadow-2xl border border-white/10 animate-in slide-in-from-bottom-5 duration-350">
            <div className="flex items-center gap-2 border-r border-white/20 pr-4">
              <span className="bg-indigo-500 text-white font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-inner">
                {selectedTaskIds.length}
              </span>
              <span className="text-xs font-bold tracking-tight">tasks selected</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => bulkToggleMutation.mutate({ ids: selectedTaskIds, completed: true })}
                disabled={bulkToggleMutation.isPending}
                className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl h-9 transition-all flex items-center gap-1"
              >
                {bulkToggleMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                Mark Completed
              </Button>
              <Button
                size="sm"
                onClick={() => bulkToggleMutation.mutate({ ids: selectedTaskIds, completed: false })}
                disabled={bulkToggleMutation.isPending}
                className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl h-9 transition-all flex items-center gap-1"
              >
                {bulkToggleMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Circle className="w-3.5 h-3.5 text-slate-400" />}
                Mark Pending
              </Button>
              <Button
                size="sm"
                onClick={() => setIsBulkDeleteOpen(true)}
                disabled={bulkDeleteMutation.isPending}
                className="bg-red-650 hover:bg-red-700 text-white text-xs font-bold rounded-xl h-9 transition-all flex items-center gap-1"
              >
                {bulkDeleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete Selected
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedTaskIds([])}
                className="text-slate-400 hover:text-white hover:bg-white/5 text-xs font-semibold rounded-xl h-9"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* ── Dialog Modals ── */}
        <CreateTaskDialog
          students={students}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['tasks'] })}
        />
        <EditTaskDialog
          task={editingTask}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['tasks'] })}
        />

        {/* ── Single Delete Alert Dialog ── */}
        <AlertDialog
          open={deleteTargetId !== null}
          onOpenChange={open => { if (!open) setDeleteTargetId(null); }}
        >
          <AlertDialogContent size="sm" className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-red-50">
                <Trash2 className="w-5 h-5 text-red-600" />
              </AlertDialogMedia>
              <AlertDialogTitle className="font-bold text-slate-900">Delete Task?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-500 font-semibold text-xs">
                This action cannot be undone. The task will be permanently removed from Google Sheets.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel onClick={() => setDeleteTargetId(null)} className="rounded-xl font-bold">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="bg-red-650 hover:bg-red-750 text-white rounded-xl font-bold"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Bulk Delete Alert Dialog ── */}
        <AlertDialog
          open={isBulkDeleteOpen}
          onOpenChange={setIsBulkDeleteOpen}
        >
          <AlertDialogContent size="sm" className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-red-50">
                <Trash2 className="w-5 h-5 text-red-600" />
              </AlertDialogMedia>
              <AlertDialogTitle className="font-bold text-slate-900">Delete Multiple Tasks?</AlertDialogTitle>
              <AlertDialogDescription className="text-slate-500 font-semibold text-xs">
                Are you sure you want to permanently delete these {selectedTaskIds.length} selected tasks? This action cannot be undone and will perform sequential database removals.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel onClick={() => setIsBulkDeleteOpen(false)} className="rounded-xl font-bold">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  bulkDeleteMutation.mutate(selectedTaskIds);
                  setIsBulkDeleteOpen(false);
                }}
                disabled={bulkDeleteMutation.isPending}
                className="bg-red-650 hover:bg-red-750 text-white rounded-xl font-bold"
              >
                {bulkDeleteMutation.isPending ? 'Deleting…' : 'Delete All'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
