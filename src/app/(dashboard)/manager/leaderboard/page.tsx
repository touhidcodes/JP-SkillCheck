'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Trophy, AlertTriangle, Search, X, Info,
  ArrowUpDown, Users, Award, CheckCircle2, Mail,
  BarChart3, ChevronDown, Calendar, Star
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
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  Pagination, PaginationContent, PaginationEllipsis,
  PaginationItem, PaginationLink, PaginationNext, PaginationPrevious,
} from '@/components/ui/pagination';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { StatsCard } from '@/components/dashboard/stats-card';
import { cn } from '@/lib/utils';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend
} from 'recharts';
import type { ActivityTier } from '@/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'weekly' | 'monthly' | 'all';
type PerformanceTier = 'Elite' | 'Strong' | 'Developing' | 'Needs Support';

interface MentorEntry {
  rank: number;
  mentor_email: string;
  mentor_name: string;
  total_students: number;
  active: number;
  hired: number;
  at_risk: number;
  terminated: number;
  placement_rate: number;
  interviews_this_period: number;
  tasks_this_period: number;
  offers_this_period: number;
  jobs_applied_this_period: number;
  avg_attendance_rate: number;
  tier_counts: Record<ActivityTier, number>;
  stage_distribution: {
    learning: number; applying: number; interviewing: number;
    offer_pending: number; placed: number; hired: number;
  };
  needs_support: boolean;
  score: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;
const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const TIER_STYLES: Record<PerformanceTier, string> = {
  'Elite':         'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-450 dark:border-emerald-900',
  'Strong':        'bg-blue-50    text-blue-700    border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900',
  'Developing':    'bg-amber-50   text-amber-700   border-amber-200 dark:bg-amber-955/25 dark:text-amber-400 dark:border-amber-900',
  'Needs Support': 'bg-red-50     text-red-700     border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900',
};

const TIER_DOT: Record<PerformanceTier, string> = {
  'Elite':         'bg-emerald-500',
  'Strong':        'bg-blue-500',
  'Developing':    'bg-amber-500',
  'Needs Support': 'bg-red-500',
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

function getPerformanceTier(score: number, placementRate: number): PerformanceTier {
  if (score >= 80 && placementRate >= 30) return 'Elite';
  if (score >= 60 && placementRate >= 15) return 'Strong';
  if (score >= 40) return 'Developing';
  return 'Needs Support';
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

export default function ManagerLeaderboardPage() {
  const [period, setPeriod] = useState<Period>('weekly');
  const [showChart, setShowChart] = useState(true);

  // Table filtering, sorting, pagination states
  const [mentorSearch, setMentorSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [supportFilter, setSupportFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'rank' | 'score' | 'placement_rate' | 'avg_attendance_rate' | 'total_students'>('rank');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  // Query for Mentors only
  const { data: mentorData, isLoading: isLoadingMentors } = useQuery({
    queryKey: ['leaderboard', 'mentors', period],
    queryFn: async () => {
      const res = await fetch(`/api/leaderboard?type=mentors&period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch mentor leaderboard');
      return res.json() as Promise<{ data: MentorEntry[]; period_label: string }>;
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const mentorsList = useMemo(() => mentorData?.data ?? [], [mentorData]);

  // KPI Calculations
  const stats = useMemo(() => {
    if (!mentorsList.length) return null;
    const total = mentorsList.length;
    const avgPlacement = Math.round(mentorsList.reduce((s, e) => s + e.placement_rate, 0) / total);
    const topPerformer = mentorsList.reduce((b, e) => e.placement_rate > b.placement_rate ? e : b, mentorsList[0]);
    const needsSupport = mentorsList.filter(e => e.needs_support).length;
    const totalHired = mentorsList.reduce((s, e) => s + e.hired, 0);
    return { avgPlacement, topPerformer, needsSupportCount: needsSupport, totalHired, total };
  }, [mentorsList]);

  // Recharts Chart Data
  const chartData = useMemo(() => {
    return mentorsList.slice(0, 10).map(m => ({
      name: m.mentor_name.split(' ')[0],
      Score: m.score,
      'Placement Rate (%)': m.placement_rate,
      'Attendance Rate (%)': m.avg_attendance_rate,
    }));
  }, [mentorsList]);

  // Processed Mentors
  const processedMentors = useMemo(() => {
    let result = [...mentorsList];

    // Search
    if (mentorSearch.trim()) {
      const q = mentorSearch.toLowerCase();
      result = result.filter(m =>
        m.mentor_name.toLowerCase().includes(q) ||
        m.mentor_email.toLowerCase().includes(q)
      );
    }

    // Tier filter
    if (tierFilter !== 'all') {
      result = result.filter(m => getPerformanceTier(m.score, m.placement_rate) === tierFilter);
    }

    // Support filter
    if (supportFilter !== 'all') {
      const needsSupport = supportFilter === 'needs_support';
      result = result.filter(m => m.needs_support === needsSupport);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'rank') {
        comparison = a.rank - b.rank;
      } else if (sortBy === 'score') {
        comparison = b.score - a.score;
      } else if (sortBy === 'placement_rate') {
        comparison = b.placement_rate - a.placement_rate;
      } else if (sortBy === 'avg_attendance_rate') {
        comparison = b.avg_attendance_rate - a.avg_attendance_rate;
      } else if (sortBy === 'total_students') {
        comparison = b.total_students - a.total_students;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [mentorsList, mentorSearch, tierFilter, supportFilter, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(processedMentors.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginatedMentors = useMemo(() => {
    return processedMentors.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  }, [processedMentors, safePage]);

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

  const ScoreCalcPopover = () => (
    <Popover>
      <PopoverTrigger className="h-4.5 w-4.5 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-muted-foreground transition-colors cursor-help border-0 p-0">
        <Info className="w-3.5 h-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 shadow-xl border border-border/60 bg-background/95 backdrop-blur-md rounded-2xl text-xs space-y-2">
        <p className="font-bold text-foreground flex items-center gap-1.5">
          <Award className="w-4 h-4 text-indigo-500" /> Mentor Score Rubric
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Mentor performance score aggregates student outcomes, participation, and active logs:
        </p>
        <div className="bg-muted/40 p-2.5 rounded-xl border font-mono text-[10px] text-slate-800 dark:text-slate-200 space-y-1">
          <div className="flex justify-between"><span>Jobs Applied</span><span className="font-semibold text-indigo-600">+ 2 pts per student log</span></div>
          <div className="flex justify-between"><span>Interviews Completed</span><span className="font-semibold text-blue-600">+ 4 pts per student log</span></div>
          <div className="flex justify-between"><span>Offers Secured</span><span className="font-semibold text-emerald-600">+ 8 pts per student log</span></div>
          <div className="flex justify-between"><span>Placed/Hired Count</span><span className="font-semibold text-green-600">+ 12 pts per student log</span></div>
          <div className="flex justify-between"><span>Placement Rate %</span><span className="font-semibold text-teal-600">+ 0.5 pts per %</span></div>
          <div className="flex justify-between text-red-600"><span>At-Risk penalty</span><span className="font-semibold">− 5 pts per at-risk student</span></div>
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
              Mentor Performance Leaderboard
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ranked list of program mentors based on outcome rates, student engagement, and support needs.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowChart(p => !p)}
              className="h-9 text-xs border-border/60 rounded-xl"
            >
              <BarChart3 className="w-3.5 h-3.5 mr-1" />
              {showChart ? 'Hide Chart' : 'Show Chart'}
            </Button>

            <Select value={period} onValueChange={(v) => { setPeriod(v as Period); setPage(1); }}>
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
        </div>

        {/* ─── KPI Stats ──────────────────────────────────────────────────────── */}
        {isLoadingMentors ? (
          <StatsGridSkeleton />
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Mentors"
              value={stats.total}
              subtitle="Registered active roster"
              icon={Users}
              color="indigo"
            />
            <StatsCard
              title="Avg Placement Rate"
              value={`${stats.avgPlacement}%`}
              subtitle="Roster average rate"
              icon={CheckCircle2}
              color="emerald"
            />
            <StatsCard
              title="Total Hired"
              value={stats.totalHired}
              subtitle="Across all cohorts"
              icon={Award}
              color="amber"
            />
            <StatsCard
              title="Needs Support"
              value={stats.needsSupportCount}
              subtitle={stats.needsSupportCount > 0 ? 'Intervention recommended' : 'All mentors healthy'}
              icon={AlertTriangle}
              color={stats.needsSupportCount > 0 ? 'red' : 'emerald'}
            />
          </div>
        ) : null}

        {/* ─── Podium Section ─────────────────────────────────────────────────── */}
        {isLoadingMentors ? (
          <Card className="border border-border/50 bg-card/40 p-6 rounded-2xl">
            <PodiumSkeleton />
          </Card>
        ) : mentorsList.length >= 3 && (
          <Card className="border border-border/50 bg-card/60 backdrop-blur-xs shadow-xs overflow-hidden rounded-2xl py-6 pr-6">
            <CardHeader className="pt-0 pb-3 flex flex-row items-center justify-between pl-6 border-b border-border/40">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-500 animate-bounce" />
                  Top Mentor Performers
                </CardTitle>
                <CardDescription className="text-[10px] text-muted-foreground mt-0.5">
                  Top performing mentors ranked by student outcomes and participation scores.
                </CardDescription>
              </div>
              <ScoreCalcPopover />
            </CardHeader>
            <CardContent className="pt-6 pb-2 pl-6">
              <div className="flex flex-col sm:flex-row items-end justify-center gap-4 max-w-xl mx-auto pt-6">
                
                {/* Second Place (Silver) */}
                {mentorsList[1] && (
                  <div className="flex flex-col items-center gap-2 w-full sm:w-1/3 order-2 sm:order-1 transition-all duration-300 hover:-translate-y-1">
                    <div className="flex flex-col items-center gap-1 bg-white/70 dark:bg-slate-900/60 border border-border/60 shadow-xs px-3.5 py-3 rounded-2xl w-full">
                      <span className="text-xl">🥈</span>
                      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold', getAvatarColor(mentorsList[1].mentor_name))}>
                        {getInitials(mentorsList[1].mentor_name)}
                      </div>
                      <p className="text-[11px] font-bold text-center leading-tight truncate w-full mt-1.5">
                        {mentorsList[1].mentor_name}
                      </p>
                      <Badge className={cn('text-[9px] font-semibold px-1.5 py-0 h-4 border leading-none', TIER_STYLES[getPerformanceTier(mentorsList[1].score, mentorsList[1].placement_rate)])}>
                        {getPerformanceTier(mentorsList[1].score, mentorsList[1].placement_rate)}
                      </Badge>
                      <div className="text-center mt-1 border-t border-border/40 pt-1 w-full flex justify-between items-center text-[10px]">
                        <span className="text-muted-foreground">Placement</span>
                        <span className="font-bold text-emerald-600">{mentorsList[1].placement_rate}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-gradient-to-b from-slate-200/90 to-slate-350/90 dark:from-slate-800 dark:to-slate-900 border border-slate-300 dark:border-slate-700 h-14 rounded-t-xl flex items-center justify-center">
                      <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300">#2</span>
                    </div>
                  </div>
                )}

                {/* First Place (Gold) */}
                {mentorsList[0] && (
                  <div className="flex flex-col items-center gap-2 w-full sm:w-1/3 order-1 sm:order-2 transition-all duration-300 hover:-translate-y-1.5">
                    <div className="flex flex-col items-center gap-1 bg-amber-50/20 dark:bg-amber-955/10 border border-amber-250/50 shadow-sm px-4 py-4 rounded-2xl w-full relative">
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-white rounded-full p-1 shadow-md">
                        <Trophy className="w-4 h-4" />
                      </div>
                      <span className="text-2xl mt-1">🥇</span>
                      <div className={cn('w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shadow-xs', getAvatarColor(mentorsList[0].mentor_name))}>
                        {getInitials(mentorsList[0].mentor_name)}
                      </div>
                      <p className="text-xs font-black text-center leading-tight truncate w-full mt-2">
                        {mentorsList[0].mentor_name}
                      </p>
                      <Badge className={cn('text-[9px] font-semibold px-2 py-0.5 h-4 border leading-none', TIER_STYLES[getPerformanceTier(mentorsList[0].score, mentorsList[0].placement_rate)])}>
                        {getPerformanceTier(mentorsList[0].score, mentorsList[0].placement_rate)}
                      </Badge>
                      <div className="text-center mt-2 border-t border-amber-200/40 pt-1.5 w-full flex justify-between items-center text-[10px]">
                        <span className="text-muted-foreground">Placement</span>
                        <span className="font-extrabold text-emerald-600">{mentorsList[0].placement_rate}%</span>
                      </div>
                    </div>
                    <div className="w-full bg-gradient-to-b from-amber-200 to-amber-350 dark:from-amber-955/40 dark:to-amber-900 border border-amber-300 dark:border-amber-800 h-20 rounded-t-xl flex items-center justify-center">
                      <span className="text-sm font-black text-amber-800 dark:text-amber-350">#1</span>
                    </div>
                  </div>
                )}

                {/* Third Place (Bronze) */}
                {mentorsList[2] && (
                  <div className="flex flex-col items-center gap-2 w-full sm:w-1/3 order-3 transition-all duration-300 hover:-translate-y-1">
                    <div className="flex flex-col items-center gap-1 bg-white/70 dark:bg-slate-900/60 border border-border/60 shadow-xs px-3.5 py-3 rounded-2xl w-full">
                      <span className="text-xl">🥉</span>
                      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold', getAvatarColor(mentorsList[2].mentor_name))}>
                        {getInitials(mentorsList[2].mentor_name)}
                      </div>
                      <p className="text-[11px] font-bold text-center leading-tight truncate w-full mt-1.5">
                        {mentorsList[2].mentor_name}
                      </p>
                      <Badge className={cn('text-[9px] font-semibold px-1.5 py-0 h-4 border leading-none', TIER_STYLES[getPerformanceTier(mentorsList[2].score, mentorsList[2].placement_rate)])}>
                        {getPerformanceTier(mentorsList[2].score, mentorsList[2].placement_rate)}
                      </Badge>
                      <div className="text-center mt-1 border-t border-border/40 pt-1 w-full flex justify-between items-center text-[10px]">
                        <span className="text-muted-foreground">Placement</span>
                        <span className="font-bold text-emerald-600">{mentorsList[2].placement_rate}%</span>
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

        {/* ─── Recharts Visualization ────────────────────────────────────────── */}
        {!isLoadingMentors && showChart && chartData.length > 0 && (
          <Card className="border border-border/50 shadow-sm overflow-hidden rounded-2xl">
            <CardHeader className="pb-3 border-b border-border/40 bg-slate-50/40 dark:bg-slate-900/10 p-5">
              <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                <BarChart3 className="w-4.5 h-4.5 text-indigo-500" />
                Top Mentors Comparison
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Outcome and Score correlation for the top 10 mentors.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/40" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} className="text-[10px] text-muted-foreground font-semibold" />
                    <YAxis tickLine={false} axisLine={false} className="text-[10px] text-muted-foreground font-semibold" />
                    <RechartsTooltip
                      contentStyle={{
                        background: 'rgba(255, 255, 255, 0.95)',
                        border: '1px solid rgba(226, 232, 240, 0.8)',
                        borderRadius: '12px',
                        fontSize: '11px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                      labelClassName="font-bold text-foreground"
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 600, paddingTop: '10px' }} />
                    <Bar dataKey="Score" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={30} name="Scoring Index" />
                    <Bar dataKey="Placement Rate (%)" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
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
                  <Star className="w-4.5 h-4.5 text-indigo-500" />
                  Mentor Performance Rankings
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Full list of mentors sorted by performance indices.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs px-2.5 py-0.5 h-6 self-start sm:self-auto font-bold bg-white dark:bg-slate-950">
                {processedMentors.length} mentors matching
              </Badge>
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 mt-4 pt-3 border-t border-border/40">
              <div className="relative col-span-1 sm:col-span-2">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  className="pl-8 h-9 text-xs bg-white dark:bg-slate-950 border-border/60 rounded-xl"
                  placeholder="Search mentors..."
                  value={mentorSearch}
                  onChange={e => { setMentorSearch(e.target.value); setPage(1); }}
                  aria-label="Search mentors"
                />
                {mentorSearch && (
                  <button
                    onClick={() => { setMentorSearch(''); setPage(1); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <Select value={tierFilter} onValueChange={v => { setTierFilter(v); setPage(1); }}>
                <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-950 border-border/60 rounded-xl focus:ring-1">
                  <span className="text-slate-500 font-semibold mr-1">Tier:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/60 shadow-lg">
                  <SelectItem value="all" className="rounded-lg text-xs font-semibold">All Tiers</SelectItem>
                  <SelectItem value="Elite" className="rounded-lg text-xs font-semibold">🌟 Elite</SelectItem>
                  <SelectItem value="Strong" className="rounded-lg text-xs font-semibold">✅ Strong</SelectItem>
                  <SelectItem value="Developing" className="rounded-lg text-xs font-semibold">⚡ Developing</SelectItem>
                  <SelectItem value="Needs Support" className="rounded-lg text-xs font-semibold">🚨 Needs Support</SelectItem>
                </SelectContent>
              </Select>

              <Select value={supportFilter} onValueChange={v => { setSupportFilter(v); setPage(1); }}>
                <SelectTrigger className="h-9 text-xs bg-white dark:bg-slate-950 border-border/60 rounded-xl focus:ring-1">
                  <span className="text-slate-500 font-semibold mr-1">Support:</span>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/60 shadow-lg">
                  <SelectItem value="all" className="rounded-lg text-xs font-semibold">All Statuses</SelectItem>
                  <SelectItem value="needs_support" className="rounded-lg text-xs font-semibold">🚨 Needs Support</SelectItem>
                  <SelectItem value="healthy" className="rounded-lg text-xs font-semibold">✓ Healthy</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-1.5 col-span-1">
                <Select value={sortBy} onValueChange={v => { setSortBy(v as any); setPage(1); }}>
                  <SelectTrigger className="h-9 flex-1 text-xs bg-white dark:bg-slate-950 border-border/60 rounded-xl focus:ring-1">
                    <span className="text-slate-500 font-semibold mr-1">Sort:</span>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/60 shadow-lg">
                    <SelectItem value="rank" className="rounded-lg text-xs font-semibold">Rank Position</SelectItem>
                    <SelectItem value="score" className="rounded-lg text-xs font-semibold">Composite Score</SelectItem>
                    <SelectItem value="placement_rate" className="rounded-lg text-xs font-semibold">Placement Rate</SelectItem>
                    <SelectItem value="avg_attendance_rate" className="rounded-lg text-xs font-semibold">Attendance Rate</SelectItem>
                    <SelectItem value="total_students" className="rounded-lg text-xs font-semibold">Mentees Count</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
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
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-450 dark:text-slate-400">Mentor Info</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-450 dark:text-slate-400">Cohort Outcomes</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-450 dark:text-slate-400">Activity Levels</TableHead>
                    <TableHead className="font-bold text-[10px] uppercase tracking-wider text-slate-450 dark:text-slate-400 text-right pr-5">Score</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isLoadingMentors ? (
                    Array.from({ length: 5 }).map((_, i) => <TableRowSkeleton key={i} />)
                  ) : paginatedMentors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-16 text-center">
                        <Trophy className="w-8 h-8 mx-auto mb-3 text-muted-foreground/35" />
                        <p className="text-sm font-semibold">No mentors found</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Adjust filter settings or search terms.</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedMentors.map((m) => {
                      const tier = getPerformanceTier(m.score, m.placement_rate);
                      return (
                        <TableRow key={m.mentor_email} className="hover:bg-slate-50/40 dark:hover:bg-slate-900/20 group transition-colors border-b border-border/30">
                          
                          <TableCell className="pl-5">
                            <RankCell rank={m.rank} />
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8.5 w-8.5">
                                <AvatarFallback className={cn('text-xs font-black shadow-xs', getAvatarColor(m.mentor_name))}>
                                  {getInitials(m.mentor_name)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-foreground leading-tight truncate">
                                    {m.mentor_name}
                                  </span>
                                  <Badge className={cn('text-[9px] font-semibold px-1.5 py-0 h-4 border leading-none', TIER_STYLES[tier])}>
                                    <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle', TIER_DOT[tier])} />
                                    {tier}
                                  </Badge>
                                  {m.needs_support && (
                                    <Badge className="bg-red-50 text-red-700 border-red-200 text-[9px] px-1.5 py-0 h-4 font-semibold shrink-0 animate-pulse">
                                      ⚠️ Support
                                    </Badge>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground truncate block mt-0.5">{m.mentor_email}</span>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex flex-col gap-1 w-28">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-muted-foreground font-semibold">Placement Rate</span>
                                <span className="font-extrabold text-emerald-600 tabular-nums">{m.placement_rate}%</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                  style={{ width: `${m.placement_rate}%` }}
                                />
                              </div>
                              <div className="flex items-center justify-between text-[9px] text-muted-foreground mt-0.5">
                                <span>{m.total_students} mentees</span>
                                <span>{m.hired} hired</span>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="flex items-center gap-4">
                              <div className="text-center min-w-[32px]">
                                <p className="text-[11px] font-bold text-indigo-650 dark:text-indigo-400 leading-none">{m.jobs_applied_this_period}</p>
                                <p className="text-[8.5px] text-muted-foreground uppercase tracking-wider font-bold mt-0.5">Applied</p>
                              </div>
                              <div className="text-center min-w-[32px]">
                                <p className="text-[11px] font-bold text-blue-650 dark:text-blue-400 leading-none">{m.interviews_this_period}</p>
                                <p className="text-[8.5px] text-muted-foreground uppercase tracking-wider font-bold mt-0.5">Ints</p>
                              </div>
                              <div className="text-center min-w-[32px]">
                                <p className="text-[11px] font-bold text-emerald-655 dark:text-emerald-500 leading-none">{m.offers_this_period}</p>
                                <p className="text-[8.5px] text-muted-foreground uppercase tracking-wider font-bold mt-0.5">Offers</p>
                              </div>
                              <div className="text-center min-w-[32px]">
                                <p className="text-[11px] font-bold text-slate-750 dark:text-slate-350 leading-none">{m.avg_attendance_rate}%</p>
                                <p className="text-[8.5px] text-muted-foreground uppercase tracking-wider font-bold mt-0.5">Attend</p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="text-right pr-5">
                            <div className="flex items-center justify-end gap-2.5">
                              <div className="flex flex-col items-end">
                                <span className="text-xs font-black text-foreground tabular-nums leading-none">
                                  {m.score}
                                </span>
                                <span className="text-[9px] text-muted-foreground leading-none mt-0.5">
                  score
                                </span>
                              </div>

                              <DropdownMenu>
                                <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-muted-foreground p-0 border-0 bg-transparent cursor-pointer">
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-xl border-border/60 shadow-lg">
                                  <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Actions</DropdownMenuLabel>
                                  <DropdownMenuItem className="rounded-lg text-xs" onClick={() => window.open(`mailto:${m.mentor_email}`)}>
                                    <Mail className="w-3.5 h-3.5 mr-2 text-indigo-500" />
                                    Email Mentor
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <Popover>
                                    <PopoverTrigger className="w-full text-left rounded-lg text-xs flex items-center px-2 py-1.5 hover:bg-muted font-medium transition-colors border-0">
                                      <Users className="w-3.5 h-3.5 mr-2 text-blue-500" />
                                      Stage Breakdown
                                    </PopoverTrigger>
                                    <PopoverContent side="left" className="w-64 p-4 shadow-xl border border-border/60 bg-background/95 backdrop-blur-md rounded-2xl text-xs space-y-2">
                                      <p className="font-bold text-foreground">Roster Stage Distribution</p>
                                      <div className="space-y-1 mt-1.5">
                                        <div className="flex justify-between"><span>Learning</span><span className="font-bold text-slate-600">{m.stage_distribution.learning}</span></div>
                                        <div className="flex justify-between"><span>Applying</span><span className="font-bold text-blue-600">{m.stage_distribution.applying}</span></div>
                                        <div className="flex justify-between"><span>Interviewing</span><span className="font-bold text-amber-600">{m.stage_distribution.interviewing}</span></div>
                                        <div className="flex justify-between"><span>Offer Pending</span><span className="font-bold text-orange-600">{m.stage_distribution.offer_pending}</span></div>
                                        <div className="flex justify-between"><span>Placed/Hired</span><span className="font-bold text-emerald-600">{m.stage_distribution.placed + m.stage_distribution.hired}</span></div>
                                      </div>
                                    </PopoverContent>
                                  </Popover>
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

            {/* Pagination */}
            {!isLoadingMentors && totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-border/40 bg-slate-50/30 dark:bg-slate-900/10">
                <p className="text-[11px] text-muted-foreground font-semibold order-2 sm:order-1">
                  Showing {((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, processedMentors.length)} of {processedMentors.length} mentors
                </p>
                <div className="order-1 sm:order-2">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={e => { e.preventDefault(); if (safePage > 1) setPage(safePage - 1); }}
                          className={cn(safePage <= 1 && 'pointer-events-none opacity-40')}
                          text="Prev"
                        />
                      </PaginationItem>
                      {getPaginationPages(safePage, totalPages).map((p, idx) => (
                        <PaginationItem key={idx}>
                          {p === 'ellipsis' ? (
                            <PaginationEllipsis />
                          ) : (
                            <PaginationLink
                              href="#"
                              isActive={p === safePage}
                              onClick={e => { e.preventDefault(); setPage(p); }}
                            >
                              {p}
                            </PaginationLink>
                          )}
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={e => { e.preventDefault(); if (safePage < totalPages) setPage(safePage + 1); }}
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

      </div>
    </TooltipProvider>
  );
}
