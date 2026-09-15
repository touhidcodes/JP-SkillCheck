'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Trophy, Users, Search, X, Info,
  ArrowUpDown, GraduationCap, Award, CheckCircle2,
  Activity, Calendar
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Pagination, PaginationContent, PaginationEllipsis,
  PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import { StatsCard } from '@/components/dashboard/stats-card';
import { cn } from '@/lib/utils';
import type { ActivityTier } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'weekly' | 'monthly' | 'all';

interface StudentEntry {
  rank: number;
  id: string;
  name: string;
  batch: string;
  project: string;
  stage: string;
  risk_status: string;
  hired: boolean;
  interviews: number;
  tasks: number;
  offers: number;
  jobs_applied: number;
  attendance_rate: number | null;
  activity_tier: ActivityTier;
  activity_description: string;
  score: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;
const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const STAGE_BADGE: Record<string, string> = {
  learning:      'bg-slate-100 text-slate-650 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800',
  applying:      'bg-blue-50 text-blue-700 border-blue-155 dark:bg-blue-955/30 dark:text-blue-400 dark:border-blue-900',
  interviewing:  'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-955/20 dark:text-amber-400 dark:border-amber-900',
  offer_pending: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-955/20 dark:text-orange-400 dark:border-orange-900',
  placed:        'bg-emerald-50 text-emerald-700 border-emerald-250 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900',
  hired:         'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900',
};

const TIER_BADGE: Record<ActivityTier, string> = {
  Excellent: 'bg-emerald-50 text-emerald-750 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400',
  Good:      'bg-blue-50 text-blue-750 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400',
  Moderate:  'bg-amber-50 text-amber-750 border-amber-200 dark:bg-amber-950/20 dark:text-amber-450',
  Inactive:  'bg-orange-50 text-orange-750 border-orange-200 dark:bg-orange-950/20 dark:text-orange-450',
  Critical:  'bg-red-50 text-red-750 border-red-200 dark:bg-red-950/20 dark:text-red-400',
};

const TIER_EMOJI: Record<ActivityTier, string> = {
  Excellent: '🌟',
  Good:      '✅',
  Moderate:  '⚡',
  Inactive:  '😴',
  Critical:  '🚨',
};

const AVATAR_COLORS = [
  'bg-violet-100 text-violet-750 dark:bg-violet-950/40 dark:text-violet-400',
  'bg-blue-100 text-blue-750 dark:bg-blue-950/40 dark:text-blue-400',
  'bg-emerald-100 text-emerald-750 dark:bg-emerald-950/40 dark:text-emerald-400',
  'bg-amber-100 text-amber-750 dark:bg-amber-950/40 dark:text-amber-450',
  'bg-rose-100 text-rose-750 dark:bg-rose-950/40 dark:text-rose-450',
  'bg-cyan-100 text-cyan-750 dark:bg-cyan-950/40 dark:text-cyan-400',
  'bg-indigo-100 text-indigo-750 dark:bg-indigo-950/40 dark:text-indigo-400',
  'bg-pink-100 text-pink-750 dark:bg-pink-950/40 dark:text-pink-400',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function RankCell({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <div className="flex items-center justify-center w-8 h-8">
        <span className="text-xl leading-none select-none">{MEDAL[rank]}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800">
      <span className="text-xs font-bold text-slate-500 tabular-nums">{rank}</span>
    </div>
  );
}

// ─── Skeletons ──────────────────────────────────────────────────────────────

function StatsGridSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="border-border/50 bg-card/60">
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-28" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32 mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PodiumSkeleton() {
  return (
    <div className="flex items-end justify-center gap-4 py-8 max-w-lg mx-auto">
      <div className="flex flex-col items-center gap-2 w-32">
        <Skeleton className="w-10 h-10 rounded-full" />
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-16 w-full rounded-t-lg" />
      </div>
      <div className="flex flex-col items-center gap-2 w-36">
        <Skeleton className="w-12 h-12 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-24 w-full rounded-t-lg" />
      </div>
      <div className="flex flex-col items-center gap-2 w-28">
        <Skeleton className="w-9 h-9 rounded-full" />
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-12 w-full rounded-t-lg" />
      </div>
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <TableRow>
      <TableCell className="w-12 pl-4">
        <Skeleton className="w-8 h-8 rounded-full" />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-full shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <Skeleton className="h-4 w-16" />
      </TableCell>
      <TableCell>
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-6 w-10 rounded" />
          ))}
        </div>
      </TableCell>
      <TableCell className="text-right pr-4">
        <Skeleton className="h-5 w-12 ml-auto rounded" />
      </TableCell>
    </TableRow>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MentorLeaderboardPage() {
  const [period, setPeriod] = useState<Period>('weekly');

  // Table filtering, sorting, pagination states
  const [studentSearch, setStudentSearch] = useState('');
  const [studentBatchFilter, setStudentBatchFilter] = useState<string>('all');
  const [studentStageFilter, setStudentStageFilter] = useState<string>('all');
  const [studentTierFilter, setStudentTierFilter] = useState<string>('all');
  const [studentRiskFilter, setStudentRiskFilter] = useState<string>('all');
  const [studentSortBy, setStudentSortBy] = useState<'rank' | 'score' | 'attendance_rate' | 'name'>('rank');
  const [studentSortOrder, setStudentSortOrder] = useState<'asc' | 'desc'>('asc');
  const [studentPage, setStudentPage] = useState(1);

  // Query for Students only
  const { data: studentData, isLoading: isLoadingStudents, isError: isErrorStudents } = useQuery({
    queryKey: ['leaderboard', 'students', period],
    queryFn: async () => {
      const res = await fetch(`/api/leaderboard?type=students&period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch student leaderboard');
      return res.json() as Promise<{ data: StudentEntry[]; period_label: string }>;
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const studentsList = useMemo(() => studentData?.data ?? [], [studentData]);

  // KPI Calculations
  const stats = useMemo(() => {
    if (!studentsList.length) return null;
    const total = studentsList.length;
    
    let totalAttendance = 0;
    let studentsWithAttendance = 0;
    studentsList.forEach(s => {
      if (s.attendance_rate !== null) {
        totalAttendance += s.attendance_rate;
        studentsWithAttendance++;
      }
    });
    const avgAttendance = studentsWithAttendance > 0 ? Math.round(totalAttendance / studentsWithAttendance) : 0;
    const totalHired = studentsList.filter(s => s.hired).length;
    const placementRate = Math.round((totalHired / total) * 100);

    return { total, avgAttendance, totalHired, placementRate };
  }, [studentsList]);

  // Filters setup
  const studentBatches = useMemo(() => {
    const batches = new Set<string>();
    studentsList.forEach(s => {
      if (s.batch) batches.add(s.batch);
    });
    return Array.from(batches).sort();
  }, [studentsList]);

  const processedStudents = useMemo(() => {
    let result = [...studentsList];

    // Search
    if (studentSearch.trim()) {
      const q = studentSearch.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.project?.toLowerCase().includes(q)
      );
    }

    // Batch filter
    if (studentBatchFilter !== 'all') {
      result = result.filter(s => s.batch === studentBatchFilter);
    }

    // Stage filter
    if (studentStageFilter !== 'all') {
      result = result.filter(s => s.stage === studentStageFilter);
    }

    // Activity Tier filter
    if (studentTierFilter !== 'all') {
      result = result.filter(s => s.activity_tier === studentTierFilter);
    }

    // Risk filter
    if (studentRiskFilter !== 'all') {
      result = result.filter(s => s.risk_status === studentRiskFilter);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (studentSortBy === 'rank') {
        comparison = a.rank - b.rank;
      } else if (studentSortBy === 'score') {
        comparison = b.score - a.score;
      } else if (studentSortBy === 'attendance_rate') {
        comparison = (b.attendance_rate ?? 0) - (a.attendance_rate ?? 0);
      } else if (studentSortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      }
      return studentSortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [studentsList, studentSearch, studentBatchFilter, studentStageFilter, studentTierFilter, studentRiskFilter, studentSortBy, studentSortOrder]);

  const totalStudentPages = Math.max(1, Math.ceil(processedStudents.length / PAGE_SIZE));
  const safeStudentPage = Math.min(studentPage, totalStudentPages);
  const paginatedStudents = useMemo(() => {
    return processedStudents.slice((safeStudentPage - 1) * PAGE_SIZE, safeStudentPage * PAGE_SIZE);
  }, [processedStudents, safeStudentPage]);

  // Page index helper
  const getPaginationPages = (current: number, total: number) => {
    const pages: (number | 'ellipsis')[] = [];
    if (total <= 5) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('ellipsis');
      for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (current < total - 2) pages.push('ellipsis');
      if (!pages.includes(total)) pages.push(total);
    }
    return pages;
  };

  // Score description popover
  const ScoreCalcPopover = () => (
    <Popover>
      <PopoverTrigger className="h-4.5 w-4.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-muted-foreground transition-colors cursor-help border-0 p-0">
        <Info className="w-3.5 h-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 shadow-xl border border-border/60 bg-background/95 backdrop-blur-md rounded-2xl text-xs space-y-2">
        <p className="font-bold text-foreground flex items-center gap-1.5">
          <Award className="w-4 h-4 text-indigo-500" /> Student Score Rubric
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Student performance score is computed dynamically based on active outcomes and logged events:
        </p>
        <div className="bg-muted/40 p-2.5 rounded-xl border font-mono text-[10px] text-slate-800 dark:text-slate-200 space-y-1">
          <div className="flex justify-between"><span>Interview Completed</span><span className="font-semibold text-indigo-600">× 3 pts</span></div>
          <div className="flex justify-between"><span>Job Task Submitted</span><span className="font-semibold text-blue-600">× 2 pts</span></div>
          <div className="flex justify-between"><span>Offer Received</span><span className="font-semibold text-emerald-600">× 5 pts</span></div>
          <div className="flex justify-between"><span>Job Applied Log</span><span className="font-semibold text-green-600">× 1 pt</span></div>
          <div className="flex justify-between"><span>Attendance Rate</span><span className="font-semibold text-slate-600">+ Attendance % / 10</span></div>
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <TooltipProvider>
      <div className="space-y-6 pb-12 animate-in fade-in duration-500">
        
        {/* ─── Header ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2 text-slate-900 dark:text-slate-50">
              <Trophy className="w-6 h-6 text-amber-500" />
              Mentees Leaderboard
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Rankings and metric breakdown of your assigned student roster.
            </p>
          </div>

          <Select value={period} onValueChange={(v) => { setPeriod(v as Period); setStudentPage(1); }}>
            <SelectTrigger className="w-40 h-9 text-xs border-border/60 bg-white dark:bg-slate-900 rounded-xl focus:ring-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border/60 shadow-lg">
              <SelectItem value="weekly" className="rounded-lg text-xs font-semibold">This Week</SelectItem>
              <SelectItem value="monthly" className="rounded-lg text-xs font-semibold">This Month</SelectItem>
              <SelectItem value="all" className="rounded-lg text-xs font-semibold">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ─── KPI Stats ──────────────────────────────────────────────────────── */}
        {isLoadingStudents ? (
          <StatsGridSkeleton />
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Mentees"
              value={stats.total}
              subtitle="Assigned cohort size"
              icon={Users}
              color="indigo"
            />
            <StatsCard
              title="Placement Rate"
              value={`${stats.placementRate}%`}
              subtitle="Out of total roster"
              icon={CheckCircle2}
              color="emerald"
            />
            <StatsCard
              title="Placed Students"
              value={stats.totalHired}
              subtitle="Status equals Hired"
              icon={Award}
              color="amber"
            />
            <StatsCard
              title="Avg Attendance"
              value={`${stats.avgAttendance}%`}
              subtitle="Average attendance rate"
              icon={Activity}
              color="blue"
            />
          </div>
        ) : null}

        {/* ─── Podium Section ─────────────────────────────────────────────────── */}
        {isLoadingStudents ? (
          <Card className="border border-border/50 bg-card/40 p-6 rounded-2xl">
            <PodiumSkeleton />
          </Card>
        ) : studentsList.length >= 3 && (
          <Card className="border border-border/50 bg-card/60 backdrop-blur-xs shadow-xs overflow-hidden rounded-2xl py-6 pr-6">
            <CardHeader className="pt-0 pb-3 flex flex-row items-center justify-between pl-6 border-b border-border/40">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-500 animate-bounce" />
                  Top Student Performers
                </CardTitle>
                <CardDescription className="text-[10px] text-muted-foreground mt-0.5">
                  Top ranking mentees for the {studentData?.period_label ?? 'selected period'}.
                </CardDescription>
              </div>
              <ScoreCalcPopover />
            </CardHeader>
            <CardContent className="pt-6 pb-2 pl-6">
              <div className="flex flex-col sm:flex-row items-end justify-center gap-4 max-w-xl mx-auto pt-6">
                
                {/* Second Place (Silver) */}
                {studentsList[1] && (
                  <div className="flex flex-col items-center gap-2 w-full sm:w-1/3 order-2 sm:order-1 transition-all duration-300 hover:-translate-y-1">
                    <div className="flex flex-col items-center gap-1 bg-white/70 dark:bg-slate-900/60 border border-border/60 shadow-xs px-3.5 py-3 rounded-2xl w-full">
                      <span className="text-xl">🥈</span>
                      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold', getAvatarColor(studentsList[1].name))}>
                        {getInitials(studentsList[1].name)}
                      </div>
                      <p className="text-[11px] font-bold text-center leading-tight truncate w-full mt-1.5">
                        {studentsList[1].name}
                      </p>
                      <Badge className={cn('text-[9px] font-semibold px-1.5 py-0 h-4 border leading-none', STAGE_BADGE[studentsList[1].stage] ?? 'bg-muted text-muted-foreground')}>
                        {studentsList[1].stage.replace('_', ' ')}
                      </Badge>
                      <div className="text-center mt-1 border-t border-border/40 pt-1 w-full flex justify-between items-center text-[10px]">
                        <span className="text-muted-foreground">Score</span>
                        <span className="font-bold text-indigo-600">{studentsList[1].score}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gradient-to-b from-slate-200/90 to-slate-350/90 dark:from-slate-800 dark:to-slate-900 border border-slate-300 dark:border-slate-700 h-14 rounded-t-xl flex items-center justify-center">
                      <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300">#2</span>
                    </div>
                  </div>
                )}

                {/* First Place (Gold) */}
                {studentsList[0] && (
                  <div className="flex flex-col items-center gap-2 w-full sm:w-1/3 order-1 sm:order-2 transition-all duration-300 hover:-translate-y-1.5">
                    <div className="flex flex-col items-center gap-1 bg-amber-50/20 dark:bg-amber-955/10 border border-amber-250/50 shadow-sm px-4 py-4 rounded-2xl w-full relative">
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-white rounded-full p-1 shadow-md">
                        <Trophy className="w-4 h-4" />
                      </div>
                      <span className="text-2xl mt-1">🥇</span>
                      <div className={cn('w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shadow-xs', getAvatarColor(studentsList[0].name))}>
                        {getInitials(studentsList[0].name)}
                      </div>
                      <p className="text-xs font-black text-center leading-tight truncate w-full mt-2">
                        {studentsList[0].name}
                      </p>
                      <Badge className={cn('text-[9px] font-semibold px-2 py-0.5 h-4 border leading-none', STAGE_BADGE[studentsList[0].stage] ?? 'bg-muted text-muted-foreground')}>
                        {studentsList[0].stage.replace('_', ' ')}
                      </Badge>
                      <div className="text-center mt-2 border-t border-amber-200/40 pt-1.5 w-full flex justify-between items-center text-[10px]">
                        <span className="text-muted-foreground">Score</span>
                        <span className="font-extrabold text-indigo-650">{studentsList[0].score}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gradient-to-b from-amber-200 to-amber-350 dark:from-amber-955/40 dark:to-amber-900 border border-amber-300 dark:border-amber-800 h-20 rounded-t-xl flex items-center justify-center">
                      <span className="text-sm font-black text-amber-800 dark:text-amber-350">#1</span>
                    </div>
                  </div>
                )}

                {/* Third Place (Bronze) */}
                {studentsList[2] && (
                  <div className="flex flex-col items-center gap-2 w-full sm:w-1/3 order-3 transition-all duration-300 hover:-translate-y-1">
                    <div className="flex flex-col items-center gap-1 bg-white/70 dark:bg-slate-900/60 border border-border/60 shadow-xs px-3.5 py-3 rounded-2xl w-full">
                      <span className="text-xl">🥉</span>
                      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold', getAvatarColor(studentsList[2].name))}>
                        {getInitials(studentsList[2].name)}
                      </div>
                      <p className="text-[11px] font-bold text-center leading-tight truncate w-full mt-1.5">
                        {studentsList[2].name}
                      </p>
                      <Badge className={cn('text-[9px] font-semibold px-1.5 py-0 h-4 border leading-none', STAGE_BADGE[studentsList[2].stage] ?? 'bg-muted text-muted-foreground')}>
                        {studentsList[2].stage.replace('_', ' ')}
                      </Badge>
                      <div className="text-center mt-1 border-t border-border/40 pt-1 w-full flex justify-between items-center text-[10px]">
                        <span className="text-muted-foreground">Score</span>
                        <span className="font-bold text-indigo-600">{studentsList[2].score}</span>
                      </div>
                    </div>
                    <div className="w-full bg-gradient-to-b from-orange-100/90 to-orange-200/90 dark:from-orange-955/30 dark:to-orange-950/60 border border-orange-200 dark:border-orange-900 h-10 rounded-t-xl flex items-center justify-center">
                      <span className="text-[10px] font-extrabold text-orange-700 dark:text-orange-400">#3</span>
                    </div>
                  </div>
                )}

              </div>
            </CardContent>
          </Card>
        )}

        {/* ─── Detailed List Card ────────────────────────────────────────────── */}
        <Card className="border border-border/50 shadow-sm overflow-hidden rounded-2xl">
          <CardHeader className="pb-3 border-b border-border/40 bg-slate-50/40 dark:bg-slate-900/10 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <GraduationCap className="w-4.5 h-4.5 text-indigo-500" />
                  Assigned Student Performance Rankings
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Full list of cohort students ranked by recent outcomes and participation.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs px-2.5 py-0.5 h-6 self-start sm:self-auto font-bold bg-white dark:bg-slate-950">
                {processedStudents.length} students matching
              </Badge>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-2 mt-4 pt-3 border-t border-border/40">
              <div className="relative col-span-1 sm:col-span-2 lg:col-span-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-8 h-9 text-xs bg-white dark:bg-slate-950 border-border/60 rounded-xl"
                  placeholder="Search students..."
                  value={studentSearch}
                  onChange={e => { setStudentSearch(e.target.value); setStudentPage(1); }}
                  aria-label="Search students"
                />
                {studentSearch && (
                  <button
                    onClick={() => { setStudentSearch(''); setStudentPage(1); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {studentBatches.length > 0 && (
                <Select value={studentBatchFilter} onValueChange={v => { setStudentBatchFilter(v); setStudentPage(1); }}>
                  <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-950 border-border/60 rounded-xl focus:ring-1">
                    <span className="text-slate-500 font-semibold mr-1">Batch:</span>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/60 shadow-lg">
                    <SelectItem value="all" className="rounded-lg text-xs font-semibold">All Batches</SelectItem>
                    {studentBatches.map(b => (
                      <SelectItem key={b} value={b} className="rounded-lg text-xs font-semibold">{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <Select value={studentStageFilter} onValueChange={v => { setStudentStageFilter(v); setStudentPage(1); }}>
                <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-950 border-border/60 rounded-xl focus:ring-1">
                  <span className="text-slate-500 font-semibold mr-1">Stage:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/60 shadow-lg">
                  <SelectItem value="all" className="rounded-lg text-xs font-semibold">All Stages</SelectItem>
                  <SelectItem value="learning" className="rounded-lg text-xs font-semibold">Learning</SelectItem>
                  <SelectItem value="applying" className="rounded-lg text-xs font-semibold">Applying</SelectItem>
                  <SelectItem value="interviewing" className="rounded-lg text-xs font-semibold">Interviewing</SelectItem>
                  <SelectItem value="offer_pending" className="rounded-lg text-xs font-semibold">Offer Pending</SelectItem>
                  <SelectItem value="placed" className="rounded-lg text-xs font-semibold">Placed</SelectItem>
                  <SelectItem value="hired" className="rounded-lg text-xs font-semibold">Hired</SelectItem>
                </SelectContent>
              </Select>

              <Select value={studentTierFilter} onValueChange={v => { setStudentTierFilter(v); setStudentPage(1); }}>
                <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-950 border-border/60 rounded-xl focus:ring-1">
                  <span className="text-slate-500 font-semibold mr-1">Tier:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/60 shadow-lg">
                  <SelectItem value="all" className="rounded-lg text-xs font-semibold">All Tiers</SelectItem>
                  <SelectItem value="Excellent" className="rounded-lg text-xs font-semibold">🌟 Excellent</SelectItem>
                  <SelectItem value="Good" className="rounded-lg text-xs font-semibold">✅ Good</SelectItem>
                  <SelectItem value="Moderate" className="rounded-lg text-xs font-semibold">⚡ Moderate</SelectItem>
                  <SelectItem value="Inactive" className="rounded-lg text-xs font-semibold">😴 Inactive</SelectItem>
                  <SelectItem value="Critical" className="rounded-lg text-xs font-semibold">🚨 Critical</SelectItem>
                </SelectContent>
              </Select>

              <Select value={studentRiskFilter} onValueChange={v => { setStudentRiskFilter(v); setStudentPage(1); }}>
                <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-950 border-border/60 rounded-xl focus:ring-1">
                  <span className="text-slate-500 font-semibold mr-1">Risk:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/60 shadow-lg">
                  <SelectItem value="all" className="rounded-lg text-xs font-semibold">All Risks</SelectItem>
                  <SelectItem value="stable" className="rounded-lg text-xs font-semibold">Stable</SelectItem>
                  <SelectItem value="at_risk" className="rounded-lg text-xs font-semibold">At Risk</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-1.5 col-span-1">
                <Select value={studentSortBy} onValueChange={v => { setStudentSortBy(v as any); setStudentPage(1); }}>
                  <SelectTrigger className="h-9 flex-1 text-xs bg-white dark:bg-slate-950 border-border/60 rounded-xl focus:ring-1">
                    <span className="text-slate-500 font-semibold mr-1">Sort:</span>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/60 shadow-lg">
                    <SelectItem value="rank" className="rounded-lg text-xs font-semibold">Rank Position</SelectItem>
                    <SelectItem value="score" className="rounded-lg text-xs font-semibold">Performance Score</SelectItem>
                    <SelectItem value="attendance_rate" className="rounded-lg text-xs font-semibold">Attendance Rate</SelectItem>
                    <SelectItem value="name" className="rounded-lg text-xs font-semibold">Alphabetical (Name)</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setStudentSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="h-9 w-9 border-border/60 bg-white dark:bg-slate-950 rounded-xl hover:bg-slate-100 shrink-0"
                  aria-label="Toggle sort order"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 dark:bg-slate-900/30">
                    <TableHead className="w-14 pl-5 font-bold text-[10px] uppercase tracking-wider text-slate-450 dark:text-slate-400">#</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-450 dark:text-slate-400">Student Info</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-450 dark:text-slate-400 hidden sm:table-cell">Batch/Cohort</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-450 dark:text-slate-400">Engagement Metrics</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-450 dark:text-slate-400 text-right pr-5">Score</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoadingStudents ? (
                    Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} />)
                  ) : paginatedStudents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-16 text-center">
                        <GraduationCap className="w-8 h-8 mx-auto mb-3 text-muted-foreground/35" />
                        <p className="text-sm font-semibold">No assigned students found</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Adjust filter settings or search terms.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedStudents.map((s) => (
                      <TableRow key={s.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/20 group transition-colors border-b border-border/30">
                        
                        <TableCell className="pl-5">
                          <RankCell rank={s.rank} />
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8.5 w-8.5">
                              <AvatarFallback className={cn('text-xs font-black shadow-xs', getAvatarColor(s.name))}>
                                {getInitials(s.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-foreground leading-tight truncate">
                                  {s.name}
                                </span>
                                {s.hired && (
                                  <Badge className="bg-green-50 text-green-700 border-green-200 text-[9px] px-1.5 py-0 h-4 font-semibold shrink-0">
                                    ✓ Placed
                                  </Badge>
                                )}
                                {s.risk_status === 'at_risk' && (
                                  <Badge className="bg-red-50 text-red-700 border-red-200 text-[9px] px-1.5 py-0 h-4 font-semibold shrink-0 animate-pulse">
                                    ⚠️ At Risk
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {s.project && (
                                  <span className="text-[9px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-150 px-1.5 py-0.5 rounded-full leading-none">
                                    {s.project}
                                  </span>
                                )}
                                <Badge className={cn('text-[9px] px-1.5 py-0 h-4 border font-medium leading-none', STAGE_BADGE[s.stage] ?? 'bg-muted text-muted-foreground border-border')}>
                                  {s.stage.replace('_', ' ')}
                                </Badge>
                                <Tooltip>
                                  <TooltipTrigger className={cn('inline-flex items-center rounded-md border text-[9px] px-1.5 py-0 h-4 font-bold cursor-help leading-none select-none transition-colors bg-transparent border-0 p-0', TIER_BADGE[s.activity_tier])}>
                                    {TIER_EMOJI[s.activity_tier]} {s.activity_tier}
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[200px] text-xs">
                                    <p className="font-semibold">{s.activity_tier} activity</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.activity_description}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-[10px] font-semibold text-slate-500">
                            {s.batch}
                          </Badge>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-3.5">
                            <div className="text-center min-w-[32px]">
                              <p className="text-[11px] font-bold text-indigo-650 dark:text-indigo-400 leading-none">{s.jobs_applied}</p>
                              <p className="text-[8.5px] text-muted-foreground uppercase tracking-wider font-bold mt-0.5">Applied</p>
                            </div>
                            <div className="text-center min-w-[32px]">
                              <p className="text-[11px] font-bold text-blue-650 dark:text-blue-400 leading-none">{s.interviews}</p>
                              <p className="text-[8.5px] text-muted-foreground uppercase tracking-wider font-bold mt-0.5">Ints</p>
                            </div>
                            <div className="text-center min-w-[32px]">
                              <p className="text-[11px] font-bold text-amber-655 dark:text-amber-500 leading-none">{s.tasks}</p>
                              <p className="text-[8.5px] text-muted-foreground uppercase tracking-wider font-bold mt-0.5">Tasks</p>
                            </div>
                            {s.attendance_rate !== null && (
                              <div className="text-center min-w-[32px] hidden lg:block">
                                <p className="text-[11px] font-bold text-slate-750 dark:text-slate-350 leading-none">{s.attendance_rate}%</p>
                                <p className="text-[8.5px] text-muted-foreground uppercase tracking-wider font-bold mt-0.5">Attend</p>
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-right pr-5">
                          <div className="flex flex-col items-end">
                            <span className="text-xs font-black text-foreground tabular-nums leading-none">
                              {s.score}
                            </span>
                            <span className="text-[9px] text-muted-foreground leading-none mt-0.5">
                              score
                            </span>
                          </div>
                        </TableCell>

                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {!isLoadingStudents && totalStudentPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-border/40 bg-slate-50/30 dark:bg-slate-900/10">
                <p className="text-[11px] text-muted-foreground font-semibold order-2 sm:order-1">
                  Showing {((safeStudentPage - 1) * PAGE_SIZE) + 1}–{Math.min(safeStudentPage * PAGE_SIZE, processedStudents.length)} of {processedStudents.length} students
                </p>
                <div className="order-1 sm:order-2">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={e => { e.preventDefault(); if (safeStudentPage > 1) setStudentPage(safeStudentPage - 1); }}
                          className={cn(safeStudentPage <= 1 && 'pointer-events-none opacity-40')}
                          text="Prev"
                        />
                      </PaginationItem>
                      {getPaginationPages(safeStudentPage, totalStudentPages).map((p, idx) => (
                        <PaginationItem key={idx}>
                          {p === 'ellipsis' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              href="#"
                              isActive={p === safeStudentPage}
                              onClick={e => { e.preventDefault(); setStudentPage(p); }}
                            >
                              {p}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={e => { e.preventDefault(); if (safeStudentPage < totalStudentPages) setStudentPage(safeStudentPage + 1); }}
                          className={cn(safeStudentPage >= totalStudentPages && 'pointer-events-none opacity-40')}
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

      </div>
    </TooltipProvider>
  );
}
