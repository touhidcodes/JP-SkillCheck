'use client';

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface FilterState {
  timeRange: string;
  cohort: string;
  mentor: string;
  riskLevel: string;
  performanceCategory: string;
}

interface AnalyticsFilterBarProps {
  filters: FilterState;
  onFilterChange: (key: keyof FilterState, value: string) => void;
  availableCohorts: string[];
  availableMentors: string[];
}

export function AnalyticsFilterBar({ filters, onFilterChange, availableCohorts, availableMentors }: AnalyticsFilterBarProps) {
  return (
    <div className="bg-card/45 backdrop-blur-md border border-border/40 p-4 rounded-2xl flex flex-wrap items-center gap-4 shadow-sm">
      <FilterDropdown
        label="Time Range"
        value={filters.timeRange}
        onChange={(v) => onFilterChange('timeRange', v)}
        options={[
          { value: 'all', label: 'All Time' },
          { value: '30d', label: 'Last 30 Days' },
          { value: '90d', label: 'Last 90 Days' },
          { value: 'ytd', label: 'Year to Date' }
        ]}
      />
      <FilterDropdown
        label="Cohort"
        value={filters.cohort}
        onChange={(v) => onFilterChange('cohort', v)}
        options={[{ value: 'all', label: 'All Cohorts' }, ...availableCohorts.map(c => ({ value: c, label: c }))]}
      />
      <FilterDropdown
        label="Mentor"
        value={filters.mentor}
        onChange={(v) => onFilterChange('mentor', v)}
        options={[{ value: 'all', label: 'All Mentors' }, ...availableMentors.map(m => ({ value: m, label: m.split('@')[0] }))]}
      />
      <FilterDropdown
        label="Risk Level"
        value={filters.riskLevel}
        onChange={(v) => onFilterChange('riskLevel', v)}
        options={[
          { value: 'all', label: 'All Risks' },
          { value: 'at_risk', label: 'At Risk' },
          { value: 'safe', label: 'Safe' }
        ]}
      />
      <FilterDropdown
        label="Performance"
        value={filters.performanceCategory}
        onChange={(v) => onFilterChange('performanceCategory', v)}
        options={[
          { value: 'all', label: 'All Tiers' },
          { value: 'Elite', label: 'Elite' },
          { value: 'Strong', label: 'Strong' },
          { value: 'Developing', label: 'Developing' },
          { value: 'Needs Support', label: 'Needs Support' }
        ]}
      />
    </div>
  );
}

function FilterDropdown({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-1 shrink-0 min-w-[130px]">
      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-xs rounded-lg">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
