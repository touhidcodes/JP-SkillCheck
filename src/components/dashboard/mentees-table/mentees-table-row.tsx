'use client';

import React from 'react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { RiskLevel, Student, StudentStage } from '@/types';
import { PROJECT_NAMES } from '@/types';

const STAGE_OPTIONS: StudentStage[] = ['learning', 'applying', 'interviewing', 'offer_pending', 'placed', 'hired'];
const FOCUS_OPTIONS = ['remote', 'onsite', 'hybrid'] as const;
const EXPERIENCE_OPTIONS = ['fresher', 'experienced'] as const;

export const STAGE_LABEL: Record<string, string> = {
  learning: 'Learning',
  applying: 'Applying',
  interviewing: 'Interviewing',
  offer_pending: 'Offer Pending',
  placed: 'Placed',
  hired: 'Hired',
};

export const BADGE = {
  stage: {
    learning: 'bg-slate-100 text-slate-700 border-slate-200/60 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    applying: 'bg-blue-50 text-blue-700 border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40',
    interviewing: 'bg-orange-50 text-orange-700 border-orange-200/60 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-900/40',
    offer_pending: 'bg-yellow-50 text-yellow-800 border-yellow-200/60 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-900/40',
    placed: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40',
    hired: 'bg-green-50 text-green-700 border-green-200/60 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900/40',
  },
  risk: {
    safe: 'bg-emerald-50 text-emerald-700 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40',
    medium: 'bg-amber-50 text-amber-700 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40',
    high: 'bg-red-50 text-red-700 border-red-200/60 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/40',
  },
};

interface MenteesTableRowProps {
  student: Student;
  risk: any;
  isSelected: boolean;
  onSelectChange: (checked: boolean) => void;
  debouncedQuery: string;
  editing: { id: string; field: keyof Student } | null;
  dirtyCells: Set<string>;
  onEdit: (editing: { id: string; field: keyof Student } | null) => void;
  onSave: (student: Student, field: keyof Student, value: string) => Promise<void>;
  onAction: (type: string, student: Student) => void;
  onUpdate: (id: string, updates: Partial<Student>) => Promise<void>;
}

export function riskLabel(level: RiskLevel) {
  if (level === 'safe') return 'Safe';
  if (level === 'medium') return 'Medium';
  return 'High';
}

export function daysInactive(student: Student) {
  if (!student.last_activity_date) return 999;
  const date = new Date(student.last_activity_date);
  if (Number.isNaN(date.getTime())) return 999;
  return differenceInDays(new Date(), date);
}

export function highlight(value: string, query: string) {
  if (!query) return value;
  const index = value.toLowerCase().indexOf(query.toLowerCase());
  if (index === -1) return value;
  return (
    <>
      {value.slice(0, index)}
      <mark className="rounded bg-yellow-250 px-0.5 text-slate-900">{value.slice(index, index + query.length)}</mark>
      {value.slice(index + query.length)}
    </>
  );
}

export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold shadow-2xs', className)}>
      {children}
    </span>
  );
}

