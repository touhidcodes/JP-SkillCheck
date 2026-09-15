'use client';

import { useMemo, useState, useEffect } from 'react';
import type React from 'react';
import {
  AlertTriangle,
  SlidersHorizontal,
  CheckCircle2,
  ShieldAlert,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Phone,
  MessageSquare,
  CalendarPlus,
  Plus,
  Eye,
  X,
  AlertCircle
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  BarChart,
  Bar
} from 'recharts';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { usePlacementStore } from '@/lib/placement/store';
import { buildRiskTrend } from '@/lib/risk/placement-risk';
import { StatsCard } from '@/components/dashboard/stats-card';
import { MetricPopover } from '@/components/shared/metric-popover';

// Intervention & Dialog Orchestrator Components
import { StudentProfileSheet } from '@/components/dashboard/student-profile-sheet';
import { AddNoteDialog } from '@/components/dashboard/dialogs/add-note-dialog';
import { LogProgressDialog } from '@/components/dashboard/dialogs/log-progress-dialog';
import { CreateTaskDialog } from '@/components/mentor/tasks/create-task-dialog';
import { RiskOverrideDialog } from '@/components/dashboard/dialogs/risk-override-dialog';
import type { RiskLevel, Student } from '@/types';

const RISK_BADGES: Record<RiskLevel | 'critical', { label: string; className: string }> = {
  safe: { label: 'Safe', className: 'bg-emerald-50 text-emerald-700 border-emerald-250 font-bold dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' },
  medium: { label: 'Medium', className: 'bg-amber-50 text-amber-700 border-amber-250 font-bold dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30' },
  high: { label: 'High', className: 'bg-red-50 text-red-700 border-red-250 font-bold dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/30' },
  critical: { label: 'Critical', className: 'bg-rose-900 text-white border-rose-950 font-black animate-pulse' }
};

const getFactorCategory = (factor: string): string => {
  const f = factor.toLowerCase();
  if (f.includes('attendance')) return 'Attendance Drop';
  if (f.includes('inactive')) return 'Platform Inactivity';
  if (f.includes('stage stuck') || f.includes('stagnant') || f.includes('stage')) return 'Stage Stagnation';
  if (f.includes('interview')) return 'Interview Pipeline';
  if (f.includes('assignment')) return 'Assignment Backlog';
  if (f.includes('no mentor') || f.includes('contact')) return 'Communication Gap';
  return 'Other Factors';
};

