'use client';

import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Users, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { getPerformanceTier } from '@/components/analytics/mentor-leaderboard-card';
import { cn } from '@/lib/utils';

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const RANK_ROW: Record<number, string> = {
  1: 'bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-500/5 dark:hover:bg-amber-500/10',
  2: 'bg-slate-50/60 hover:bg-slate-50 dark:bg-slate-500/5 dark:hover:bg-slate-500/10',
  3: 'bg-orange-50/60 hover:bg-orange-50 dark:bg-orange-500/5 dark:hover:bg-orange-500/10',
};
const STAGE_COLORS: Record<string, string> = {
  applying: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/25',
  interviewing: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/25',
  offer_pending: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/25',
  hired: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/25',
};
const TIER_STYLES: Record<string, string> = {
  'Elite': 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/25',
  'Strong': 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/25',
  'Developing': 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/25',
  'Needs Support': 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/25',
};

interface TeamManagementTableProps {
  isLoading: boolean;
  paginated: any[];
  filteredCount: number;
  maxScore: number;
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  periodLabel: string;
}

export function TeamManagementTable({ isLoading, paginated, filteredCount, maxScore, currentPage, totalPages, onPageChange, periodLabel }: TeamManagementTableProps) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 bg-muted/20">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">{periodLabel}</h3>
          </div>
          <Badge variant="outline" className="text-xs font-semibold gap-1.5 px-3 py-1 rounded-full">
            <Users className="w-3.5 h-3.5" /> {filteredCount} mentors
          </Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-12 pl-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">#</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mentor</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Students</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Activity</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right pr-4">Score</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <TableSkeletons /> : paginated.length === 0 ? <TableEmptyState /> : (
              paginated.map(entry => (
                <TeamRow key={entry.mentor_email} entry={entry} maxScore={maxScore} />
              ))
            )}
          </TableBody>
        </Table>
        {!isLoading && totalPages > 1 && (
          <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={filteredCount} pageSize={10} onPageChange={onPageChange} />
        )}
      </div>
    </div>
  );
}

