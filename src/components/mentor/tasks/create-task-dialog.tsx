'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod/v4';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { User, Users, Loader2, CheckSquare, Calendar, Tag, AlertTriangle, FileText, ClipboardList } from 'lucide-react';

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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { MentorTaskType, TaskPriority } from '@/types';

// ─── Schema ───────────────────────────────────────────────────────────────────

const createTaskSchema = z.object({
  isPersonal: z.boolean(),
  studentId: z.string().optional(),
  title: z.string().min(1, 'Title is required').max(120, 'Title is too long'),
  taskType: z.enum([
    'follow_up', 'schedule_interview', 'review_progress',
    'risk_check', 'update_student_data', 'other',
  ]),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  dueDate: z.string().min(1, 'Due date is required'),
  description: z.string().optional(),
}).superRefine((data, ctx) => {
  if (!data.isPersonal && !data.studentId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Please select a mentee',
      path: ['studentId'],
    });
  }
});

type CreateTaskValues = z.infer<typeof createTaskSchema>;

// ─── Props ────────────────────────────────────────────────────────────────────

interface CreateTaskDialogProps {
  students: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  defaultStudentId?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CreateTaskDialog({
  students,
  open,
  onOpenChange,
  onSuccess,
  defaultStudentId,
}: CreateTaskDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<CreateTaskValues>({
    resolver: standardSchemaResolver(createTaskSchema),
    defaultValues: {
      isPersonal: !defaultStudentId,
      studentId: defaultStudentId ?? '',
      title: '',
      taskType: 'follow_up',
      priority: 'medium',
      dueDate: format(new Date(), 'yyyy-MM-dd'),
      description: '',
    },
  });

  const isPersonal = form.watch('isPersonal');

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      form.reset({
        isPersonal: !defaultStudentId,
        studentId: defaultStudentId ?? '',
        title: '',
        taskType: 'follow_up',
        priority: 'medium',
        dueDate: format(new Date(), 'yyyy-MM-dd'),
        description: '',
      });
    }
  }, [open, defaultStudentId, form]);

  const createMutation = useMutation({
    mutationFn: async (values: CreateTaskValues) => {
      const student = students.find(s => s.id === values.studentId);
      const body: Record<string, unknown> = {
        task_type: values.taskType,
        title: values.title,
        description: values.description,
        due_date: values.dueDate,
        priority: values.priority,
        source: 'manual',
      };
      if (!values.isPersonal) {
        body.student_id = values.studentId;
        body.student_name = student?.name ?? '';
      }
      const res = await fetch('/api/mentor/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create task');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Task created successfully');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onOpenChange(false);
      onSuccess();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const onSubmit = (values: CreateTaskValues) => {
    createMutation.mutate(values);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      form.handleSubmit(onSubmit)();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 rounded-2xl border border-border/60 bg-card shadow-lg overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-purple-650" />
            Create New Task
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs font-semibold">
            Add a task for yourself or assign it to an active mentee.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleKeyDown} className="flex flex-col">
            <div className="max-h-[60vh] overflow-y-auto p-6 space-y-4">
              {/* ── Personal / Mentee toggle ── */}
              <Tabs
                value={isPersonal ? 'personal' : 'student'}
                onValueChange={v => {
                  form.setValue('isPersonal', v === 'personal', { shouldValidate: true });
                  if (v === 'personal') form.setValue('studentId', '');
                }}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2 p-1 bg-slate-100 rounded-xl h-11">
                  <TabsTrigger 
                    value="personal" 
                    className="gap-2 rounded-lg font-bold text-xs transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                  >
                    <User className="w-3.5 h-3.5" /> Personal
                  </TabsTrigger>
                  <TabsTrigger 
                    value="student" 
                    className="gap-2 rounded-lg font-bold text-xs transition-all data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-sm"
                  >
                    <Users className="w-3.5 h-3.5" /> Mentee
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* ── Mentee selector (conditional) ── */}
              {!isPersonal && (
                <FormField
                  control={form.control}
                  name="studentId"
                  render={({ field }) => (
                    <FormItem className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-1.5">
                      <FormLabel className="text-[11px] font-bold text-slate-650 uppercase tracking-wider">Select Mentee</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-10 rounded-xl border-border/50 focus:ring-purple-650">
                            <SelectValue placeholder="Choose a mentee…" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-xl shadow-md border-border/60">
                          {students.map(s => (
                            <SelectItem key={s.id} value={s.id} className="rounded-lg">{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs font-bold text-red-650" />
                    </FormItem>
                  )}
                />
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
                          placeholder={isPersonal ? 'e.g. Prepare weekly report' : 'e.g. Review portfolio'}
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
                          min={format(new Date(), 'yyyy-MM-dd')}
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
                disabled={createMutation.isPending}
                className="font-bold rounded-xl h-10 px-4 transition-colors"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending} 
                className="min-w-[130px] bg-purple-600 hover:bg-purple-700 font-bold rounded-xl h-10 px-4 transition-colors text-white flex items-center justify-center gap-1.5"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating…
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4" />
                    Create Task
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