export default function RiskTrackerPage() {
  const {
    students,
    riskScores,
    attendance,
    progressLogs,
    alerts,
    dismissAlert,
    resolveAlert,
    isLoading,
    error
  } = usePlacementStore();

  // Search, Sorting & Filter States
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<{ level?: string; batch?: string; stage?: string; factor?: string }>({});
  const [sortField, setSortField] = useState<'name' | 'score' | 'batch' | 'stage' | 'last_contact'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Pagination States
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Dialog Orchestrator State
  const [activeDialog, setActiveDialog] = useState<{
    type: 'profile' | 'edit' | 'note' | 'log' | 'task' | 'override';
    student: Student;
  } | null>(null);

  // Re-verify page limits when filtered rows length changes
  const rows = useMemo(() => {
    return riskScores
      .map((risk) => ({ risk, student: students.find((student) => student.id === risk.student_id) }))
      .filter((row): row is { risk: typeof row.risk; student: Student } => Boolean(row.student))
      .filter(({ risk, student }) => {
        if (query) {
          const q = query.toLowerCase();
          const matchesName = student.name.toLowerCase().includes(q);
          const matchesFactor = risk.top_factor.toLowerCase().includes(q);
          if (!matchesName && !matchesFactor) return false;
        }
        if (filters.level && risk.level !== filters.level) return false;
        if (filters.batch && student.batch !== filters.batch) return false;
        if (filters.stage && student.stage !== filters.stage) return false;
        if (filters.factor && !risk.top_factor.toLowerCase().includes(filters.factor.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;

        if (sortField === 'score') {
          valA = a.risk.score;
          valB = b.risk.score;
        } else if (sortField === 'name') {
          valA = a.student.name.toLowerCase();
          valB = b.student.name.toLowerCase();
        } else if (sortField === 'batch') {
          valA = (a.student.batch || '').toLowerCase();
          valB = (b.student.batch || '').toLowerCase();
        } else if (sortField === 'stage') {
          valA = a.student.stage.toLowerCase();
          valB = b.student.stage.toLowerCase();
        } else if (sortField === 'last_contact') {
          const dateA = a.student.last_activity_date || a.student.updated_at || '';
          const dateB = b.student.last_activity_date || b.student.updated_at || '';
          valA = new Date(dateA).getTime() || 0;
          valB = new Date(dateB).getTime() || 0;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [riskScores, students, query, filters, sortField, sortOrder]);

  const trend = useMemo(() => buildRiskTrend(students, attendance, progressLogs), [students, attendance, progressLogs]);
  const openAlerts = alerts.filter((alert) => alert.status === 'open');
  const high = riskScores.filter((risk) => risk.level === 'high').length;
  const medium = riskScores.filter((risk) => risk.level === 'medium').length;
  const safe = riskScores.filter((risk) => risk.level === 'safe').length;
  const batches = Array.from(new Set(students.map((student) => student.batch).filter(Boolean))).sort();

  // Dynamic factor counts for the factors chart
  const factorCounts = useMemo(() => {
    const counts: Record<string, { name: string; high: number; medium: number; total: number }> = {
      'Attendance Drop': { name: 'Attendance Drop', high: 0, medium: 0, total: 0 },
      'Platform Inactivity': { name: 'Platform Inactivity', high: 0, medium: 0, total: 0 },
      'Stage Stagnation': { name: 'Stage Stagnation', high: 0, medium: 0, total: 0 },
      'Interview Pipeline': { name: 'Interview Pipeline', high: 0, medium: 0, total: 0 },
      'Assignment Backlog': { name: 'Assignment Backlog', high: 0, medium: 0, total: 0 },
      'Communication Gap': { name: 'Communication Gap', high: 0, medium: 0, total: 0 },
    };

    riskScores.forEach((risk) => {
      if (risk.level === 'safe') return;
      const cat = getFactorCategory(risk.top_factor);
      if (counts[cat]) {
        if (risk.level === 'high') counts[cat].high += 1;
        if (risk.level === 'medium') counts[cat].medium += 1;
        counts[cat].total += 1;
      }
    });

    return Object.values(counts).filter((c) => c.total > 0).sort((a, b) => b.total - a.total);
  }, [riskScores]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [query, filters]);

  // Paginated Rows
  const totalPages = Math.ceil(rows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  // KPI Card dynamic WoW trend values
  const highTrend = useMemo(() => {
    if (trend.length < 2) return { value: 0 };
    const current = trend[trend.length - 1].high;
    const previous = trend[trend.length - 2].high;
    const diff = current - previous;
    return { value: diff, label: 'WoW Change' };
  }, [trend]);

  const mediumTrend = useMemo(() => {
    if (trend.length < 2) return { value: 0 };
    const current = trend[trend.length - 1].medium;
    const previous = trend[trend.length - 2].medium;
    const diff = current - previous;
    return { value: diff, label: 'WoW Change' };
  }, [trend]);

  const safeTrend = useMemo(() => {
    if (trend.length < 2) return { value: 0 };
    const current = trend[trend.length - 1].safe;
    const previous = trend[trend.length - 2].safe;
    const diff = current - previous;
    return { value: diff, label: 'WoW Change' };
  }, [trend]);

  const alertsTrend = useMemo(() => {
    const resolvedCount = alerts.filter((a) => a.status !== 'open').length;
    return { value: resolvedCount, label: 'resolved all-time' };
  }, [alerts]);

  const handleToggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const hasActiveFilters = Object.values(filters).some(Boolean) || query !== '';
  const clearAllFilters = () => {
    setFilters({});
    setQuery('');
  };

  const selectedStudentsForBulk = useMemo(() => {
    return students.filter((s) => selected.has(s.id)).map((s) => ({ id: s.id, name: s.name }));
  }, [students, selected]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48 rounded-lg" />
          <Skeleton className="h-4 w-96 rounded-lg" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <Skeleton className="h-96 rounded-2xl" />
            <Skeleton className="h-[400px] rounded-2xl" />
          </div>
          <Skeleton className="h-[600px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-500/5 rounded-2xl">
        <CardContent className="p-8 text-center space-y-4">
          <AlertCircle className="h-12 w-12 text-red-650 mx-auto" />
          <p className="font-bold text-red-700 text-sm">Failed to load risk analytics: {error}</p>
          <Button className="rounded-xl text-xs font-bold" onClick={() => window.location.reload()}>
            Retry Connection
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">
            Risk Tracker & Analytics
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Identify stagnant students, monitor platform engagement, and trigger automated alerts.
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          title="High Risk"
          value={high}
          icon={AlertTriangle}
          color="red"
          trend={highTrend}
          info={{
            description: "Students flagged as high risk (Score > 50) based on attendance, inactivity, and pipeline stagnation.",
            metrics: "Risk scores calculated from: attendance rate, activity gap, stage stagnant days, assignment progress",
            calculation: "COUNT(riskScores WHERE level = 'high')",
            importance: "These students need immediate mentor outreach to resolve obstacles and draft action recovery checklists."
          }}
        />
        <StatsCard
          title="Medium Risk"
          value={medium}
          icon={SlidersHorizontal}
          color="amber"
          trend={mediumTrend}
          info={{
            description: "Students flagged as medium risk (Score 26-50) needing close observation.",
            metrics: "Risk scores in the moderate 26-50 tier",
            calculation: "COUNT(riskScores WHERE 26 <= score <= 50)",
            importance: "Serves as the cohort watch list. Timely support can shift these students back to safe."
          }}
        />
        <StatsCard
          title="Safe Profile"
          value={safe}
          icon={CheckCircle2}
          color="emerald"
          trend={safeTrend}
          info={{
            description: "Students flagged as safe (Score 0-25) meeting target engagement thresholds.",
            metrics: "Risk scores 0-25 (excellent attendance, recent activity)",
            calculation: "COUNT(riskScores WHERE score <= 25)",
            importance: "Indicates normal progress logs. Maintain motivation with standard checklists."
          }}
        />
        <StatsCard
          title="Active Alerts"
          value={openAlerts.length}
          icon={ShieldAlert}
          color="purple"
          trend={alertsTrend}
          info={{
            description: "Automated real-time notifications triggered when risk parameters cross standard thresholds.",
            metrics: "System logs and event thresholds",
            calculation: "COUNT(alerts WHERE status = 'open')",
            importance: "Alerts require immediate operational feedback. Resolve or dismiss from the sidebar timeline."
          }}
        />
      </div>

      {/* Main Content Layout */}
      <div className="grid gap-6 xl:grid-cols-[1fr_340px] items-start">
        <div className="space-y-6">
          
          {/* Filters, Search & Table Block */}
          <Card className="rounded-2xl border border-border/40 bg-card shadow-xs">
            <CardContent className="space-y-4 p-5">
              
              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-1 min-w-[240px] items-center gap-2 bg-white dark:bg-slate-900 border border-border/50 rounded-xl px-3 py-1 text-slate-700">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    placeholder="Search name or risk factor..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="border-0 bg-transparent p-0 h-8 focus-visible:ring-0 focus-visible:ring-offset-0 text-xs w-full"
                  />
                  {query && (
                    <button onClick={() => setQuery('')} className="p-0.5 rounded-full hover:bg-slate-100">
                      <X className="h-3 w-3 text-slate-400" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select value={filters.level || '__all__'} onValueChange={(v) => setFilters(f => ({ ...f, level: v === '__all__' ? undefined : v }))}>
                    <SelectTrigger className="h-9 w-[130px] rounded-xl border-border/50 text-xs bg-white dark:bg-slate-900">
                      <SelectValue placeholder="Risk Level" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="__all__">All Risks</SelectItem>
                      <SelectItem value="high">High Risk</SelectItem>
                      <SelectItem value="medium">Medium Risk</SelectItem>
                      <SelectItem value="safe">Safe</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filters.batch || '__all__'} onValueChange={(v) => setFilters(f => ({ ...f, batch: v === '__all__' ? undefined : v }))}>
                    <SelectTrigger className="h-9 w-[130px] rounded-xl border-border/50 text-xs bg-white dark:bg-slate-900">
                      <SelectValue placeholder="Batch" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="__all__">All Batches</SelectItem>
                      {batches.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filters.stage || '__all__'} onValueChange={(v) => setFilters(f => ({ ...f, stage: v === '__all__' ? undefined : v }))}>
                    <SelectTrigger className="h-9 w-[130px] rounded-xl border-border/50 text-xs bg-white dark:bg-slate-900">
                      <SelectValue placeholder="Stage" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="__all__">All Stages</SelectItem>
                      <SelectItem value="learning">Learning</SelectItem>
                      <SelectItem value="applying">Applying</SelectItem>
                      <SelectItem value="interviewing">Interviewing</SelectItem>
                      <SelectItem value="offer_pending">Offer Pending</SelectItem>
                      <SelectItem value="placed">Placed</SelectItem>
                      <SelectItem value="hired">Hired</SelectItem>
                    </SelectContent>
                  </Select>

                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-purple-650 hover:text-purple-700 hover:bg-purple-50 rounded-xl h-9 text-xs font-bold transition-all px-2.5">
                      <X className="mr-1 h-3.5 w-3.5" /> Clear Filters
                    </Button>
                  )}

                  {selected.size > 0 && (
                    <Button
                      onClick={() => {
                        // Open task dialog pre-filled with selected students
                        setActiveDialog({
                          type: 'task',
                          student: students.find(s => selected.has(s.id))!
                        });
                      }}
                      className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-9 text-xs font-bold transition-all px-3 shadow-xs"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Tasks ({selected.size})
                    </Button>
                  )}
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-hidden border border-border/60 rounded-2xl bg-white">
                <Table>
                  <TableHeader className="bg-slate-50/70 border-b border-border/55">
                    <TableRow>
                      <TableHead className="w-10 px-4 py-3">
                        <Checkbox
                          checked={paginatedRows.length > 0 && paginatedRows.every((r) => selected.has(r.student.id))}
                          onCheckedChange={(checked) => {
                            const next = new Set(selected);
                            paginatedRows.forEach((r) => {
                              if (checked) next.add(r.student.id);
                              else next.delete(r.student.id);
                            });
                            setSelected(next);
                          }}
                          aria-label="Select all rows"
                        />
                      </TableHead>
                      <TableHead
                        onClick={() => handleToggleSort('name')}
                        className="py-3 px-4 font-bold text-slate-655 hover:bg-slate-100/50 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-1">
                          Student Name
                          <ArrowUpDown className={cn('h-3.5 w-3.5', sortField === 'name' ? 'text-purple-650' : 'text-slate-400')} />
                        </div>
                      </TableHead>
                      <TableHead
                        onClick={() => handleToggleSort('score')}
                        className="py-3 px-4 font-bold text-slate-655 hover:bg-slate-100/50 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-1">
                          Risk Score
                          <ArrowUpDown className={cn('h-3.5 w-3.5', sortField === 'score' ? 'text-purple-650' : 'text-slate-400')} />
                        </div>
                      </TableHead>
                      <TableHead
                        onClick={() => handleToggleSort('batch')}
                        className="py-3 px-4 font-bold text-slate-655 hover:bg-slate-100/50 cursor-pointer select-none animate-in"
                      >
                        <div className="flex items-center gap-1">
                          Cohort
                          <ArrowUpDown className={cn('h-3.5 w-3.5', sortField === 'batch' ? 'text-purple-650' : 'text-slate-400')} />
                        </div>
                      </TableHead>
                      <TableHead
                        onClick={() => handleToggleSort('stage')}
                        className="py-3 px-4 font-bold text-slate-655 hover:bg-slate-100/50 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-1">
                          Stage
                          <ArrowUpDown className={cn('h-3.5 w-3.5', sortField === 'stage' ? 'text-purple-650' : 'text-slate-400')} />
                        </div>
                      </TableHead>
                      <TableHead className="py-3 px-4 font-bold text-slate-655">Top Factor</TableHead>
                      <TableHead
                        onClick={() => handleToggleSort('last_contact')}
                        className="py-3 px-4 font-bold text-slate-655 hover:bg-slate-100/50 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-1">
                          Last Activity
                          <ArrowUpDown className={cn('h-3.5 w-3.5', sortField === 'last_contact' ? 'text-purple-650' : 'text-slate-400')} />
                        </div>
                      </TableHead>
                      <TableHead className="py-3 px-4 text-right font-bold text-slate-655">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-64 text-center">
                          <div className="flex flex-col items-center justify-center space-y-2.5">
                            <SlidersHorizontal className="h-10 w-10 text-slate-300" />
                            <p className="font-extrabold text-slate-800 text-sm">No risk matches found</p>
                            <p className="text-xs text-muted-foreground">Adjust filters or search parameters.</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedRows.map(({ student, risk }) => {
                        const isCritical = risk.score > 80;
                        const badgeStyle = isCritical ? RISK_BADGES.critical : RISK_BADGES[risk.level];

                        return (
                          <TableRow
                            key={student.id}
                            className={cn(
                              'hover:bg-slate-50/70 border-b border-border/40 transition-all duration-200',
                              risk.level === 'high' && 'bg-red-500/[0.02]',
                              risk.level === 'medium' && 'bg-amber-500/[0.01]'
                            )}
                          >
                            <TableCell className="px-4 py-3.5">
                              <Checkbox
                                checked={selected.has(student.id)}
                                onCheckedChange={(checked) => {
                                  const next = new Set(selected);
                                  if (checked) next.add(student.id);
                                  else next.delete(student.id);
                                  setSelected(next);
                                }}
                                aria-label={`Select ${student.name}`}
                              />
                            </TableCell>
                            <TableCell className="px-4 py-3.5 font-semibold">
                              <div className="flex flex-col">
                                <button
                                  onClick={() => setActiveDialog({ type: 'profile', student })}
                                  className="text-left font-extrabold text-slate-900 hover:text-purple-650 transition-colors"
                                >
                                  {student.name}
                                </button>
                                {risk.manual_override && (
                                  <span className="mt-1 w-fit inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-black text-slate-600 dark:text-slate-400 border border-slate-200">
                                    Manual Override
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-3.5">
                              <div className="flex min-w-[130px] items-center gap-2">
                                <div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    className={cn(
                                      'h-full rounded-full transition-all duration-500',
                                      isCritical ? 'bg-rose-900' :
                                      risk.level === 'high' ? 'bg-red-500' :
                                      risk.level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
                                    )}
                                    style={{ width: `${risk.score}%` }}
                                  />
                                </div>
                                <span className="w-8 text-right text-xs font-black text-slate-800 tabular-nums">
                                  {Math.round(risk.score)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-3.5 text-xs font-semibold text-slate-600">{student.batch}</TableCell>
                            <TableCell className="px-4 py-3.5 text-xs font-semibold capitalize text-slate-600">
                              {student.stage.replace('_', ' ')}
                            </TableCell>
                            <TableCell className="px-4 py-3.5">
                              <Badge variant="outline" className={cn('px-2.5 py-0.5 rounded-full text-[10px] tracking-wide border', badgeStyle.className)}>
                                {badgeStyle.label}: {risk.top_factor}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-4 py-3.5 text-xs font-semibold text-slate-600">
                              {student.last_activity_date ? student.last_activity_date : 'Never'}
                            </TableCell>
                            <TableCell className="px-4 py-3.5 text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger className="flex items-center justify-center p-1.5 hover:bg-slate-100 rounded-xl transition-all ml-auto">
                                  <MoreHorizontal className="h-4.5 w-4.5 text-slate-500" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl border border-border/60 shadow-md">
                                  <DropdownMenuLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Interventions</DropdownMenuLabel>
                                  <DropdownMenuItem className="rounded-lg text-xs flex items-center gap-2 cursor-pointer" onClick={() => setActiveDialog({ type: 'log', student })}>
                                    <Phone className="h-3.5 w-3.5 text-slate-500" /> Log Call Event
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="rounded-lg text-xs flex items-center gap-2 cursor-pointer" onClick={() => setActiveDialog({ type: 'note', student })}>
                                    <MessageSquare className="h-3.5 w-3.5 text-slate-500" /> Add Notes log
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="rounded-lg text-xs flex items-center gap-2 cursor-pointer" onClick={() => setActiveDialog({ type: 'task', student })}>
                                    <CalendarPlus className="h-3.5 w-3.5 text-slate-500" /> Schedule Task
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="rounded-lg text-xs flex items-center gap-2 cursor-pointer" onClick={() => setActiveDialog({ type: 'override', student })}>
                                    <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" /> Override Severity
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="rounded-lg text-xs flex items-center gap-2 cursor-pointer font-bold text-purple-650" onClick={() => setActiveDialog({ type: 'profile', student })}>
                                    <Eye className="h-3.5 w-3.5 text-purple-650" /> View Profile Sheet
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {rows.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-border/40 text-xs">
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="font-semibold">Rows per page:</span>
                    <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                      <SelectTrigger className="h-8 w-[70px] rounded-lg border-border/50 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-lg">
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="ml-2 font-bold text-slate-650">
                      Showing {Math.min(rows.length, (page - 1) * pageSize + 1)}-{Math.min(rows.length, page * pageSize)} of {rows.length} rows
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-auto">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-lg border-border/50"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="font-black px-2 flex items-center gap-1 text-slate-700">
                      <span>Page</span>
                      <span>{page}</span>
                      <span className="text-slate-400">/</span>
                      <span>{totalPages}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-lg border-border/50"
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Analytics Charts Grid */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Risk Trend Chart */}
            <Card className="rounded-2xl border border-border/40 bg-card shadow-xs">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">8-Week Risk Trend</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Stacked cohort risk levels over time.</p>
                  </div>
                  <MetricPopover
                    title="Risk Trend Calculation"
                    description="Visualizes changes in students' aggregate risk classifications over the last 8 weeks."
                    metrics="Historical snapshots of attendance, activity gap, and pipeline logs."
                    calculation="Trend(Week) = SUM(students categorized as safe / medium / high risk at target date)"
                    importance="Helps spot overall cohort trajectory. An upward trend in Safe profiles signals healthy engagement."
                  />
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSafe" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorMedium" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-100" />
                      <XAxis dataKey="week" className="text-[10px] font-bold text-slate-400" tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} className="text-[10px] font-bold text-slate-400" tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                        labelClassName="font-extrabold text-slate-900 text-xs"
                        itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }} />
                      <Area type="monotone" name="Safe" dataKey="safe" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorSafe)" />
                      <Area type="monotone" name="Medium Risk" dataKey="medium" stroke="#F59E0B" strokeWidth={2} fillOpacity={1} fill="url(#colorMedium)" />
                      <Area type="monotone" name="High Risk" dataKey="high" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorHigh)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Risk Factors Chart */}
            <Card className="rounded-2xl border border-border/40 bg-card shadow-xs">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-slate-900 text-sm">Primary Threat Factors</h3>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Distribution of at-risk students by primary trigger.</p>
                  </div>
                  <MetricPopover
                    title="Risk Factor Analysis"
                    description="Calculates the primary cause driving the risk score for all students with medium or high risk profiles."
                    metrics="Student platform activity, attendance rosters, and interview reports."
                    calculation="Factor counts = SUM(students in high/medium risk where factor = top trigger)"
                    importance="Enables operational team targeting. If Attendance Drop dominates, design cohort recovery sessions."
                  />
                </div>
                <div className="h-64">
                  {factorCounts.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center space-y-2 text-center">
                      <SlidersHorizontal className="h-8 w-8 text-slate-350" />
                      <p className="text-xs font-bold text-slate-500">No active threat factors</p>
                      <p className="text-[10px] text-slate-400">All students are in safe profile state.</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={factorCounts} layout="vertical" margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-slate-100" />
                        <XAxis type="number" allowDecimals={false} className="text-[10px] font-bold text-slate-400" tickLine={false} axisLine={false} />
                        <YAxis type="category" dataKey="name" className="text-[10px] font-bold text-slate-650" width={110} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                          labelClassName="font-extrabold text-slate-900 text-xs"
                          itemStyle={{ fontSize: '11px', fontWeight: 'bold' }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }} />
                        <Bar name="Medium Risk" dataKey="medium" stackId="a" fill="#F59E0B" radius={[0, 0, 0, 0]} />
                        <Bar name="High Risk" dataKey="high" stackId="a" fill="#EF4444" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Automated Alerts Timeline */}
        <Card className="rounded-2xl border border-border/40 bg-card shadow-xs self-start">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-slate-900 text-sm">Automated Alerts</h3>
              <span className="bg-purple-100 text-purple-750 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                {openAlerts.length} Active
              </span>
            </div>
            
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {openAlerts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-xs font-semibold text-slate-400 bg-slate-50/50 space-y-1">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                  <p className="font-bold text-slate-700">Timeline clear</p>
                  <p>No active alerts detected.</p>
                </div>
              ) : (
                openAlerts.slice(0, 12).map((alert) => {
                  const alertStudent = students.find((s) => s.id === alert.student_id);
                  return (
                    <div
                      key={alert.id}
                      className={cn(
                        'rounded-2xl border p-4 space-y-3 transition-all',
                        alert.level === 'high'
                          ? 'border-red-100 bg-red-500/[0.015] hover:border-red-200'
                          : 'border-amber-100 bg-amber-500/[0.01] hover:border-amber-200'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-extrabold text-slate-850 leading-normal">{alert.message}</p>
                          <p className="mt-1 text-[9px] font-bold text-slate-400">
                            {new Date(alert.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-dashed border-border/50">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            resolveAlert(alert.id);
                            toast.success('Alert resolved');
                          }}
                          className="h-8 px-2.5 rounded-lg text-[10px] font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        >
                          Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            dismissAlert(alert.id);
                            toast.info('Alert dismissed');
                          }}
                          className="h-8 px-2.5 rounded-lg text-[10px] font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                        >
                          Dismiss
                        </Button>
                        {alertStudent && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setActiveDialog({
                                type: 'task',
                                student: alertStudent
                              });
                            }}
                            className="h-8 px-2.5 rounded-lg text-[10px] font-bold bg-purple-600 text-white hover:bg-purple-700 shadow-3xs ml-auto"
                          >
                            + Action task
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog Orchestration Adapters */}
      {activeDialog && (
        <>
          <StudentProfileSheet
            student={activeDialog.type === 'profile' ? activeDialog.student : null}
            onClose={() => setActiveDialog(null)}
          />

          <AddNoteDialog
            student={activeDialog.type === 'note' ? activeDialog.student : null}
            open={activeDialog.type === 'note'}
            onOpenChange={(open: boolean) => !open && setActiveDialog(null)}
          />

          <LogProgressDialog
            student={activeDialog.type === 'log' ? activeDialog.student : null}
            open={activeDialog.type === 'log'}
            onOpenChange={(open: boolean) => !open && setActiveDialog(null)}
          />

          <RiskOverrideDialog
            student={activeDialog.type === 'override' ? activeDialog.student : null}
            open={activeDialog.type === 'override'}
            onOpenChange={(open: boolean) => !open && setActiveDialog(null)}
          />

          <CreateTaskDialog
            students={activeDialog.type === 'task' ? selected.size > 1 ? selectedStudentsForBulk : [{ id: activeDialog.student.id, name: activeDialog.student.name }] : []}
            defaultStudentId={activeDialog.type === 'task' ? activeDialog.student.id : undefined}
            open={activeDialog.type === 'task'}
            onOpenChange={(open: boolean) => !open && setActiveDialog(null)}
            onSuccess={() => {
              setActiveDialog(null);
              setSelected(new Set());
            }}
          />
        </>
      )}
    </div>
  );
}
