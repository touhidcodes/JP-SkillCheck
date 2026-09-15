'use client';

import { 
  CheckCircle2, Edit3, Trash2, 
  User, Calendar, MoreHorizontal,
  Flag
} from 'lucide-react';
import { MentorTask, TaskPriority } from '@/types';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, isPast, isToday } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

interface TaskItemProps {
  task: MentorTask;
  onToggle: (id: string, completed: boolean) => void;
  onEdit: (task: MentorTask) => void;
  onDelete: (id: string) => void;
}

const PRIORITY_CONFIG: Record<TaskPriority, { color: string, icon: React.ElementType, label: string, bg: string }> = {
  low:      { color: 'text-slate-500',   bg: 'bg-slate-500',   icon: Flag, label: 'Low' },
  medium:   { color: 'text-blue-500',    bg: 'bg-blue-500',    icon: Flag, label: 'Medium' },
  high:     { color: 'text-amber-500',   bg: 'bg-amber-500',   icon: Flag, label: 'High' },
  critical: { color: 'text-red-500',     bg: 'bg-red-500',     icon: Flag, label: 'Critical' },
};

export function TaskItem({ task, onToggle, onEdit, onDelete }: TaskItemProps) {
  const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const isOverdue = !task.completed && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
  const isDueToday = !task.completed && isToday(new Date(task.due_date));

  return (
    <div className={cn(
      "group relative flex items-start gap-4 p-4 bg-card border rounded-xl transition-all duration-200",
      "hover:shadow-md hover:border-border/80 hover:bg-muted/5",
      task.completed ? "opacity-70 bg-muted/20" : "shadow-sm border-border/50"
    )}>
      {/* Selection / Toggle */}
      <div className="pt-1 shrink-0">
        <button
          onClick={() => onToggle(task.id, !task.completed)}
          className={cn(
            "flex items-center justify-center w-5 h-5 rounded-full border-2 transition-all duration-200",
            task.completed 
              ? "bg-emerald-500 border-emerald-500 text-white" 
              : "border-muted-foreground/30 hover:border-primary/50 text-transparent"
          )}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className={cn(
            "text-sm font-semibold truncate",
            task.completed ? "line-through text-muted-foreground" : "text-foreground"
          )}>
            {task.title}
          </h4>
          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", priority.bg)} />
          {isOverdue && (
            <Badge variant="destructive" className="h-4 px-1.5 text-[9px] font-bold uppercase tracking-wider">
              Overdue
            </Badge>
          )}
          {isDueToday && (
            <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-600 border-amber-200">
              Today
            </Badge>
          )}
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
            {task.description}
          </p>
        )}

        {/* Metadata Footer */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
            <User className="w-3 h-3" />
            {task.student_name ? (
              <span className="text-foreground/80">{task.student_name}</span>
            ) : (
              <span className="italic text-muted-foreground/60 underline decoration-dotted">Personal Task</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            <span className={cn(
              isOverdue ? "text-red-500" : isDueToday ? "text-amber-500" : "text-muted-foreground"
            )}>
              {formatDistanceToNow(new Date(task.due_date), { addSuffix: true })}
            </span>
          </div>

          <Badge variant="outline" className="h-4.5 px-1.5 py-0 text-[10px] bg-muted/30 border-muted-foreground/20 text-muted-foreground capitalize">
            {task.task_type.replace('_', ' ')}
          </Badge>
        </div>
      </div>

      {/* Action Menu */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={() => onEdit(task)}
              >
                <Edit3 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit task</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger render={<span />}>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                onClick={() => onDelete(task.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete task</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <DropdownMenu>
          <DropdownMenuTrigger render={<span />}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onToggle(task.id, !task.completed)}>
              {task.completed ? "Mark as Pending" : "Mark as Completed"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(task)}>Edit Details</DropdownMenuItem>
            <DropdownMenuItem 
              className="text-red-600 focus:text-red-600 focus:bg-red-50"
              onClick={() => onDelete(task.id)}
            >
              Delete Task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
