'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, ShieldAlert, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem,
  FormLabel, FormMessage, FormDescription,
} from '@/components/ui/form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { usePlacementStore } from '@/lib/placement/store';
import type { Student, RiskLevel } from '@/types';

const riskOverrideSchema = z.object({
  risk_override_level: z.enum(['safe', 'medium', 'high', 'none']),
  risk_override_expires_at: z.string().optional(),
  risk_override_note: z.string().max(1000).optional(),
}).superRefine((data, ctx) => {
  if (data.risk_override_level !== 'none') {
    if (!data.risk_override_expires_at || data.risk_override_expires_at.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Expiration date is required when setting an override',
        path: ['risk_override_expires_at'],
      });
    }
    if (!data.risk_override_note || data.risk_override_note.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Justification note is required when setting an override',
        path: ['risk_override_note'],
      });
    }
  }
});

type RiskOverrideValues = z.infer<typeof riskOverrideSchema>;

interface RiskOverrideDialogProps {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RiskOverrideDialog({ student, open, onOpenChange }: RiskOverrideDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { optimisticStudentUpdate } = usePlacementStore();

  const form = useForm<RiskOverrideValues>({
    resolver: zodResolver(riskOverrideSchema),
    defaultValues: {
      risk_override_level: 'none',
      risk_override_expires_at: '',
      risk_override_note: '',
    },
  });

  const selectedLevel = form.watch('risk_override_level');

  useEffect(() => {
    if (student && open) {
      // Set tomorrow's date by default if no expiration exists
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 14); // 2 weeks default

      form.reset({
        risk_override_level: (student.risk_override_level as any) || 'none',
        risk_override_expires_at: student.risk_override_expires_at 
          ? format(new Date(student.risk_override_expires_at), 'yyyy-MM-dd') 
          : format(tomorrow, 'yyyy-MM-dd'),
        risk_override_note: student.risk_override_note || '',
      });
    }
  }, [student, open, form]);

  const onSubmit = async (values: RiskOverrideValues) => {
    if (!student) return;
    setIsSubmitting(true);
    try {
      const isClearing = values.risk_override_level === 'none';
      const updates = {
        risk_override_level: isClearing ? ('' as const) : (values.risk_override_level as RiskLevel),
        risk_override_expires_at: isClearing ? '' : new Date(values.risk_override_expires_at!).toISOString(),
        risk_override_note: isClearing ? '' : values.risk_override_note,
      };

      await optimisticStudentUpdate(student.id, updates);
      toast.success(isClearing ? 'Risk override cleared successfully' : 'Risk override set successfully');
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to update risk override status');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-6 rounded-2xl border border-border/60 bg-card shadow-lg gap-0">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-purple-650" />
            Manual Risk Severity Override
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs font-semibold">
            Manually override or restore the system-calculated risk level for {student?.name}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-5 pr-1">
            {/* Risk Level Override Select */}
            <FormField
              control={form.control}
              name="risk_override_level"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-[11px] font-bold text-slate-650 uppercase tracking-wider">Override Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-10 rounded-xl border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">Inherit (Automatic / System calculated)</SelectItem>
                      <SelectItem value="safe">Force SAFE</SelectItem>
                      <SelectItem value="medium">Force MEDIUM RISK</SelectItem>
                      <SelectItem value="high">Force HIGH RISK</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-xs font-bold text-red-650" />
                </FormItem>
              )}
            />

            {selectedLevel !== 'none' && (
              <>
                {/* Expiration Date */}
                <FormField
                  control={form.control}
                  name="risk_override_expires_at"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-[11px] font-bold text-slate-650 uppercase tracking-wider">Override Expiration Date</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                          <Input type="date" className="pl-9 h-10 rounded-xl border-border/50" {...field} />
                        </div>
                      </FormControl>
                      <FormDescription className="text-[10px] text-slate-400 font-medium">
                        The manual override will expire automatically and revert to system scoring after this date.
                      </FormDescription>
                      <FormMessage className="text-xs font-bold text-red-650" />
                    </FormItem>
                  )}
                />

                {/* Justification Note */}
                <FormField
                  control={form.control}
                  name="risk_override_note"
                  render={({ field }) => (
                    <FormItem className="space-y-1.5">
                      <FormLabel className="text-[11px] font-bold text-slate-650 uppercase tracking-wider">Justification / Intervention Note</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                          <Textarea
                            placeholder="State the reason for this override (e.g. approved medical leave, direct validation of job applications, etc.)..."
                            className="pl-9 resize-none rounded-xl border-border/50 p-3 min-h-[90px] focus-visible:ring-1 focus-visible:ring-purple-650 focus-visible:border-purple-650"
                            rows={3}
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage className="text-xs font-bold text-red-650" />
                    </FormItem>
                  )}
                />
              </>
            )}

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
                    <CheckCircle2 className="w-4 h-4" />
                    Apply Override
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
