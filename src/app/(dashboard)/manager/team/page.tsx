'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, AlertTriangle } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { TeamKPICards, type TeamSummary } from '@/components/team/team-kpi-cards';
import { TeamManagementTable } from '@/components/team/team-management-table';
import { cn } from '@/lib/utils';

type Period = 'weekly' | 'monthly' | 'all';
const PAGE_SIZE = 10;

export default function ManagerTeamPage() {
  const [period, setPeriod] = useState<Period>('weekly');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [needsSupportFilter, setNeedsSupportFilter] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(val);
      setCurrentPage(1);
    }, 300);
  };

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard', 'mentors', period],
    queryFn: async () => {
      const res = await fetch(`/api/leaderboard?type=mentors&period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch mentor rankings');
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const allEntries = useMemo(() => data?.data ?? [], [data?.data]);

  const summary = useMemo<TeamSummary | null>(() => {
    if (!allEntries.length) return null;
    const needsSupport = allEntries.filter((e: any) => e.needs_support).length;
    const avgPlacement = Math.round(allEntries.reduce((s: number, e: any) => s + e.placement_rate, 0) / allEntries.length);
    const topPerformer = allEntries.reduce((best: any, e: any) => e.score > best.score ? e : best, allEntries[0]);
    return {
      total: allEntries.length,
      active: allEntries.length - needsSupport,
      needsSupport,
      avgPlacement,
      topPerformer: { mentor_name: topPerformer.mentor_name, score: topPerformer.score },
    };
  }, [allEntries]);

  const filtered = useMemo(() => {
    let list = [...allEntries];
    if (needsSupportFilter) list = list.filter(e => e.needs_support);
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(e => e.mentor_name.toLowerCase().includes(q) || e.mentor_email.toLowerCase().includes(q));
    }
    return list;
  }, [allEntries, debouncedSearch, needsSupportFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = useMemo(() => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE), [filtered, safePage]);

  return (
    <TooltipProvider>
      <div className="space-y-6 pb-12 animate-fade-up">
        {summary && <TeamKPICards summary={summary} />}

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input className="pl-8 h-9 text-xs" placeholder="Search mentors…" value={search} onChange={e => handleSearch(e.target.value)} />
            {search && (
              <button onClick={() => handleSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => { setNeedsSupportFilter(v => !v); setCurrentPage(1); }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors h-9',
              needsSupportFilter ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/25' : 'bg-background text-muted-foreground border-border hover:bg-muted',
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Needs Support {needsSupportFilter && summary ? `(${summary.needsSupport})` : ''}
          </button>
          <div className="ml-auto">
            <Select value={period} onValueChange={(v: Period) => { setPeriod(v); setCurrentPage(1); }}>
              <SelectTrigger className="w-36 h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">This Week</SelectItem>
                <SelectItem value="monthly">This Month</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TeamManagementTable
          isLoading={isLoading}
          paginated={paginated}
          filteredCount={filtered.length}
          maxScore={summary?.topPerformer?.score ?? 100}
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          periodLabel={data?.period_label || (period === 'weekly' ? 'Last 7 days' : period === 'monthly' ? 'This Month' : 'All Time')}
        />
      </div>
    </TooltipProvider>
  );
}
