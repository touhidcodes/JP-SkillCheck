'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow, format } from 'date-fns';
import { Loader2, Plus, CheckCircle2, Circle, Clock, AlertTriangle } from 'lucide-react';
import type { Student, MentorTask, TaskPriority } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useState } from 'react';

const PRIORITY_STYLES: Record<TaskPriority, { badge: string; label: string }> = {
  critical: { badge: 'bg-red-100 text-red-700 border-red-200', label: 'Critical' },
  high:    { badge: 'bg-amber-100 text-amber-700 border-amber-200', label: 'High' },
  medium:  { badge: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Medium' },
  low:     { badge: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Low' },
};

interface TasksTabProps {
  student: Student;
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const s = PRIORITY_STYLES[priority];
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border', s.badge)}>
      {priority === 'critical' && <AlertTriangle className="w-2.5 h-2.5" />}
      {s.label}
    </span>
  );
}

function TaskItem({
  task,
  onToggle,
}: {
  task: MentorTask;
  onToggle: (id: string, completed: boolean) => void;
}) {
  const isAuto = task.source === 'auto';
  const isOverdue = !task.completed && task.due_date && new Date(task.due_date) < new Date();

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-xl border transition-all',
      task.completed
        ? 'bg-muted/20 border-border/40 opacity-60'
        : 'bg-card border-border/60 hover:border-border'
    )}>
      <button
        onClick={() => onToggle(task.id, !task.completed)}
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
      >
        {task.completed
          ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          : <Circle className="w-4 h-4 hover:text-primary" />
        }
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={cn(
            'text-sm font-medium',
            task.completed && 'line-through text-muted-foreground'
          )}>
            {task.title}
          </p>
          <PriorityBadge priority={task.priority} />
          {isAuto && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-600 border border-purple-100">
              Auto
            </span>
          )}
        </div>

        {task.description && (
          <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
        )}

        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {task.due_date
              ? isOverdue
                ? <span className="text-red-500 font-medium">Overdue</span>
                : formatDistanceToNow(new Date(task.due_date), { addSuffix: true })
              : 'No due date'
            }
          </span>
          {task.completed && task.completed_at && (
            <span className="text-emerald-600/70">
              Done {formatDistanceToNow(new Date(task.completed_at), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateTaskForStudent({ student, onSuccess }: { student: Student; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [taskType, setTaskType] = useState('follow_up');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dueDate) {
      toast.error('Title and due date are required');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/mentor/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: student.id,
          student_name: student.name,
          task_type: taskType,
          title,
          description,
          due_date: dueDate,
          priority,
          source: 'manual',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || 'Failed');
        return;
      }
      toast.success('Task created');
      setOpen(false);
      setTitle('');
      setDescription('');
      setDueDate('');
      setPriority('medium');
      setTaskType('follow_up');
      onSuccess();
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button size="sm" className="gap-1.5 h-8 text-xs bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-3.5 h-3.5" />
          Add Task
        </Button>
      } />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Task for {student.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-type">Task Type</Label>
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger id="task-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="follow_up">Follow Up</SelectItem>
                <SelectItem value="schedule_interview">Schedule Interview</SelectItem>
                <SelectItem value="review_progress">Review Progress</SelectItem>
                <SelectItem value="risk_check">Risk Check</SelectItem>
                <SelectItem value="update_student_data">Update Data</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" placeholder="Task title" value={title} onChange={e => setTitle(e.target.value)} maxLength={200} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" placeholder="Additional context..." value={description} onChange={e => setDescription(e.target.value)} rows={2} maxLength={1000} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="due-date">Due Date *</Label>
              <Input id="due-date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} min={format(new Date(), 'yyyy-MM-dd')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger id="priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating…' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TasksTab({ student }: TasksTabProps) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['student-tasks', student.id],
    queryFn: async () => {
      const res = await fetch(`/api/mentor/tasks?student_id=${student.id}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json() as Promise<{ data: MentorTask[]; total: number }>;
    },
  });

  const tasks: MentorTask[] = data?.data ?? [];

  const pending = tasks.filter(t => !t.completed);
  const completed = tasks.filter(t => t.completed);

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const res = await fetch('/api/mentor/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, completed }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-tasks', student.id] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleToggle = (id: string, completed: boolean) => {
    toggleMutation.mutate({ id, completed });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {pending.length} pending, {completed.length} completed
          </span>
        </div>
        <CreateTaskForStudent student={student} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['student-tasks', student.id] })} />
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-10">
          <CheckCircle2 className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No tasks for this student</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pending</p>
              <div className="space-y-2">
                {pending.map(task => (
                  <TaskItem key={task.id} task={task} onToggle={handleToggle} />
                ))}
              </div>
            </div>
          )}
          {completed.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Completed</p>
              <div className="space-y-2">
                {completed.map(task => (
                  <TaskItem key={task.id} task={task} onToggle={handleToggle} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}