'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { GripVertical, AlertTriangle } from 'lucide-react';

type KanbanStudent = {
  id: string;
  name: string;
  batch: string;
  days_in_stage: number;
  risk_status?: string;
  job_focus?: string;
  project?: string;
};

interface KanbanCardProps {
  student: KanbanStudent;
  isOverlay?: boolean;
}

const JOB_FOCUS_SHORT: Record<string, string> = {
  remote: 'R', onsite: 'O', hybrid: 'H',
};

export function KanbanCard({ student, isOverlay = false }: KanbanCardProps) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: student.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const initials = student.name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const days = Number.isFinite(student.days_in_stage) ? student.days_in_stage : 0;

  const isAtRisk = student.risk_status === 'at_risk';
  const isUrgent = days >= 14;
  const isWarning = days >= 7 && !isUrgent;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'group flex items-start gap-2 rounded-lg border bg-background p-3',
        'shadow-sm hover:shadow-md transition-all duration-150 select-none',
        isDragging && !isOverlay && 'opacity-40 shadow-none',
        isOverlay && 'shadow-xl rotate-1 scale-105 cursor-grabbing',
        !isOverlay && 'cursor-grab active:cursor-grabbing',
        isUrgent && !isOverlay && 'border-red-300 border-2',
        isWarning && !isOverlay && !isAtRisk && 'border-amber-300 border-2',
        isAtRisk && !isOverlay && 'border-red-200',
      )}
    >
      <div className="mt-0.5 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors">
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      <Avatar className="w-7 h-7 shrink-0 border shadow-sm">
        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium text-foreground truncate leading-tight">
            {student.name}
          </p>
          {isAtRisk && (
            <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
          )}
        </div>

        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <span className="text-[11px] text-muted-foreground">{student.batch}</span>
          {student.project && (
            <span className="text-[10px] text-indigo-500 font-medium">{student.project}</span>
          )}
          {student.job_focus && JOB_FOCUS_SHORT[student.job_focus] && (
            <span className={cn(
              'inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-bold',
              student.job_focus === 'remote' ? 'bg-sky-100 text-sky-700' :
              student.job_focus === 'onsite' ? 'bg-orange-100 text-orange-700' :
              'bg-purple-100 text-purple-700',
            )}>
              {JOB_FOCUS_SHORT[student.job_focus]}
            </span>
          )}
        </div>

        <div className="mt-1.5 flex items-center gap-1">
          <span className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
            isUrgent ? 'bg-red-100 text-red-700' :
            isWarning ? 'bg-amber-100 text-amber-700' :
            'bg-muted text-muted-foreground',
          )}>
            {days === 0 ? 'Today' : `${days}d`}
          </span>
        </div>
      </div>
    </div>
  );
}