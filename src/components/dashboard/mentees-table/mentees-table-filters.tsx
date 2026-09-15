'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PROJECT_NAMES, StudentStage, RiskLevel } from '@/types';

const STAGE_OPTIONS: StudentStage[] = ['learning', 'applying', 'interviewing', 'offer_pending', 'placed', 'hired'];
const FOCUS_OPTIONS = ['remote', 'onsite', 'hybrid'] as const;
const EXPERIENCE_OPTIONS = ['fresher', 'experienced'] as const;
const RISK_OPTIONS: RiskLevel[] = ['safe', 'medium', 'high'];

const STAGE_LABEL: Record<string, string> = {
  learning: 'Learning', applying: 'Applying', interviewing: 'Interviewing',
  offer_pending: 'Offer Pending', placed: 'Placed', hired: 'Hired',
};

interface MenteesFiltersProps {
  filters: any;
  counts: any;
  onFilterChange: (key: string, value: string) => void;
  onClearAll: () => void;
}

function FilterSelect({ label, value, options, counts, labels, labelFn, onChange }: any) {
  return (
    <Select value={value || '__all__'} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-[135px] rounded-lg border-border/50 text-xs font-semibold bg-card shadow-2xs">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent className="rounded-xl border-border/60">
        <SelectItem value="__all__" className="text-xs font-semibold">{label}</SelectItem>
        {options.map((option: string) => (
          <SelectItem key={option} value={option} className="text-xs font-semibold">
            {(labels?.[option] || labelFn?.(option) || option)} ({counts?.get(option) || 0})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function MenteesTableFilters({ filters, counts, onFilterChange, onClearAll }: MenteesFiltersProps) {
  const hasActiveFilters = Object.keys(filters).length > 0;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect label="Project" value={filters.project} options={PROJECT_NAMES} counts={counts.project} onChange={(val: string) => onFilterChange('project', val)} />
      <FilterSelect label="Stage" value={filters.stage} options={STAGE_OPTIONS} labels={STAGE_LABEL} counts={counts.stage} onChange={(val: string) => onFilterChange('stage', val)} />
      <FilterSelect label="Risk" value={filters.risk} options={RISK_OPTIONS} counts={counts.risk} labelFn={(val: string) => val.charAt(0).toUpperCase() + val.slice(1)} onChange={(val: string) => onFilterChange('risk', val)} />
      <FilterSelect label="Job Focus" value={filters.job_focus} options={FOCUS_OPTIONS} counts={counts.job_focus} onChange={(val: string) => onFilterChange('job_focus', val)} />
      <FilterSelect label="Batch" value={filters.batch} options={Array.from(counts.batch.keys()).sort()} counts={counts.batch} onChange={(val: string) => onFilterChange('batch', val)} />
      {hasActiveFilters && (
        <Button variant="outline" size="sm" className="h-9 rounded-full px-3 text-xs font-bold text-red-600 dark:text-red-400 border-red-200/60 dark:border-red-900/30 bg-red-500/5 dark:bg-red-950/10 hover:bg-red-500/10 dark:hover:bg-red-950/20" onClick={onClearAll}>
          <X className="mr-1 h-3.5 w-3.5" />
          Clear all filters
        </Button>
      )}
    </div>
  );
}
