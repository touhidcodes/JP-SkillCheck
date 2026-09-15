'use client';

import React, { useState, useMemo } from 'react';
import {
  Search, ArrowUpDown, ChevronLeft, ChevronRight, Download, Filter, AlertCircle
} from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { MentorEntry, CohortEntry } from '@/lib/analytics/engine';
import { getPerformanceTier, TIER_STYLES, TIER_DOT } from '@/components/analytics/mentor-leaderboard-card';

interface DetailedAnalyticsTableProps {
  mentors: MentorEntry[];
  cohorts: CohortEntry[];
}

type TabType = 'mentors' | 'cohorts';

export function DetailedAnalyticsTable({ mentors, cohorts }: DetailedAnalyticsTableProps) {
  const [activeTab, setActiveTab] = useState<TabType>('mentors');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sorting state
  const [sortField, setSortField] = useState<string>('name');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  
  // Pagination state
  const [pageSize, setPageSize] = useState<number>(5);
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  // Tier filter state
  const [tierFilter, setTierFilter] = useState<string>('all');

  // Reset page and sorting when switching tabs
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchQuery('');
    setSortField(tab === 'mentors' ? 'name' : 'batch');
    setSortAsc(true);
    setCurrentPage(1);
    setTierFilter('all');
  };

  // Toggle sorting directions
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
    setCurrentPage(1);
  };

  // Perform filtering, searching, and sorting
  const processedData = useMemo(() => {
    if (activeTab === 'mentors') {
      let result = mentors.map((m) => {
        const placementRate = m.totalMentees > 0 ? Math.round((m.hired / m.totalMentees) * 100) : 0;
        // Calculate a score comparable to the leaderboard endpoint logic
        const score = Math.round(m.activityScore * 0.4 + placementRate * 0.6);
        const tier = getPerformanceTier(score, placementRate);
        return { ...m, placementRate, score, tier };
      });

      // Filter by Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        result = result.filter(
          m => m.name.toLowerCase().includes(query) || m.email.toLowerCase().includes(query)
        );
      }

      // Filter by Performance Tier
      if (tierFilter !== 'all') {
        result = result.filter(m => m.tier === tierFilter);
      }

      // Sort
      result.sort((a, b) => {
        const valA = a[sortField as keyof typeof a];
        const valB = b[sortField as keyof typeof b];

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        
        const numA = Number(valA || 0);
        const numB = Number(valB || 0);
        return sortAsc ? numA - numB : numB - numA;
      });

      return result;
    } else {
      let result = [...cohorts];

      // Filter by Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        result = result.filter(c => c.batch.toLowerCase().includes(query));
      }

      // Sort
      result.sort((a, b) => {
        const valA = a[sortField as keyof typeof a];
        const valB = b[sortField as keyof typeof b];

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        const numA = Number(valA || 0);
        const numB = Number(valB || 0);
        return sortAsc ? numA - numB : numB - numA;
      });

      return result;
    }
  }, [activeTab, mentors, cohorts, searchQuery, sortField, sortAsc, tierFilter]);

  // Paginated View
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [processedData, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(processedData.length / pageSize));

  // Export to CSV
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];

    if (activeTab === 'mentors') {
      headers = ['Name', 'Email', 'Total Students', 'Active Students', 'Hired', 'Placed', 'At Risk', 'Placement Rate', 'Activity Score', 'Performance Tier'];
      rows = (processedData as (MentorEntry & { placementRate: number; score: number; tier: string })[]).map(m => [
        m.name, m.email, String(m.totalMentees), String(m.activeMentees), String(m.hired), String(m.placed), String(m.atRisk), `${m.placementRate}%`, String(m.activityScore), m.tier
      ]);
    } else {
      headers = ['Cohort Batch', 'Total Students', 'Active Students', 'Hired Students', 'Placement Rate', 'Hire Rate', 'Learning', 'Applying', 'Interviewing', 'Offer Pending'];
      rows = (processedData as CohortEntry[]).map(c => [
        c.batch, String(c.total), String(c.active), String(c.hired), `${c.placementRate}%`, `${c.hireRate}%`, String(c.learning), String(c.applying), String(c.interviewing), String(c.offer_pending)
      ]);
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${val.replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `detailed_program_${activeTab}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
      {/* Header controls & tabs switcher */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between border-b border-border/50 p-5 gap-4">
        {/* Switch tabs */}
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl shrink-0 self-start">
          <button
            onClick={() => handleTabChange('mentors')}
            className={cn(
              'px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all',
              activeTab === 'mentors'
                ? 'bg-white dark:bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Mentors Efficiency
          </button>
          <button
            onClick={() => handleTabChange('cohorts')}
            className={cn(
              'px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all',
              activeTab === 'cohorts'
                ? 'bg-white dark:bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Cohort batches
          </button>
        </div>

        {/* Global Search and Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative w-full max-w-[220px]">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input
              placeholder={activeTab === 'mentors' ? 'Search mentors…' : 'Search cohorts…'}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 h-8.5 text-xs rounded-xl border-border/50 w-full"
            />
          </div>

          {activeTab === 'mentors' && (
            <Select value={tierFilter} onValueChange={(val) => {
              setTierFilter(val);
              setCurrentPage(1);
            }}>
              <SelectTrigger className="h-8.5 w-36 text-xs border-border/50 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3 h-3 text-muted-foreground/60" />
                  <SelectValue placeholder="All Tiers" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/60">
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="Elite">Elite</SelectItem>
                <SelectItem value="Strong">Strong</SelectItem>
                <SelectItem value="Developing">Developing</SelectItem>
                <SelectItem value="Needs Support">Needs Support</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            className="h-8.5 text-xs border-border/60 hover:bg-muted/40 rounded-xl font-semibold gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            CSV Export
          </Button>
        </div>
      </div>

      {/* Main Table viewport */}
      <div className="overflow-x-auto min-h-[300px]">
        {activeTab === 'mentors' ? (
          <Table className="whitespace-nowrap">
            <TableHeader className="bg-muted/30 border-b border-border/40">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 text-center text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider">Rank</TableHead>
                <TableHead onClick={() => handleSort('name')} className="cursor-pointer select-none text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider">
                  <div className="flex items-center gap-1 hover:text-foreground transition-colors">
                    Mentor name <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead onClick={() => handleSort('totalMentees')} className="cursor-pointer select-none text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider text-right">
                  <div className="flex items-center justify-end gap-1 hover:text-foreground transition-colors">
                    Mentees <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead onClick={() => handleSort('hired')} className="cursor-pointer select-none text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider text-right">
                  <div className="flex items-center justify-end gap-1 hover:text-foreground transition-colors">
                    Hired <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead onClick={() => handleSort('atRisk')} className="cursor-pointer select-none text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider text-right">
                  <div className="flex items-center justify-end gap-1 hover:text-foreground transition-colors">
                    At Risk <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead onClick={() => handleSort('placementRate')} className="cursor-pointer select-none text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider text-right">
                  <div className="flex items-center justify-end gap-1 hover:text-foreground transition-colors">
                    Placed % <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead onClick={() => handleSort('activityScore')} className="cursor-pointer select-none text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider text-right">
                  <div className="flex items-center justify-end gap-1 hover:text-foreground transition-colors">
                    Activity <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider text-center">Performance Tier</TableHead>
                <TableHead className="text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider text-center">Action Guide</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? (
                (paginatedData as (MentorEntry & { placementRate: number; score: number; tier: string })[]).map((mentor, idx) => {
                  const rank = (currentPage - 1) * pageSize + idx + 1;
                  
                  // Strategic action determinations
                  let actionText = 'Normal monitoring';
                  let actionColor = 'text-muted-foreground bg-muted/40';
                  let showWarningIcon = false;

                  if (mentor.atRisk >= 4 || (mentor.totalMentees > 0 && (mentor.atRisk / mentor.totalMentees) >= 0.25)) {
                    actionText = 'Schedule Risk Audit';
                    actionColor = 'text-red-700 bg-red-500/10 border-red-500/25';
                    showWarningIcon = true;
                  } else if (mentor.activityScore < 55) {
                    actionText = 'Engagement Check-In';
                    actionColor = 'text-amber-700 bg-amber-500/10 border-amber-500/25';
                    showWarningIcon = true;
                  } else if (mentor.tier === 'Elite') {
                    actionText = 'Excellent performance';
                    actionColor = 'text-emerald-700 bg-emerald-500/10 border-emerald-500/25';
                  }

                  return (
                    <TableRow key={mentor.email} className="hover:bg-muted/15 transition-colors">
                      <TableCell className="text-center font-bold text-muted-foreground text-xs">{rank}</TableCell>
                      <TableCell className="font-semibold">
                        <div>
                          <p className="text-sm text-foreground">{mentor.name}</p>
                          <p className="text-[10px] text-muted-foreground font-normal mt-0.5">{mentor.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-xs tabular-nums">{mentor.totalMentees} total</TableCell>
                      <TableCell className="text-right font-medium text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">{mentor.hired}</TableCell>
                      <TableCell className={cn('text-right font-medium text-xs tabular-nums', mentor.atRisk > 0 ? 'text-red-500 font-bold' : 'text-muted-foreground')}>{mentor.atRisk}</TableCell>
                      <TableCell className="text-right font-bold text-xs text-foreground tabular-nums">{mentor.placementRate}%</TableCell>
                      <TableCell className="text-right font-bold text-xs text-indigo-600 dark:text-indigo-400 tabular-nums">{mentor.activityScore}</TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border leading-normal scale-90',
                          TIER_STYLES[mentor.tier as keyof typeof TIER_STYLES]
                        )}>
                          <span className={cn('w-1 h-1 rounded-full', TIER_DOT[mentor.tier as keyof typeof TIER_DOT])} />
                          {mentor.tier}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn(
                          'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md border leading-normal scale-90 select-none',
                          actionColor
                        )}>
                          {showWarningIcon && <AlertCircle className="w-3 h-3 text-current shrink-0" />}
                          {actionText}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                    No matching mentor efficiency records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        ) : (
          <Table className="whitespace-nowrap">
            <TableHeader className="bg-muted/30 border-b border-border/40">
              <TableRow className="hover:bg-transparent">
                <TableHead onClick={() => handleSort('batch')} className="cursor-pointer select-none text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider">
                  <div className="flex items-center gap-1 hover:text-foreground transition-colors">
                    Cohort batch <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead onClick={() => handleSort('total')} className="cursor-pointer select-none text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider text-right">
                  <div className="flex items-center justify-end gap-1 hover:text-foreground transition-colors">
                    Total students <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead onClick={() => handleSort('active')} className="cursor-pointer select-none text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider text-right">
                  <div className="flex items-center justify-end gap-1 hover:text-foreground transition-colors">
                    Active pipeline <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead onClick={() => handleSort('hired')} className="cursor-pointer select-none text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider text-right">
                  <div className="flex items-center justify-end gap-1 hover:text-foreground transition-colors">
                    Hired students <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead onClick={() => handleSort('placementRate')} className="cursor-pointer select-none text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider text-right">
                  <div className="flex items-center justify-end gap-1 hover:text-foreground transition-colors">
                    Placement rate <ArrowUpDown className="w-3 h-3" />
                  </div>
                </TableHead>
                <TableHead className="text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider text-right">Learning</TableHead>
                <TableHead className="text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider text-right">Applying</TableHead>
                <TableHead className="text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider text-right">Interviewing</TableHead>
                <TableHead className="text-[10px] font-bold text-muted-foreground/75 uppercase tracking-wider text-right">Offer Pending</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? (
                (paginatedData as CohortEntry[]).map((cohort) => (
                  <TableRow key={cohort.batch} className="hover:bg-muted/15 transition-colors">
                    <TableCell className="font-semibold text-sm text-foreground">{cohort.batch}</TableCell>
                    <TableCell className="text-right font-medium text-xs tabular-nums">{cohort.total}</TableCell>
                    <TableCell className="text-right font-medium text-xs text-indigo-600 dark:text-indigo-400 tabular-nums">{cohort.active}</TableCell>
                    <TableCell className="text-right font-medium text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">{cohort.hired}</TableCell>
                    <TableCell className="text-right font-bold text-xs text-foreground tabular-nums">
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-black',
                        cohort.placementRate >= 40 ? 'text-emerald-600 bg-emerald-500/10' :
                        cohort.placementRate >= 20 ? 'text-amber-600 bg-amber-500/10' : 'text-red-500 bg-red-500/10'
                      )}>
                        {cohort.placementRate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground/80 tabular-nums">{cohort.learning}</TableCell>
                    <TableCell className="text-right text-xs text-blue-600 dark:text-blue-400 tabular-nums">{cohort.applying}</TableCell>
                    <TableCell className="text-right text-xs text-violet-600 dark:text-violet-400 tabular-nums">{cohort.interviewing}</TableCell>
                    <TableCell className="text-right text-xs text-amber-600 dark:text-amber-400 tabular-nums">{cohort.offer_pending}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                    No matching cohort records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modern pagination footer layout */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border/50 p-4 gap-3 bg-muted/10">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Show</span>
          <Select
            value={String(pageSize)}
            onValueChange={(val) => {
              setPageSize(Number(val));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-7.5 w-18 text-[11px] border-border/50 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-lg border-border/60">
              <SelectItem value="5">5</SelectItem>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
            </SelectContent>
          </Select>
          <span>records per page · {processedData.length} records total</span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="h-8 w-8 p-0 border-border/65 rounded-lg disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs font-bold text-foreground px-2">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="h-8 w-8 p-0 border-border/65 rounded-lg disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
