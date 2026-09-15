'use client';

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import {
  Loader2, Plus, Trash2, Edit3, Search, CalendarDays, Clock,
  Building2, FileText, Phone, CheckCircle, ClipboardList, Star,
  ExternalLink, MessageSquare, TrendingUp, Briefcase,
  ChevronLeft, ChevronRight, X, HelpCircle, Users, Columns, Activity,
  MoreVertical, Calendar
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod';
import { ProgressLog, ProgressLogType, MockInterviewType } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Form, FormControl, FormDescription, FormField, FormItem,
  FormLabel, FormMessage,
} from '@/components/ui/form';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Subcomponents import
import { StatsCards } from '@/components/mentor/progress-logs/stats-cards';
import { AnalyticsDashboard } from '@/components/mentor/progress-logs/analytics-dashboard';
import { ActivityTimeline } from '@/components/mentor/progress-logs/activity-timeline';

interface Student {
  id: string;
  name: string;
  batch: string;
  stage: string;
  mentor_email: string;
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
  'Offer':          { icon: CheckCircle,  color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-900/50' },
  'Other':          { icon: FileText,     color: 'text-slate-600 dark:text-slate-400',   bg: 'bg-slate-50 dark:bg-slate-900/40',   border: 'border-slate-200 dark:border-slate-800'   },
};

const MOCK_INTERVIEW_TYPES: { value: MockInterviewType; label: string }[] = [
  { value: 'technical',     label: 'Technical Mock'     },
  { value: 'behavioral',    label: 'Behavioral Mock'    },
  { value: 'system_design', label: 'System Design Mock' },
  { value: 'hr',            label: 'HR Round Mock'      },
  { value: 'mock',          label: 'Mock Practice' },
];

const GROUP_ACCENTS = [
  'border-l-blue-400 dark:border-l-blue-600',
  'border-l-violet-400 dark:border-l-violet-600',
  'border-l-emerald-400 dark:border-l-emerald-600',
  'border-l-amber-400 dark:border-l-amber-600',
  'border-l-rose-400 dark:border-l-rose-600',
  'border-l-cyan-400 dark:border-l-cyan-600',
  'border-l-indigo-400 dark:border-l-indigo-600',
  'border-l-teal-400 dark:border-l-teal-600',
];

function getDateLabel(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const d = parseISO(dateStr);
    if (isToday(d))     return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMM d, yyyy');
  } catch { return dateStr; }
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
  } catch { return ''; }
}

