'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { MenteesTableRow } from './mentees-table-row';
import type { Student } from '@/types';

const TABLE_HEADERS = [
  ['name', 'NAME'],
  ['project', 'PROJECT'],
  ['batch', 'BATCH'],
  ['stage', 'STAGE'],
  ['risk', 'RISK'],
  ['job_focus', 'FOCUS'],
  ['experience', 'EXP.'],
  ['status', 'STATUS'],
  ['last_activity_date', 'LAST ACTIVE'],
];

import { MenteeCard } from './mentee-card';

interface MenteesTableGridProps {
  pageRows: Student[];
  selectedIds: Set<string>;
  onSelectAllPageRows: (checked: boolean) => void;
  onSelectRow: (id: string, checked: boolean) => void;
  riskById: Map<string, any>;
  debouncedQuery: string;
  editing: { id: string; field: keyof Student } | null;
  dirtyCells: Set<string>;
  onEdit: (editing: { id: string; field: keyof Student } | null) => void;
  onSave: (student: Student, field: keyof Student, value: string) => Promise<void>;
  onAction: (type: string, student: Student) => void;
  onUpdate: (id: string, updates: Partial<Student>) => Promise<void>;
  sorts: any[];
  onToggleSort: (key: string, shift: boolean) => void;
  viewMode?: 'grid' | 'table';
}

function getHeaderTooltip(key: string) {
  switch (key) {
    case 'name': return 'Mentee full name and email address. Click row to view profile.';
    case 'project': return 'Active project track (e.g., EAP, Endgame, Kaizen, SCPC).';
    case 'batch': return 'Intake cohort identifier.';
    case 'stage': return 'Funnel phase (Learning to Hired). Inline editable.';
    case 'risk': return 'Flagged risk based on engagement metrics (Safe, Medium, High).';
    case 'job_focus': return 'Preferred job location preference (Remote, Onsite, Hybrid).';
    case 'experience': return 'Mentee work background level (Fresher or Experienced).';
    case 'status': return 'Status indicator displaying if the student is Hired or Terminated.';
    case 'last_activity_date': return 'Relative time elapsed since the student last logged activity.';
    default: return '';
  }
}

export function TableHeaderCell({ id, label, sorts, onToggleSort }: any) {
  const isSorted = sorts.some((s: any) => s.key === id);
  const direction = sorts.find((s: any) => s.key === id)?.direction;
  return (
    <th className="px-4 py-3 text-left text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={<span />}>
            <button
              onClick={(e) => onToggleSort(id, e.shiftKey)}
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors focus:outline-hidden"
            >
              {label}
              <ChevronDown className={cn("h-3 w-3 transition-transform text-slate-400/80", isSorted && direction === 'desc' && "rotate-180 text-foreground")} />
            </button>
          </TooltipTrigger>
          <TooltipContent className="bg-slate-900 border border-slate-800 text-white text-[11px] font-semibold max-w-xs p-2.5 rounded-lg">
            {getHeaderTooltip(id)}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </th>
  );
}

export function MenteesTableGrid({
  pageRows,
  selectedIds,
  onSelectAllPageRows,
  onSelectRow,
  riskById,
  debouncedQuery,
  editing,
  dirtyCells,
  onEdit,
  onSave,
  onAction,
  onUpdate,
  sorts,
  onToggleSort,
  viewMode = 'table',
}: MenteesTableGridProps) {
  const allChecked = pageRows.length > 0 && pageRows.every((s) => selectedIds.has(s.id));
  return (
    <>
      <div className={cn("overflow-x-auto rounded-2xl border border-border/45 bg-card shadow-xs", viewMode === 'table' ? "hidden md:block" : "hidden")}>
        <table className="min-w-full divide-y divide-border/40 text-sm">
          <thead className="bg-muted/15 border-b border-border/40">
            <tr>
              <th className="w-10 px-4 py-3">
                <Checkbox
                  aria-label="Select all students on page"
                  checked={allChecked}
                  onCheckedChange={onSelectAllPageRows}
                  className="rounded-md border-border/60"
                />
              </th>
              {TABLE_HEADERS.map(([key, label]) => (
                <TableHeaderCell key={key} id={key} label={label} sorts={sorts} onToggleSort={onToggleSort} />
              ))}
              <th className="px-4 py-3 text-right text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30 bg-card">
            {pageRows.map((student) => (
              <MenteesTableRow
                key={student.id}
                student={student}
                risk={riskById.get(student.id)}
                isSelected={selectedIds.has(student.id)}
                onSelectChange={(checked: any) => onSelectRow(student.id, !!checked)}
                debouncedQuery={debouncedQuery}
                editing={editing}
                dirtyCells={dirtyCells}
                onEdit={onEdit}
                onSave={onSave}
                onAction={onAction}
                onUpdate={onUpdate}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className={cn(
        viewMode === 'grid' 
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" 
          : "grid grid-cols-1 gap-3 md:hidden"
      )}>
        {pageRows.map((student) => (
          <MenteeCard 
            key={student.id} 
            student={student} 
            risk={riskById.get(student.id)} 
            isSelected={selectedIds.has(student.id)}
            onSelectChange={(checked: any) => onSelectRow(student.id, !!checked)}
            onAction={onAction} 
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </>
  );
}
