'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { z } from 'zod/v4';
import { Loader2, PlusCircle, CheckSquare, Calendar, Clock, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

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
import { usePlacementStore } from '@/lib/placement/store';
import type { Student } from '@/types';

const logProgressSchema = z.object({
  log_type: z.enum(['Interview Call', 'Job Applied', 'Mock Interview', 'Job Task', 'Offer', 'Other']),
  company_name: z.string().min(1, 'Company name is required').max(200),
  scheduled_date: z.string().min(1, 'Date is required'),
  scheduled_time: z.string().optional(),
  note: z.string().max(1000).optional(),
});

type LogProgressValues = z.infer<typeof logProgressSchema>;

interface LogProgressDialogProps {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function LogProgressDialog({ student, open, onOpenChange, onSuccess }: LogProgressDialogProps) {
  const { refresh } = usePlacementStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LogProgressValues>({
    resolver: standardSchemaResolver(logProgressSchema),
    defaultValues: {
      log_type: 'Interview Call',
      company_name: '',
      scheduled_date: format(new Date(), 'yyyy-MM-dd'),
      scheduled_time: '',
      note: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        log_type: 'Interview Call',
        company_name: '',
        scheduled_date: format(new Date(), 'yyyy-MM-dd'),
        scheduled_time: '',
        note: '',
      });
    }
  }, [open, form]);

  const onSubmit = async (values: LogProgressValues) => {
    if (!student) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/progress-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, student_id: student.id }),
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to log progress');
      }
      
      await refresh(); // Refresh placement store to get new logs
      toast.success('Progress event logged successfully');
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to log progress event');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-6 rounded-2xl border border-border/60 bg-card shadow-lg gap-0">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-purple-650" />
            Log Progress Event
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs font-semibold">
            Record a mock interview, job application, call feedback, or active offer details for {student?.name}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-5 pr-1">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="log_type"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-[11px] font-bold text-slate-650 uppercase tracking-wider">Event Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 rounded-xl border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Interview Call">Interview Call</SelectItem>
                        <SelectItem value="Job Applied">Job Applied</SelectItem>
                        <SelectItem value="Mock Interview">Mock Interview</SelectItem>
                        <SelectItem value="Job Task">Job Task</SelectItem>
                        <SelectItem value="Offer">Offer</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-xs font-bold text-red-650" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="company_name"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-[11px] font-bold text-slate-650 uppercase tracking-wider">Company Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <PlusCircle className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input placeholder="e.g. Google, Stripe" className="pl-9 h-10 rounded-xl border-border/50" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs font-bold text-red-650" />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="scheduled_date"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-[11px] font-bold text-slate-650 uppercase tracking-wider">Date</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input type="date" className="pl-9 h-10 rounded-xl border-border/50" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs font-bold text-red-650" />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="scheduled_time"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-[11px] font-bold text-slate-650 uppercase tracking-wider">
                      Time <span className="text-muted-foreground font-normal lowercase">(Optional)</span>
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Clock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input type="time" className="pl-9 h-10 rounded-xl border-border/50" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs font-bold text-red-650" />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-[11px] font-bold text-slate-650 uppercase tracking-wider">
                    Event Notes <span className="text-muted-foreground font-normal lowercase">(Optional)</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Edit2 className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Textarea
                        placeholder="Detail the stage, interview round, salary info, or interviewer feedback..."
                        className="pl-9 resize-none rounded-xl border-border/50 p-3 min-h-[90px] focus-visible:ring-1 focus-visible:ring-purple-600 focus-visible:border-purple-600"
                        rows={3}
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs font-bold text-red-650" />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4 border-t flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
                className="font-bold rounded-xl h-10 px-4 transition-colors"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isSubmitting} 
                className="min-w-[130px] bg-purple-600 hover:bg-purple-700 font-bold rounded-xl h-10 px-4 transition-colors text-white flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4" />
                    Log Progress
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