function TeamRow({ entry, maxScore }: { entry: any; maxScore: number }) {
  const tier = getPerformanceTier(entry.score, entry.placement_rate);
  const rowClass = RANK_ROW[entry.rank] ?? (entry.needs_support ? 'bg-red-50/20 hover:bg-red-50/45 dark:bg-red-500/5 dark:hover:bg-red-500/10' : 'hover:bg-muted/30');

  return (
    <TableRow className={cn('group transition-colors border-b border-border/40', rowClass)}>
      <TableCell className="pl-4 w-12"><RankCell rank={entry.rank} /></TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 border border-border/50 shadow-sm"><AvatarFallback className="text-xs font-bold bg-muted text-foreground">{entry.mentor_name.slice(0,2).toUpperCase()}</AvatarFallback></Avatar>
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{entry.mentor_name}</span>
              {entry.needs_support && <Badge className="bg-red-100 text-red-700 border-red-200 text-[9px] px-1.5 py-0 h-4 gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> Needs Support</Badge>}
              {tier === 'Elite' && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[9px] px-1.5 py-0 h-4">✓ Elite</Badge>}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground sm:hidden">{entry.total_students} students</span>
              <ActivityTags entry={entry} />
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground tabular-nums">{entry.total_students}</span>
          <span className="text-[10px] text-muted-foreground">{entry.active} active</span>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-3">
          {[
            { value: `${entry.placement_rate}%`, label: 'Placed', cls: 'text-emerald-600' },
            { value: entry.interviews_this_period, label: 'Interviews', cls: 'text-blue-600' },
            { value: entry.tasks_this_period, label: 'Tasks', cls: 'text-amber-600' },
            { value: entry.offers_this_period, label: 'Offers', cls: 'text-indigo-600' },
          ].map(({ value, label, cls }) => (
            <div key={label} className="flex flex-col items-center gap-0.5 min-w-[40px]">
              <span className={cn('text-sm font-bold tabular-nums', cls)}>{value}</span>
              <span className="text-[10px] text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </TableCell>
      <TableCell className="text-right pr-4">
        <ScoreBar score={entry.score} placementRate={entry.placement_rate} maxScore={maxScore} />
      </TableCell>
    </TableRow>
  );
}

function RankCell({ rank }: { rank: number }) {
  if (rank <= 3) return <div className="flex items-center justify-center w-8 h-8"><span className="text-xl">{MEDAL[rank]}</span></div>;
  return <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted/60 border border-border/20"><span className="text-xs font-bold text-muted-foreground">{rank}</span></div>;
}

function ScoreBar({ score, placementRate, maxScore }: { score: number; placementRate: number; maxScore: number }) {
  const tier = getPerformanceTier(score, placementRate);
  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const colors: Record<string, string> = {
    'Elite': 'bg-emerald-500', 'Strong': 'bg-blue-500', 'Developing': 'bg-amber-500', 'Needs Support': 'bg-red-500',
  };

  return (
    <div className="flex flex-col items-end gap-1.5 min-w-[100px] ml-auto">
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold text-foreground tabular-nums">{score}</span>
        <Badge className={cn('text-[9px] px-1 py-0 h-4 border shadow-none bg-transparent', TIER_STYLES[tier] || '')}>{tier}</Badge>
      </div>
      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden border border-border/10">
        <div className={cn('h-full rounded-full transition-all duration-700', colors[tier] || 'bg-slate-500')} style={{ width: `${Math.min(100, percentage)}%` }} />
      </div>
    </div>
  );
}

function ActivityTags({ entry }: { entry: any }) {
  return (
    <>
      {entry.stage_distribution.applying > 0 && (
        <Tooltip>
          <TooltipTrigger render={<span />} className={cn('text-[10px] px-1.5 py-0.5 rounded-full border cursor-help', STAGE_COLORS.applying)}>
            {entry.stage_distribution.applying} applying
          </TooltipTrigger>
          <TooltipContent className="text-xs">Students actively applying for roles</TooltipContent>
        </Tooltip>
      )}
      {entry.stage_distribution.interviewing > 0 && <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', STAGE_COLORS.interviewing)}>{entry.stage_distribution.interviewing} interviewing</span>}
      {entry.stage_distribution.offer_pending > 0 && <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', STAGE_COLORS.offer_pending)}>{entry.stage_distribution.offer_pending} offer</span>}
      {entry.hired > 0 && <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', STAGE_COLORS.hired)}>{entry.hired} hired</span>}
      {entry.at_risk > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-red-200 bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/25">{entry.at_risk} at risk</span>}
    </>
  );
}

function TableSkeletons() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell className="pl-4"><Skeleton className="w-8 h-8 rounded-full" /></TableCell>
          <TableCell><div className="flex items-center gap-3"><Skeleton className="w-8 h-8 rounded-full" /><div className="space-y-1"><Skeleton className="h-3.5 w-32" /><Skeleton className="h-3 w-48" /></div></div></TableCell>
          <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
          <TableCell><div className="flex gap-3">{[...Array(4)].map((_, j) => <Skeleton key={j} className="h-8 w-10 rounded" />)}</div></TableCell>
          <TableCell className="text-right pr-4"><Skeleton className="h-8 w-20 ml-auto rounded" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

function TableEmptyState() {
  return (
    <TableRow>
      <TableCell colSpan={5} className="py-20 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
            <Users className="w-5 h-5 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-foreground">No mentors found</p>
          <p className="text-xs text-muted-foreground">Adjust filters to broaden the search</p>
        </div>
      </TableCell>
    </TableRow>
  );
}

function TablePagination({ currentPage, totalPages, totalItems, pageSize, onPageChange }: { currentPage: number; totalPages: number; totalItems: number; pageSize: number; onPageChange: (p: number) => void }) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border/40 bg-muted/10">
      <p className="text-xs text-muted-foreground order-2 sm:order-1">
        Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalItems)} of {totalItems} mentors
      </p>
      <div className="order-1 sm:order-2">
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" onClick={e => { e.preventDefault(); if (currentPage > 1) onPageChange(currentPage - 1); }} className={cn(currentPage <= 1 && 'pointer-events-none opacity-40')} text="Prev" />
            </PaginationItem>
            {Array.from({ length: totalPages }).map((_, idx) => (
              <PaginationItem key={idx}>
                <PaginationLink href="#" isActive={idx + 1 === currentPage} onClick={e => { e.preventDefault(); onPageChange(idx + 1); }}>{idx + 1}</PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext href="#" onClick={e => { e.preventDefault(); if (currentPage < totalPages) onPageChange(currentPage + 1); }} className={cn(currentPage >= totalPages && 'pointer-events-none opacity-40')} text="Next" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