export function EditableCell({ student, field, editing, dirty, options, render, onEdit, onSave }: any) {
  const value = String(student[field] || '');
  const isEditing = editing?.id === student.id && editing.field === field;
  return (
    <td className="px-4 py-3 text-xs" onDoubleClick={(e) => { e.stopPropagation(); onEdit({ id: student.id, field }); }}>
      <span className="relative inline-flex items-center gap-1">
        {isEditing ? (
          <Select value={value || '__none__'} onValueChange={(next) => onSave(student, field, next === '__none__' ? '' : next)}>
            <SelectTrigger className="h-8 w-[135px] rounded-lg border-border/50 text-[11px] font-semibold bg-card shadow-2xs" autoFocus>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border/60">
              <SelectItem value="__none__" className="text-xs font-semibold">None</SelectItem>
              {options.map((option: string) => (
                <SelectItem key={option} value={option} className="text-xs font-semibold">
                  {STAGE_LABEL[option] || option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : render ? render(value) : <span className="text-slate-600 dark:text-slate-350 font-semibold capitalize">{value || '-'}</span>}
        {dirty && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" aria-label="Sync pending" />}
      </span>
    </td>
  );
}

export function RowActions({ student, onUpdate, onAction }: any) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<span />}>
        <Button variant="ghost" size="sm" aria-label={`Actions for ${student.name}`} className="h-8 w-8 p-0 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-xl border-border/60 min-w-[140px]">
        <DropdownMenuItem onClick={() => onAction('view_profile', student)} className="text-xs font-semibold">View Profile</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('edit', student)} className="text-xs font-semibold">Edit</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('note', student)} className="text-xs font-semibold">Add Note</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('task', student)} className="text-xs font-semibold">Mark Follow-up</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('log', student)} className="text-xs font-semibold">Log Progress</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('send_message', student)} className="text-xs font-semibold">Send Message</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onAction('view_attendance', student)} className="text-xs font-semibold">View Attendance</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onUpdate(student.id, { terminated: true, terminated_date: new Date().toISOString().slice(0, 10) })} className="text-xs font-bold text-red-600 focus:text-red-600 focus:bg-red-500/5">Mark Terminated</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onUpdate(student.id, { hired: true, stage: 'hired', hired_date: new Date().toISOString().slice(0, 10) })} className="text-xs font-bold text-emerald-600 focus:text-emerald-600 focus:bg-emerald-500/5">Mark Hired</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MenteesTableRow({
  student,
  risk,
  isSelected,
  onSelectChange,
  debouncedQuery,
  editing,
  dirtyCells,
  onEdit,
  onSave,
  onAction,
  onUpdate,
}: MenteesTableRowProps) {
  const inactiveDays = daysInactive(student);
  const riskValue = risk?.level || 'safe';
  return (
    <tr
      onClick={() => onAction('view_profile', student)}
      className={cn(
        'cursor-pointer transition hover:bg-muted/15 border-b border-border/40',
        student.terminated && 'bg-red-500/5 text-muted-foreground/80 dark:bg-red-950/10',
        student.hired && !student.terminated && 'bg-emerald-500/5 dark:bg-emerald-950/10',
      )}
    >
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          aria-label={`Select ${student.name}`}
          checked={isSelected}
          onCheckedChange={onSelectChange}
          className="rounded-md border-border/60"
        />
      </td>
      <td className={cn('px-4 py-3 font-semibold text-xs', student.terminated && 'line-through text-muted-foreground')}>
        <div className="text-foreground font-black">{highlight(student.name, debouncedQuery)}</div>
        <div className="text-[10px] font-medium text-muted-foreground dark:text-slate-400">{highlight(student.student_email || '', debouncedQuery)}</div>
      </td>
      <EditableCell student={student} field="project" editing={editing} dirty={dirtyCells.has(`${student.id}:project`)} onEdit={onEdit} onSave={onSave} options={PROJECT_NAMES} />
      <td className="px-4 py-3 text-xs text-muted-foreground font-semibold">{highlight(student.batch || '-', debouncedQuery)}</td>
      <EditableCell
        student={student}
        field="stage"
        editing={editing}
        dirty={dirtyCells.has(`${student.id}:stage`)}
        onEdit={onEdit}
        onSave={onSave}
        options={STAGE_OPTIONS}
        render={(value: any) => <Badge className={BADGE.stage[value as StudentStage]}>{STAGE_LABEL[value] || value}</Badge>}
      />
      <td className="px-4 py-3">
        <Badge className={BADGE.risk[riskValue as RiskLevel]}>
          {riskLabel(riskValue as RiskLevel)}{risk?.manual_override ? ' · Manual' : ''}
        </Badge>
      </td>
      <EditableCell student={student} field="job_focus" editing={editing} dirty={dirtyCells.has(`${student.id}:job_focus`)} onEdit={onEdit} onSave={onSave} options={FOCUS_OPTIONS} />
      <EditableCell student={student} field="experience" editing={editing} dirty={dirtyCells.has(`${student.id}:experience`)} onEdit={onEdit} onSave={onSave} options={EXPERIENCE_OPTIONS} />
      <td className="px-4 py-3">
        <div className="flex gap-1">
          {student.hired && <Badge className="bg-emerald-600/10 text-emerald-700 border-emerald-500/20 dark:border-emerald-900/30 dark:bg-emerald-950/40 dark:text-emerald-400">Hired</Badge>}
          {student.terminated && <Badge className="bg-red-600/10 text-red-700 border-red-500/20 dark:border-red-900/30 dark:bg-red-950/40 dark:text-red-400">Terminated</Badge>}
          {!student.hired && !student.terminated && <span className="text-muted-foreground/60">-</span>}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={cn(
          'text-xs font-semibold',
          inactiveDays > 14 ? 'text-red-600 dark:text-red-400' : inactiveDays >= 7 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
        )}>
          {student.last_activity_date ? formatDistanceToNow(new Date(student.last_activity_date), { addSuffix: true }) : 'No activity'}
        </span>
      </td>
      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <RowActions student={student} onUpdate={onUpdate} onAction={onAction} />
      </td>
    </tr>
  );
}


