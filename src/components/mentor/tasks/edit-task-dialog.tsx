'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod/v4';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2, CheckSquare, Calendar, Tag, AlertTriangle, FileText, ClipboardList, Users } from 'lucide-react';

import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem,
  FormLabel, FormMessage,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { MentorTask } from '@/types';

// ─── Schema ───────────────────────────────────────────────────────────────────

const editTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(120, 'Title is too long'),
  taskType: z.enum([
    'follow_up', 'schedule_interview', 'review_progress',
    'risk_check', 'update_student_data', 'other',
  ]),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  dueDate: z.string().min(1, 'Due date is required'),
  description: z.string().optional(),
});

type EditTaskValues = z.infer<typeof editTaskSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface EditTaskDialogProps {
  task: MentorTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function EditTaskDialog({
  task,
  open,
  onOpenChange,
  onSuccess,
}: EditTaskDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<EditTaskValues>({
    resolver: standardSchemaResolver(editTaskSchema),
    defaultValues: {
      title: '',
      taskType: 'follow_up',
      priority: 'medium',
      dueDate: '',
      description: '',
    },
  });

  // Populate form whenever the task changes
  useEffect(() => {
    if (task && open) {
      form.reset({
        title: task.title,
        taskType: task.task_type as EditTaskValues['taskType'],
        priority: task.priority as EditTaskValues['priority'],
        dueDate: task.due_date,
        description: task.description ?? '',
      });
    }
  }, [task, open, form]);

  const editMutation = useMutation({
    mutationFn: async (values: EditTaskValues) => {
      const res = await fetch('/api/mentor/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: task?.id,
          title: values.title,
          description: values.description,
          due_date: values.dueDate,
          priority: values.priority,
          task_type: values.taskType,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update task');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Task updated successfully');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onOpenChange(false);
      onSuccess();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onSubmit = (values: EditTaskValues) => {
    editMutation.mutate(values);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      form.handleSubmit(onSubmit)();
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 rounded-2xl border border-border/60 bg-card shadow-lg overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-purple-650" />
            Edit Task
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs font-semibold">
            {task.student_name
              ? `Update details for task assigned to ${task.student_name}`
              : 'Update details for this personal task'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleKeyDown} className="flex flex-col">
            <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4">
              {/* Mentee context badge */}
              {task.student_name && (
                <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-purple-50/50 border border-purple-100/60 dark:bg-purple-950/20 dark:border-purple-900/30 animate-in fade-in duration-200">
                  <span className="text-[10px] font-black text-purple-700 dark:text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-600" /> Assigned Mentee
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{task.student_name}</span>
                </div>
              )}

              {/* ── Title ── */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-[11px] font-bold text-slate-650 uppercase tracking-wider">Task Title</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <CheckSquare className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input 
                          placeholder="Task title…" 
                          className="pl-9 h-10 rounded-xl border-border/50 focus-visible:ring-1 focus-visible:ring-purple-650 focus-visible:border-purple-650"
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs font-bold text-red-650" />
                  </FormItem>
                )}
              />

              {/* ── Type + Priority ── */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="taskType"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-[11px] font-bold text-slate-650 uppercase tracking-wider">Type</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-10 rounded-xl border-border/50">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl shadow-md border-border/60">
                          <SelectItem value="follow_up" className="rounded-lg">Follow Up</SelectItem>
                          <SelectItem value="schedule_interview" className="rounded-lg">Interview</SelectItem>
                          <SelectItem value="review_progress" className="rounded-lg">Review</SelectItem>
                          <SelectItem value="risk_check" className="rounded-lg">Risk Check</SelectItem>
                          <SelectItem value="update_student_data" className="rounded-lg">Update Data</SelectItem>
                          <SelectItem value="other" className="rounded-lg">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs font-bold text-red-650" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-[11px] font-bold text-slate-650 uppercase tracking-wider">Priority</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-10 rounded-xl border-border/50">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl shadow-md border-border/60">
                          <SelectItem value="low" className="rounded-lg">Low</SelectItem>
                          <SelectItem value="medium" className="rounded-lg">Medium</SelectItem>
                          <SelectItem value="high" className="rounded-lg">High</SelectItem>
                          <SelectItem value="critical" className="rounded-lg">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs font-bold text-red-650" />
                    </FormItem>
                  )}
                />
              </div>

              {/* ── Due Date ── */}
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-[11px] font-bold text-slate-650 uppercase tracking-wider">Due Date</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input 
                          type="date" 
                          className="pl-9 h-10 rounded-xl border-border/50 focus-visible:ring-1 focus-visible:ring-purple-650 focus-visible:border-purple-650"
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs font-bold text-red-650" />
                  </FormItem>
                )}
              />

              {/* ── Description ── */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-[11px] font-bold text-slate-650 uppercase tracking-wider">
                      Description <span className="text-muted-foreground font-normal lowercase">(Optional)</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Textarea
                          placeholder="Add details or instructions…"
                          rows={3}
                          className="pl-9 resize-none rounded-xl border-border/50 p-3 min-h-[90px] focus-visible:ring-1 focus-visible:ring-purple-650 focus-visible:border-purple-650"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs font-bold text-red-650" />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter className="p-6 border-t flex items-center justify-end gap-2 bg-slate-50/50">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={editMutation.isPending}
                className="font-bold rounded-xl h-10 px-4 transition-colors"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={editMutation.isPending} 
                className="min-w-[130px] bg-purple-600 hover:bg-purple-700 font-bold rounded-xl h-10 px-4 transition-colors text-white flex items-center justify-center gap-1.5"
              >
                {editMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
