'use client';

import { useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PROJECT_NAMES } from '@/types';
import { X } from 'lucide-react';

export interface FilterState {
  search?: string;
  project?: string;
  stage?: string;
  risk_status?: string;
  job_focus?: string;
  terminated?: string;
  hired?: string;
  experience?: string;
  batch?: string;
}

interface StudentFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

const BATCH_OPTIONS = [
  'batch-2024-Q1',
  'batch-2024-Q2',
  'batch-2024-Q3',
  'batch-2024-Q4',
  'batch-2025-Q1',
  'batch-2025-Q2',
  'batch-2025-Q3',
  'batch-2025-Q4',
];

export function StudentFilters({ filters, onChange }: StudentFiltersProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  // Sync input value when filters.search changes externally (e.g., Clear button)
  useEffect(() => {
    if (searchRef.current && !filters.search) {
      searchRef.current.value = '';
    }
  }, [filters.search]);

  const updateFilter = (key: keyof FilterState, value: string | undefined) => {
    const newFilters = { ...filters };
    if (value) {
      newFilters[key] = value;
    } else {
      delete newFilters[key];
    }
    onChange(newFilters);
  };

  const clearAll = () => {
    if (searchRef.current) searchRef.current.value = '';
    onChange({});
  };

  const hasFilters = Object.keys(filters).length > 0;

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Name search */}
      <div className="flex-1 min-w-[180px]">
        <Input
          ref={searchRef}
          placeholder="Search by name..."
          defaultValue={filters.search ?? ''}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const val = (e.target as HTMLInputElement).value.trim();
              updateFilter('search', val || undefined);
            }
          }}
          onChange={(e) => {
            // Clear filter immediately when input is emptied
            if (e.target.value === '') {
              updateFilter('search', undefined);
            }
          }}
        />
      </div>

      {/* Project */}
      <Select
        value={filters.project ?? undefined}
        onValueChange={(v) => updateFilter('project', v === '__clear__' ? undefined : v)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Project" />
        </SelectTrigger>
        <SelectContent>
          {filters.project && <SelectItem value="__clear__">All Projects</SelectItem>}
          {PROJECT_NAMES.map((p) => (
            <SelectItem key={p} value={p}>{p}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Stage */}
      <Select
        value={filters.stage ?? undefined}
        onValueChange={(v) => updateFilter('stage', v === '__clear__' ? undefined : v)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Stage" />
        </SelectTrigger>
        <SelectContent>
          {filters.stage && <SelectItem value="__clear__">All Stages</SelectItem>}
          <SelectItem value="learning">Learning</SelectItem>
          <SelectItem value="applying">Applying</SelectItem>
          <SelectItem value="interviewing">Interviewing</SelectItem>
          <SelectItem value="offer_pending">Offer Pending</SelectItem>
          <SelectItem value="placed">Placed</SelectItem>
          <SelectItem value="hired">Hired</SelectItem>
        </SelectContent>
      </Select>

      {/* Risk */}
      <Select
        value={filters.risk_status ?? undefined}
        onValueChange={(v) => updateFilter('risk_status', v === '__clear__' ? undefined : v)}
      >
        <SelectTrigger className="w-[110px]">
          <SelectValue placeholder="Risk" />
        </SelectTrigger>
        <SelectContent>
          {filters.risk_status && <SelectItem value="__clear__">All Risk</SelectItem>}
          <SelectItem value="safe">Safe</SelectItem>
          <SelectItem value="at_risk">At Risk</SelectItem>
        </SelectContent>
      </Select>

      {/* Job Focus */}
      <Select
        value={filters.job_focus ?? undefined}
        onValueChange={(v) => updateFilter('job_focus', v === '__clear__' ? undefined : v)}
      >
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Job Focus" />
        </SelectTrigger>
        <SelectContent>
          {filters.job_focus && <SelectItem value="__clear__">All Focus</SelectItem>}
          <SelectItem value="remote">Remote</SelectItem>
          <SelectItem value="onsite">Onsite</SelectItem>
          <SelectItem value="hybrid">Hybrid</SelectItem>
        </SelectContent>
      </Select>

      {/* Terminated */}
      <Select
        value={filters.terminated ?? undefined}
        onValueChange={(v) => updateFilter('terminated', v === '__clear__' ? undefined : v)}
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Terminated" />
        </SelectTrigger>
        <SelectContent>
          {filters.terminated && <SelectItem value="__clear__">All Status</SelectItem>}
          <SelectItem value="false">Active Only</SelectItem>
          <SelectItem value="true">Terminated</SelectItem>
        </SelectContent>
      </Select>

      {/* Hired */}
      <Select
        value={filters.hired ?? undefined}
        onValueChange={(v) => updateFilter('hired', v === '__clear__' ? undefined : v)}
      >
        <SelectTrigger className="w-[110px]">
          <SelectValue placeholder="Hired" />
        </SelectTrigger>
        <SelectContent>
          {filters.hired && <SelectItem value="__clear__">All Hired</SelectItem>}
          <SelectItem value="true">Hired</SelectItem>
          <SelectItem value="false">Not Hired</SelectItem>
        </SelectContent>
      </Select>

      {/* Experience */}
      <Select
        value={filters.experience ?? undefined}
        onValueChange={(v) => updateFilter('experience', v === '__clear__' ? undefined : v)}
      >
        <SelectTrigger className="w-[130px]">
          <SelectValue placeholder="Experience" />
        </SelectTrigger>
        <SelectContent>
          {filters.experience && <SelectItem value="__clear__">All Levels</SelectItem>}
          <SelectItem value="fresher">Fresher</SelectItem>
          <SelectItem value="experienced">Experienced</SelectItem>
        </SelectContent>
      </Select>

      {/* Batch */}
      <Select
        value={filters.batch ?? undefined}
        onValueChange={(v) => updateFilter('batch', v === '__clear__' ? undefined : v)}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Batch" />
        </SelectTrigger>
        <SelectContent>
          {filters.batch && <SelectItem value="__clear__">All Batches</SelectItem>}
          {BATCH_OPTIONS.map((b) => (
            <SelectItem key={b} value={b}>{b}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="outline" size="sm" onClick={clearAll} className="gap-1.5">
          <X className="w-3.5 h-3.5" />
          Clear
        </Button>
      )}
    </div>
  );
}