function initials(name: string): string {
  if (!name) return '??';
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

export default function MentorProgressLogsPage() {
  const queryClient = useQueryClient();

  // ── active view tab state ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'analytics' | 'database'>('analytics');

  // ── filter state ──────────────────────────────────────────────────────────
  const [search,        setSearch]        = useState('');
  const [typeFilter,    setTypeFilter]    = useState<ProgressLogType | 'all'>('all');
  const [studentFilter, setStudentFilter] = useState<string>('all');
  // student search inside the combobox
  const [studentSearch, setStudentSearch] = useState('');
  const [studentDropOpen, setStudentDropOpen] = useState(false);
  const studentDropRef = useRef<HTMLDivElement>(null);

  // ── dialog state ──────────────────────────────────────────────────────────
  const [addOpen,    setAddOpen]    = useState(false);
  const [editOpen,   setEditOpen]   = useState(false);
  const [editingLog, setEditingLog] = useState<ProgressLog | null>(null);

  // ── pagination ────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const STUDENTS_PER_PAGE = 5;

  // Close student dropdown on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (studentDropRef.current && !studentDropRef.current.contains(e.target as Node)) {
        setStudentDropOpen(false);
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  // ── data fetching ─────────────────────────────────────────────────────────
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['progress-logs-all'],
    queryFn: async () => {
      const res = await fetch('/api/progress-logs');
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json() as Promise<{ data: ProgressLog[]; total: number }>;
    },
  });

  const { data: studentsData } = useQuery({
    queryKey: ['students-list'],
    queryFn: async () => {
      const res = await fetch('/api/students?limit=200');
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<{ data: Student[] }>;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/progress-logs/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['progress-logs-all'] });
      toast.success('Progress log deleted successfully');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── derived data ──────────────────────────────────────────────────────────
  const logs     = useMemo(() => logsData?.data ?? [],    [logsData]);
  const students = useMemo(() => studentsData?.data ?? [], [studentsData]);

  // Students filtered by the combobox search input
  const filteredStudentOptions = useMemo(() =>
    students.filter(s =>
      s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.batch.toLowerCase().includes(studentSearch.toLowerCase())
    ),
  [students, studentSearch]);

  const selectedStudentName = useMemo(() =>
    students.find(s => s.id === studentFilter)?.name ?? null,
  [students, studentFilter]);

  const filteredLogs = useMemo(() => logs.filter(log => {
    const q = search.toLowerCase();
    const matchSearch = !search
      || log.student_name.toLowerCase().includes(q)
      || log.company_name.toLowerCase().includes(q)
      || (log.note && log.note.toLowerCase().includes(q));
    const matchType    = typeFilter    === 'all' || log.log_type   === typeFilter;
    const matchStudent = studentFilter === 'all' || log.student_id === studentFilter;
    return matchSearch && matchType && matchStudent;
  }), [logs, search, typeFilter, studentFilter]);

  // Group by student — full set for pagination math
  const allGroupedByStudent = useMemo(() => {
    const groups = new Map<string, { logs: ProgressLog[]; name: string; batch: string }>(); 
    filteredLogs.forEach(log => {
      if (!groups.has(log.student_id)) {
        const s = students.find(s => s.id === log.student_id);
        groups.set(log.student_id, {
          logs: [],
          name:  s?.name  ?? log.student_name ?? 'Unknown',
          batch: s?.batch ?? '',
        });
      }
      groups.get(log.student_id)!.logs.push(log);
    });
    return groups;
  }, [filteredLogs, students]);

  const totalStudents = allGroupedByStudent.size;
  const totalPages    = Math.max(1, Math.ceil(totalStudents / STUDENTS_PER_PAGE));

  // Clamp page when filters shrink the result set
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const pagedGroupEntries = useMemo(() => {
    const all   = Array.from(allGroupedByStudent.entries());
    const start = (page - 1) * STUDENTS_PER_PAGE;
    return all.slice(start, start + STUDENTS_PER_PAGE);
  }, [allGroupedByStudent, page]);

  // ── helpers ───────────────────────────────────────────────────────────────
  const resetPage = () => setPage(1);

  const handleEdit = useCallback((log: ProgressLog) => {
    setEditingLog(log);
    setEditOpen(true);
  }, []);

  const handleDelete = useCallback((id: string) => {
    if (confirm('Are you sure you want to delete this progress log? This will revert metrics synced across the placement boards.')) {
      deleteMutation.mutate(id);
    }
  }, [deleteMutation]);

  const clearAllFilters = () => {
    setSearch('');
    setTypeFilter('all');
    setStudentFilter('all');
    setStudentSearch('');
    setPage(1);
  };

  const hasActiveFilters = search !== '' || typeFilter !== 'all' || studentFilter !== 'all';

  // Ellipsis list builder
  function buildPageList(current: number, total: number): (number | '…')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: (number | '…')[] = [1];
    if (current > 3)           pages.push('…');
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) pages.push(i);
    if (current < total - 2)   pages.push('…');
    pages.push(total);
    return pages;
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">

        {/* ── Main Header redone ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/50 pb-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Progress Logs</h1>
            <p className="text-sm text-muted-foreground">
              Monitor student recruitment activities, log technical mocks, and analyze candidate stage trends.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Dialog>
              <DialogTrigger render={
                <Button variant="outline" size="icon" className="h-9 w-9 text-muted-foreground border border-border/60 hover:bg-muted/50 rounded-lg" title="Progress Logs Help Guide">
                  <HelpCircle className="h-4 w-4" />
                </Button>
              } />
              <DialogContent className="sm:max-w-md lg:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-background shadow-xl border border-border/60 rounded-xl">
                <DialogHeader className="p-6 border-b shrink-0 bg-muted/30">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    <DialogTitle className="text-lg font-bold text-foreground">Progress Logs Help Guide</DialogTitle>
                  </div>
                  <DialogDescription className="text-muted-foreground text-xs mt-1">
                    Understand how logging milestones updates metrics and guides candidate pipelines.
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 p-6 overflow-y-auto">
                  <div className="space-y-6 pb-6 text-sm text-muted-foreground leading-relaxed">
                    
                    <section className="space-y-2">
                      <h4 className="font-bold text-foreground flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Module Description
                      </h4>
                      <p className="text-xs">
                        This module is an interactive command center where mentors log application runs, technical interviews, assignment tasks, coding reviews, and placement offer structures. Recording these milestones enables real-time pipeline monitoring and helps track candidate performance dynamically.
                      </p>
                    </section>

                    <section className="space-y-2">
                      <h4 className="font-bold text-foreground flex items-center gap-1.5">
                        <Columns className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Categorized Log Types
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                        <div className="p-3 border rounded-xl bg-muted/10">
                          <span className="font-bold text-foreground flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-blue-500" /> Interview Call
                          </span>
                          <p className="text-muted-foreground mt-1">Recorded when recruiter, HR, or technical calls are scheduled. Feeds calendar alerts.</p>
                        </div>
                        <div className="p-3 border rounded-xl bg-muted/10">
                          <span className="font-bold text-foreground flex items-center gap-1">
                            <Briefcase className="w-3.5 h-3.5 text-indigo-500" /> Job Applied
                          </span>
                          <p className="text-muted-foreground mt-1">Logged when a candidate applies. Supports recording application posting links.</p>
                        </div>
                        <div className="p-3 border rounded-xl bg-muted/10">
                          <span className="font-bold text-foreground flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5 text-purple-500" /> Mock Interview
                          </span>
                          <p className="text-muted-foreground mt-1">Logs internal candidate practice mock evaluations. Generates rating indicators.</p>
                        </div>
                        <div className="p-3 border rounded-xl bg-muted/10">
                          <span className="font-bold text-foreground flex items-center gap-1">
                            <ClipboardList className="w-3.5 h-3.5 text-amber-500" /> Job Task
                          </span>
                          <p className="text-muted-foreground mt-1">Tracks homework coding tasks, review rounds, or screeners.</p>
                        </div>
                        <div className="p-3 border rounded-xl bg-muted/10">
                          <span className="font-bold text-foreground flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Offer
                          </span>
                          <p className="text-muted-foreground mt-1">Logged when a client offer is received. Suggests shifting candidate board placement status.</p>
                        </div>
                        <div className="p-3 border rounded-xl bg-muted/10">
                          <span className="font-bold text-foreground flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-slate-500" /> Other
                          </span>
                          <p className="text-muted-foreground mt-1">Logs generic activities, feedback loops, or administrative notes.</p>
                        </div>
                      </div>
                    </section>

                    <section className="space-y-2">
                      <h4 className="font-bold text-foreground flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Automatic Sync & Risk Metrics
                      </h4>
                      <div className="space-y-2 text-xs">
                        <p><strong>Last Active Timestamp:</strong> Adding any progress log automatically refreshes the candidate&apos;s <code>last_activity_date</code> database field to prevent inactivity flags.</p>
                        <p><strong>Mentee Risk Triggers:</strong> Low mock score ratings (below 6/10) or prolonged gaps in logging (14+ days) will dynamically flag the candidate as &quot;At Risk&quot; inside the mentor alerts.</p>
                      </div>
                    </section>

                  </div>
                </ScrollArea>
                <DialogFooter className="p-4 border-t bg-muted/30 flex sm:justify-end shrink-0">
                  <DialogClose render={<Button variant="outline">Close Guide</Button>} />
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white h-9 rounded-lg px-4 gap-2 transition-colors duration-200" onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4" /> Log Progress
            </Button>
          </div>
        </div>

        {/* ── Dynamic Stats Cards Deck ── */}
        {logsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[110px] rounded-2xl border border-border/40 bg-card/60 animate-pulse" />
            ))}
          </div>
        ) : (
          <StatsCards logs={logs} />
        )}

        {/* ── Search & Filter Controls ── */}
        <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-4 sm:p-5 space-y-4">
          <div className="flex gap-3 flex-wrap">
            
            {/* Search Input */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-9 rounded-lg border-border/60 text-sm focus-visible:ring-indigo-500 bg-background/50"
                placeholder="Search student name, company, or notes context..."
                value={search}
                onChange={e => { setSearch(e.target.value); resetPage(); }}
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); resetPage(); }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Combobox Student Selector */}
            <div className="relative w-64" ref={studentDropRef}>
              <button
                type="button"
                onClick={() => { setStudentDropOpen(v => !v); setStudentSearch(''); }}
                className={cn(
                  'w-full h-9 px-3 text-sm rounded-lg border border-border/60 bg-background/50 flex items-center justify-between gap-2 hover:bg-muted/40 transition-all duration-200 outline-none',
                  studentFilter !== 'all' && 'border-indigo-400 bg-indigo-50/40 text-indigo-700 dark:text-indigo-400 dark:bg-indigo-950/20 dark:border-indigo-900',
                )}
              >
                <span className="truncate">
                  {selectedStudentName ?? 'All Candidates'}
                </span>
                {studentFilter !== 'all' ? (
                  <X
                    className="w-3.5 h-3.5 shrink-0 text-indigo-500 hover:text-indigo-700"
                    onClick={e => { e.stopPropagation(); setStudentFilter('all'); setStudentSearch(''); resetPage(); }}
                  />
                ) : (
                  <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground rotate-90" />
                )}
              </button>

              {studentDropOpen && (
                <div className="absolute z-50 top-full mt-1.5 w-full rounded-xl border border-border/50 bg-background shadow-lg overflow-hidden animate-in fade-in-0 slide-in-from-top-1">
                  <div className="p-2 border-b border-border/40 bg-muted/20">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        autoFocus
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border/60 bg-background outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Filter candidates..."
                        value={studentSearch}
                        onChange={e => setStudentSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="max-h-52 overflow-y-auto p-1 space-y-0.5">
                    <button
                      className={cn(
                        'w-full text-left px-2.5 py-2 text-xs rounded-md hover:bg-muted/50 transition-colors',
                        studentFilter === 'all' && 'bg-muted/40 font-semibold',
                      )}
                      onClick={() => { setStudentFilter('all'); setStudentDropOpen(false); resetPage(); }}
                    >
                      All Candidates
                    </button>
                    {filteredStudentOptions.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-muted-foreground text-center">No results found</p>
                    ) : (
                      filteredStudentOptions.map(s => (
                        <button
                          key={s.id}
                          className={cn(
                            'w-full text-left px-2.5 py-1.5 text-xs rounded-md hover:bg-muted/50 transition-colors flex items-center justify-between',
                            studentFilter === s.id && 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 font-semibold',
                          )}
                          onClick={() => { setStudentFilter(s.id); setStudentDropOpen(false); resetPage(); }}
                        >
                          <span className="truncate pr-1">{s.name}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">{s.batch}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator className="border-border/40" />

          {/* Type Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide shrink-0">Filter by Type:</span>
            {(['all', 'Interview Call', 'Job Applied', 'Mock Interview', 'Job Task', 'Offer', 'Other'] as const).map(type => {
              const isAll    = type === 'all';
              const active   = typeFilter === type;
              const config   = isAll ? null : LOG_TYPE_CONFIG[type as ProgressLogType];
              const Icon     = config?.icon;
              return (
                <button
                  key={type}
                  onClick={() => { setTypeFilter(type); resetPage(); }}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border transition-all duration-200 shadow-sm cursor-pointer',
                    active
                      ? isAll
                        ? 'bg-foreground text-background border-foreground'
                        : cn(config!.bg, config!.color, config!.border, 'ring-1 ring-offset-1 dark:ring-offset-background', config!.border.replace('border-', 'ring-'))
                      : 'bg-background text-muted-foreground border-border/60 hover:border-border hover:text-foreground',
                  )}
                >
                  {Icon && <Icon className="w-3.5 h-3.5 shrink-0" />}
                  {isAll ? 'All Types' : type}
                </button>
              );
            })}

            {/* Clear Button */}
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border border-dashed border-border/80 text-muted-foreground hover:border-rose-500/40 hover:text-rose-600 transition-colors ml-auto cursor-pointer"
              >
                <X className="w-3 h-3" />
                Clear Filters
              </button>
            )}
          </div>
        </div>

        {/* ── Main View Panels (Tabbed Layout) ── */}
        <Tabs defaultValue="analytics" className="w-full flex flex-col gap-6" onValueChange={(val) => setActiveTab(val as 'analytics' | 'database')}>
          <div className="flex items-center justify-between pb-3">
            <TabsList className="bg-muted/50 p-1 border border-border/40 rounded-xl">
              <TabsTrigger value="analytics" className="px-4 py-1.5 rounded-lg text-xs font-bold gap-1.5 transition-all">
                <TrendingUp className="w-3.5 h-3.5" /> Dashboard & Analytics
              </TabsTrigger>
              <TabsTrigger value="database" className="px-4 py-1.5 rounded-lg text-xs font-bold gap-1.5 transition-all">
                <Columns className="w-3.5 h-3.5" /> Logs Database Grid
              </TabsTrigger>
            </TabsList>
            <div className="text-xs text-muted-foreground">
              {logsLoading ? 'Updating...' : `Loaded ${filteredLogs.length} matching logs`}
            </div>
          </div>

          {/* 1. Dashboard & Analytics View Panel */}
          <TabsContent value="analytics" className="space-y-6 outline-none focus-visible:ring-0">
            {logsLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              </div>
            ) : (
              <>
                <AnalyticsDashboard logs={logs} />
                
                <div className="space-y-3 pt-4">
                  <div className="flex items-center gap-2 border-b border-border/40 pb-2">
                    <Activity className="w-4 h-4 text-indigo-500 animate-pulse" />
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Recent Chronological Timeline</h2>
                  </div>
                  <ActivityTimeline logs={filteredLogs} onEdit={handleEdit} onDelete={handleDelete} />
                </div>
              </>
            )}
          </TabsContent>

          {/* 2. Logs Database View Panel */}
          <TabsContent value="database" className="outline-none focus-visible:ring-0">
            {logsLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/80 bg-background/50 flex flex-col items-center justify-center py-16 gap-3 text-center">
                <TrendingUp className="w-10 h-10 text-muted-foreground/30" />
                <div>
                  <p className="text-sm font-bold text-foreground">No matching progress logs found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {logs.length === 0
                      ? 'Create progress logs for candidate milestones to build the placement database.'
                      : 'Refine your filter options above.'}
                  </p>
                </div>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearAllFilters} className="rounded-lg">
                    <X className="w-3.5 h-3.5 mr-1.5" /> Clear Filters
                  </Button>
                )}
                {logs.length === 0 && (
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg" onClick={() => setAddOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" /> Add First Log
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
                  <div className="overflow-x-auto relative">
                    <Table className="min-w-[800px]">
                      <TableHeader className="bg-muted/30 sticky top-0 z-20">
                        <TableRow className="border-b border-border/50 hover:bg-transparent">
                          <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-3 pl-4 w-40">
                            Type
                          </TableHead>
                          <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-3">
                            Company
                          </TableHead>
                          <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-3">
                            Date
                          </TableHead>
                          <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-3">
                            Time
                          </TableHead>
                          <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-3 w-72">
                            Note Details
                          </TableHead>
                          <TableHead className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider py-3 w-28">
                            Logged
                          </TableHead>
                          <TableHead className="py-3 pr-4 w-12" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedGroupEntries.map(([studentId, group], groupIndex) => {
                          const accent = GROUP_ACCENTS[groupIndex % GROUP_ACCENTS.length];

                          return [
                            /* Candidate Divider Header */
                            <TableRow
                              key={`header-${studentId}`}
                              className="bg-muted/20 hover:bg-muted/20 border-y border-border/40 select-none"
                            >
                              <TableCell colSpan={7} className="py-2.5 pl-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/30 flex items-center justify-center text-[10px] font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                                      {initials(group.name)}
                                    </div>
                                    <span className="text-xs font-bold text-foreground">{group.name}</span>
                                    {group.batch && (
                                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-medium bg-background text-muted-foreground leading-none border-border/60">
                                        {group.batch}
                                      </Badge>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-muted-foreground pr-2 font-medium">
                                    {group.logs.length} {group.logs.length === 1 ? 'log' : 'logs'} listed
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>,

                            /* Database rows */
                            ...group.logs.map(log => {
                              const config = LOG_TYPE_CONFIG[log.log_type] || LOG_TYPE_CONFIG.Other;
                              const Icon   = config.icon;
                              return (
                                <TableRow
                                  key={log.id}
                                  className={cn(
                                    'border-b border-border/30 group transition-colors hover:bg-muted/10 border-l-2',
                                    accent,
                                  )}
                                >
                                  {/* Type */}
                                  <TableCell className="py-3 pl-4">
                                    <div className="flex flex-col gap-1">
                                      <span className={cn(
                                        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border w-fit whitespace-nowrap',
                                        config.bg, config.color, config.border,
                                      )}>
                                        <Icon className="w-3 h-3 shrink-0" />
                                        {log.log_type}
                                      </span>

                                      {log.log_type === 'Offer' && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/50 w-fit">
                                          <Star className="w-2.5 h-2.5 text-emerald-600" />
                                          <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-400">Offer!</span>
                                        </span>
                                      )}
                                      {log.log_type === 'Mock Interview' && log.mock_interview_type && (
                                        <Badge variant="outline" className="text-[9px] py-0 w-fit font-normal text-purple-700 dark:text-purple-400 border-purple-200/50 bg-purple-50/20">
                                          {MOCK_INTERVIEW_TYPES.find(t => t.value === log.mock_interview_type)?.label ?? log.mock_interview_type}
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>

                                  {/* Company */}
                                  <TableCell className="py-3">
                                    <p className="text-xs font-bold text-foreground">{log.company_name}</p>
                                    {log.log_type === 'Job Applied' && log.job_url && (
                                      <a
                                        href={log.job_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 mt-0.5 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
                                      >
                                        <ExternalLink className="w-2.5 h-2.5" />
                                        View post
                                      </a>
                                    )}
                                  </TableCell>

                                  {/* Date */}
                                  <TableCell className="py-3">
                                    <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                                      <CalendarDays className="w-3.5 h-3.5 text-indigo-500" />
                                      {getDateLabel(log.scheduled_date)}
                                    </span>
                                  </TableCell>

                                  {/* Time */}
                                  <TableCell className="py-3">
                                    {log.scheduled_time ? (
                                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                        {log.scheduled_time}
                                      </span>
                                    ) : (
                                      <span className="text-xs text-muted-foreground font-medium">—</span>
                                    )}
                                  </TableCell>

                                  {/* Notes */}
                                  <TableCell className="py-3 max-w-[280px]">
                                    {log.note ? (
                                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{log.note}</p>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">—</span>
                                    )}
                                    {log.log_type === 'Mock Interview' && log.mock_score != null && log.mock_score > 0 && (
                                      <div className="flex items-center gap-1.5 mt-1.5">
                                        <div className="flex gap-0.5">
                                          {Array.from({ length: 10 }).map((_, i) => (
                                            <div
                                              key={i}
                                              className={cn('w-1.5 h-2.5 rounded-sm', i < log.mock_score! ? 'bg-purple-400' : 'bg-muted')}
                                            />
                                          ))}
                                        </div>
                                        <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400">{log.mock_score}/10</span>
                                      </div>
                                    )}
                                  </TableCell>

                                  {/* Logged elapsed */}
                                  <TableCell className="py-3">
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      {getLoggedAgo(log.logged_at)}
                                    </span>
                                  </TableCell>

                                  {/* Action dropdown menu */}
                                  <TableCell className="py-3 pr-4">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger render={
                                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
                                          <MoreVertical className="w-4 h-4" />
                                        </Button>
                                      } />
                                      <DropdownMenuContent className="w-36 bg-popover rounded-xl border border-border/50 p-1 shadow-lg" align="end">
                                        <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1.5">Log Actions</DropdownMenuLabel>
                                        <DropdownMenuSeparator className="my-0.5" />
                                        <DropdownMenuItem className="flex items-center gap-2 cursor-pointer text-xs p-2 rounded-lg" onClick={() => handleEdit(log)}>
                                          <Edit3 className="w-3.5 h-3.5 text-indigo-500" /> Edit Log
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="flex items-center gap-2 cursor-pointer text-xs p-2 rounded-lg text-rose-600 dark:text-rose-400 focus:bg-rose-50 dark:focus:bg-rose-950/20" onClick={() => handleDelete(log.id)}>
                                          <Trash2 className="w-3.5 h-3.5 text-rose-500" /> Delete Log
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </TableCell>
                                </TableRow>
                              );
                            }),
                          ];
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* Pagination deck */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-1 py-2">
                  <p className="text-xs text-muted-foreground">
                    Displaying{' '}
                    <span className="font-semibold text-foreground">
                      {totalStudents === 0
                        ? '0'
                        : `${(page - 1) * STUDENTS_PER_PAGE + 1}–${Math.min(page * STUDENTS_PER_PAGE, totalStudents)}`}
                    </span>{' '}
                    of <span className="font-semibold text-foreground">{totalStudents}</span> active candidates
                  </p>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 rounded-lg p-0"
                        disabled={page <= 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      {buildPageList(page, totalPages).map((p, i) =>
                        p === '…' ? (
                          <span
                            key={`ellipsis-${i}`}
                            className="h-8 w-8 flex items-center justify-center text-xs text-muted-foreground select-none"
                          >
                            …
                          </span>
                        ) : (
                          <Button
                            key={p}
                            variant={p === page ? 'default' : 'outline'}
                            size="sm"
                            className={cn(
                              'h-8 w-8 rounded-lg p-0 text-xs font-bold',
                              p === page && 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600',
                            )}
                            onClick={() => setPage(p as number)}
                          >
                            {p}
                          </Button>
                        )
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 rounded-lg p-0"
                        disabled={page >= totalPages}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Add Log Dialog ── */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 border border-border/50 bg-background shadow-2xl rounded-xl">
            <ScrollArea className="flex-grow max-h-[90vh]">
              <div className="p-6">
                <AddLogForm
                  students={students}
                  onSuccess={() => {
                    setAddOpen(false);
                    queryClient.invalidateQueries({ queryKey: ['progress-logs-all'] });
                  }}
                />
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

        {/* ── Edit Log Dialog ── */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col p-0 border border-border/50 bg-background shadow-2xl rounded-xl">
            <ScrollArea className="flex-grow max-h-[90vh]">
              <div className="p-6">
                {editingLog && (
                  <EditLogForm
                    log={editingLog}
                    students={students}
                    onSuccess={() => {
                      setEditOpen(false);
                      setEditingLog(null);
                      queryClient.invalidateQueries({ queryKey: ['progress-logs-all'] });
                    }}
                  />
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>

      </div>
    </TooltipProvider>
  );
}

// ─── Zod validation schemas ──────────────────────────────────────────────────

const baseLogSchema = z.object({
  studentId:        z.string().min(1, 'Please select a student'),
  logType:          z.enum(['Interview Call', 'Job Applied', 'Mock Interview', 'Job Task', 'Offer', 'Other']),
  company:          z.string().min(1, 'Company name is required').max(200),
  date:             z.string().min(1, 'Date is required'),
  time:             z.string().optional(),
  note:             z.string().max(1000).optional(),
  jobUrl:           z.string().optional(),
  // Mock interview optional fields
  mockType:         z.enum(['technical', 'behavioral', 'system_design', 'hr', 'mock']).optional(),
  mockInterviewer:  z.string().max(100).optional(),
  mockScore:        z.string().optional(),
  mockStrengths:    z.string().max(500).optional(),
  mockImprovements: z.string().max(500).optional(),
  mockFeedback:     z.string().max(1000).optional(),
});

type AddLogValues = z.infer<typeof baseLogSchema>;

const editLogSchema = z.object({
  logType:  z.enum(['Interview Call', 'Job Applied', 'Mock Interview', 'Job Task', 'Offer', 'Other']),
  company:  z.string().min(1, 'Company name is required').max(200),
  date:     z.string().min(1, 'Date is required'),
  time:     z.string().optional(),
  note:     z.string().max(1000).optional(),
  jobUrl:   z.string().optional(),
});

type EditLogValues = z.infer<typeof editLogSchema>;

// ─── Refactored Add Log Form ─────────────────────────────────────────────────

function AddLogForm({ students, onSuccess }: { students: Student[]; onSuccess: () => void }) {
  const form = useForm<AddLogValues>({
    resolver: standardSchemaResolver(baseLogSchema),
    defaultValues: {
      studentId: '',
      logType:   'Interview Call',
      company:   '',
      date:      new Date().toISOString().split('T')[0],
      time:      '',
      note:      '',
      jobUrl:    '',
      mockType:        'technical',
      mockInterviewer: '',
      mockScore:       '',
      mockStrengths:   '',
      mockImprovements:'',
      mockFeedback:    '',
    },
  });

  const logType = form.watch('logType');
  const isMock  = logType === 'Mock Interview';
  const isJob   = logType === 'Job Applied';
  const isOffer = logType === 'Offer';
  const selectedStudent = students.find(s => s.id === form.watch('studentId'));

  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (values: AddLogValues) => {
    setIsLoading(true);
    try {
      const body: Record<string, unknown> = {
        student_id:     values.studentId,
        log_type:       values.logType,
        company_name:   values.company,
        scheduled_date: values.date,
        scheduled_time: values.time || '',
        note:           values.note || '',
      };
      if (isJob && values.jobUrl)  body.job_url = values.jobUrl;
      if (isMock) {
        body.mock_interview_type = values.mockType;
        body.mock_interviewer    = values.mockInterviewer || '';
        if (values.mockScore)     body.mock_score = Number(values.mockScore);
        body.mock_strengths      = values.mockStrengths    || '';
        body.mock_improvements   = values.mockImprovements || '';
        body.mock_feedback       = values.mockFeedback     || '';
      }
      const res = await fetch('/api/progress-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.message || 'Failed to submit log'); return; }
      toast.success('Recruitment progress logged successfully');
      onSuccess();
    } catch {
      toast.error('An unexpected connection error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

        {/* Section 1: Header */}
        <div className="space-y-1 pb-3 border-b border-border/40">
          <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-indigo-500" /> Log Progress Milestone
          </h3>
          <p className="text-xs text-muted-foreground">Record a placement activity for a candidate.</p>
        </div>

        {/* Form elements in high-contrast layout */}
        <div className="space-y-4 pt-1">
          {/* Candidate selector */}
          <FormField control={form.control} name="studentId" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold text-foreground">Candidate Name</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="rounded-lg border-border/60">
                    <SelectValue placeholder="Choose candidate..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent className="max-h-60 rounded-xl border border-border/50 shadow-md">
                  {students.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.name} — <span className="text-muted-foreground">{s.batch}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage className="text-[10px]" />
            </FormItem>
          )} />

          {/* Type + Company */}
          <div className="grid grid-cols-2 gap-3.5">
            <FormField control={form.control} name="logType" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold text-foreground">Activity Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="rounded-lg border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="rounded-xl border border-border/50 shadow-md">
                    <SelectItem value="Interview Call" className="text-xs">Interview Call</SelectItem>
                    <SelectItem value="Job Applied" className="text-xs">Job Applied</SelectItem>
                    <SelectItem value="Mock Interview" className="text-xs">Mock Interview</SelectItem>
                    <SelectItem value="Job Task" className="text-xs">Job Task</SelectItem>
                    <SelectItem value="Offer" className="text-xs">Offer</SelectItem>
                    <SelectItem value="Other" className="text-xs">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            <FormField control={form.control} name="company" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold text-foreground">Target Recruiter</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 rounded-lg border-border/60 text-xs h-9" placeholder="Company name..." {...field} />
                  </div>
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3.5">
            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold text-foreground">Milestone Date</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input type="date" className="pl-8 rounded-lg border-border/60 text-xs h-9" {...field} />
                  </div>
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            <FormField control={form.control} name="time" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold text-foreground">Time <span className="text-muted-foreground font-normal text-[10px]">(optional)</span></FormLabel>
                <FormControl>
                  <div className="relative">
                    <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input type="time" className="pl-8 rounded-lg border-border/60 text-xs h-9" {...field} />
                  </div>
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />
          </div>

          {/* Job URL for Job Applied */}
          {isJob && (
            <FormField control={form.control} name="jobUrl" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold text-foreground">Job Posting URL <span className="text-muted-foreground font-normal text-[10px]">(optional)</span></FormLabel>
                <FormControl>
                  <div className="relative">
                    <ExternalLink className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 rounded-lg border-border/60 text-xs h-9" placeholder="https://recruitment.company.com/job..." {...field} />
                  </div>
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />
          )}
        </div>

        {/* Section 2: Mock Interview evaluation details */}
        {isMock && (
          <div className="space-y-4 rounded-xl border border-purple-100 dark:border-purple-900 bg-purple-50/20 dark:bg-purple-950/10 p-4 animate-in fade-in duration-200">
            <div className="space-y-0.5 pb-2 border-b border-purple-100 dark:border-purple-900">
              <h4 className="text-xs font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" /> Practice Evaluation Metrics
              </h4>
              <p className="text-[10px] text-muted-foreground">Capture ratings, interviewer notes, and candidate feedback.</p>
            </div>
            
            <div className="space-y-3.5 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="mockType" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] font-bold text-purple-900 dark:text-purple-300">Mock Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="rounded-lg border-purple-200 dark:border-purple-800 bg-background text-xs h-8.5">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-xl border border-border/50 shadow-md">
                        {MOCK_INTERVIEW_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )} />

                <FormField control={form.control} name="mockInterviewer" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[11px] font-bold text-purple-900 dark:text-purple-300">Interviewer <span className="text-muted-foreground font-normal text-[10px]">(optional)</span></FormLabel>
                    <FormControl>
                      <Input className="rounded-lg border-purple-200 dark:border-purple-800 bg-background text-xs h-8.5" placeholder="Interviewer name..." {...field} />
                    </FormControl>
                    <FormMessage className="text-[10px]" />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="mockScore" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-bold text-purple-900 dark:text-purple-300">Score Rating <span className="text-muted-foreground font-normal text-[10px]">(1–10 scale, optional)</span></FormLabel>
                  <FormControl>
                    <Input type="number" min="1" max="10" className="rounded-lg border-purple-200 dark:border-purple-800 bg-background text-xs h-8.5" placeholder="e.g. 8" {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />

              <FormField control={form.control} name="mockStrengths" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-bold text-purple-900 dark:text-purple-300">Key Strengths <span className="text-muted-foreground font-normal text-[10px]">(optional)</span></FormLabel>
                  <FormControl>
                    <Textarea placeholder="What elements did the candidate handle exceptionally well..." rows={2} className="resize-none rounded-lg border-purple-200 dark:border-purple-800 bg-background text-xs" {...field} />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />

              <FormField control={form.control} name="mockImprovements" render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] font-bold text-purple-900 dark:text-purple-300">Areas for Growth <span className="text-muted-foreground font-normal text-[10px]">(optional)</span></FormLabel>
                  <FormControl>
                    <Textarea placeholder="What concepts require additional mock practice or review..." rows={2} className="resize-none rounded-lg border-purple-200 dark:border-purple-800 bg-background text-xs" {...field} />
                  </FormControl>
                  <FormMessage className="text-[10px]" />
                </FormItem>
              )} />
            </div>
          </div>
        )}

        {/* Suggestion highlight for Offers */}
        {isOffer && selectedStudent && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 animate-in slide-in-from-bottom-2 duration-300">
            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Board Status Sync Recommended</p>
              <p className="text-[10px] text-emerald-700 dark:text-emerald-500 mt-0.5 leading-relaxed">
                Consider opening the **Placement Tracker** and updating <strong>{selectedStudent.name}</strong> to the &quot;Offer Received&quot; pipeline stage.
              </p>
            </div>
          </div>
        )}

        {/* Section 3: Note details */}
        <div className="space-y-4 pt-1">
          <FormField control={form.control} name="note" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold text-foreground">Summary & Notes <span className="text-muted-foreground font-normal text-[10px]">(optional)</span></FormLabel>
              <FormControl>
                <Textarea placeholder="Provide additional background, next round timing details, or review checklists..." rows={3} className="resize-none rounded-lg border-border/60 text-xs" {...field} />
              </FormControl>
              <FormMessage className="text-[10px]" />
            </FormItem>
          )} />
        </div>

        {/* Footer action buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
          <Button type="button" variant="outline" onClick={onSuccess} className="rounded-lg text-xs h-9">
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs h-9 gap-1.5 px-4">
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Log Milestone
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ─── Refactored Edit Log Form ────────────────────────────────────────────────

function EditLogForm({
  log,
  students,
  onSuccess,
}: {
  log: ProgressLog;
  students: Student[];
  onSuccess: () => void;
}) {
  const form = useForm<EditLogValues>({
    resolver: standardSchemaResolver(editLogSchema),
    defaultValues: {
      logType: log.log_type,
      company: log.company_name,
      date:    log.scheduled_date || '',
      time:    log.scheduled_time || '',
      note:    log.note || '',
      jobUrl:  log.job_url || '',
    },
  });

  const logType = form.watch('logType');
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (values: EditLogValues) => {
    setIsLoading(true);
    try {
      const body: Record<string, unknown> = {
        company_name:   values.company,
        log_type:       values.logType,
        scheduled_date: values.date,
        scheduled_time: values.time || null,
        note:           values.note || null,
      };
      if (values.logType === 'Job Applied') body.job_url = values.jobUrl || null;
      const res = await fetch(`/api/progress-logs/${log.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) { toast.error(d.message || 'Failed to update log'); return; }
      toast.success('Progress log updated successfully');
      onSuccess();
    } catch {
      toast.error('An unexpected connection error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

        {/* Section header */}
        <div className="space-y-1 pb-3 border-b border-border/40">
          <h3 className="text-base font-bold text-foreground flex items-center gap-1.5">
            <Edit3 className="w-4 h-4 text-indigo-500" /> Edit Progress Log Details
          </h3>
          <p className="text-xs text-muted-foreground">Modify active milestone scheduling and recruiters.</p>
        </div>

        <div className="space-y-4 pt-1">
          {/* Candidate (read-only label) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground">Candidate</label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50">
              <span className="text-xs font-semibold text-foreground">
                {students.find(s => s.id === log.student_id)?.name || log.student_name}
              </span>
              <span className="text-[10px] text-muted-foreground">({log.student_email})</span>
            </div>
          </div>

          {/* Type + Company */}
          <div className="grid grid-cols-2 gap-3.5">
            <FormField control={form.control} name="logType" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold text-foreground">Activity Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="rounded-lg border-border/60">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="rounded-xl border border-border/50 shadow-md">
                    <SelectItem value="Interview Call" className="text-xs">Interview Call</SelectItem>
                    <SelectItem value="Job Applied" className="text-xs">Job Applied</SelectItem>
                    <SelectItem value="Mock Interview" className="text-xs">Mock Interview</SelectItem>
                    <SelectItem value="Job Task" className="text-xs">Job Task</SelectItem>
                    <SelectItem value="Offer" className="text-xs">Offer</SelectItem>
                    <SelectItem value="Other" className="text-xs">Other</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            <FormField control={form.control} name="company" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold text-foreground">Target Recruiter</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Building2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 rounded-lg border-border/60 text-xs h-9" {...field} />
                  </div>
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />
          </div>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3.5">
            <FormField control={form.control} name="date" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold text-foreground">Milestone Date</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input type="date" className="pl-8 rounded-lg border-border/60 text-xs h-9" {...field} />
                  </div>
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />

            <FormField control={form.control} name="time" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold text-foreground">Time <span className="text-muted-foreground font-normal text-[10px]">(optional)</span></FormLabel>
                <FormControl>
                  <div className="relative">
                    <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input type="time" className="pl-8 rounded-lg border-border/60 text-xs h-9" {...field} />
                  </div>
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />
          </div>

          {/* Application URL */}
          {logType === 'Job Applied' && (
            <FormField control={form.control} name="jobUrl" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-bold text-foreground">Job Posting URL <span className="text-muted-foreground font-normal text-[10px]">(optional)</span></FormLabel>
                <FormControl>
                  <div className="relative">
                    <ExternalLink className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input className="pl-8 rounded-lg border-border/60 text-xs h-9" placeholder="https://..." {...field} />
                  </div>
                </FormControl>
                <FormMessage className="text-[10px]" />
              </FormItem>
            )} />
          )}
        </div>

        {/* Section 2: Notes */}
        <div className="space-y-4 pt-1">
          <FormField control={form.control} name="note" render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-bold text-foreground">Summary & Notes <span className="text-muted-foreground font-normal text-[10px]">(optional)</span></FormLabel>
              <FormControl>
                <Textarea placeholder="Edit observations or timeline feedback details..." rows={3} className="resize-none rounded-lg border-border/60 text-xs" {...field} />
              </FormControl>
              <FormMessage className="text-[10px]" />
            </FormItem>
          )} />
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/40">
          <Button type="button" variant="outline" onClick={onSuccess} className="rounded-lg text-xs h-9">
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs h-9 gap-1.5 px-4">
            {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
