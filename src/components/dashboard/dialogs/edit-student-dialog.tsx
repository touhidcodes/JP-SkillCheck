'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, User, Mail, Phone, Calendar, Save } from 'lucide-react';
import { toast } from 'sonner';

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
import type { Student } from '@/types';
import { usePlacementStore } from '@/lib/placement/store';

const editStudentSchema = z.object({
  name: z.string().min(1, 'Full name is required').max(100, 'Name must be under 100 characters'),
  student_email: z.union([z.string().email('Invalid email address'), z.literal('')]),
  phone: z.string().max(30, 'Phone must be under 30 characters').optional(),
  batch: z.string().max(50, 'Batch must be under 50 characters').optional(),
});

type EditStudentValues = z.infer<typeof editStudentSchema>;

interface EditStudentDialogProps {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditStudentDialog({ student, open, onOpenChange }: EditStudentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { optimisticStudentUpdate } = usePlacementStore();

  const form = useForm<EditStudentValues>({
    resolver: zodResolver(editStudentSchema),
    defaultValues: {
      name: '',
      student_email: '',
      phone: '',
      batch: '',
    },
  });

  useEffect(() => {
    if (student && open) {
      form.reset({
        name: student.name || '',
        student_email: student.student_email || '',
        phone: student.phone || '',
        batch: student.batch || '',
      });
    }
  }, [student, open, form]);

  const onSubmit = async (values: EditStudentValues) => {
    if (!student) return;
    setIsSubmitting(true);
    try {
      await optimisticStudentUpdate(student.id, values);
      onOpenChange(false);
      toast.success('Student details updated successfully');
    } catch (err) {
      toast.error('Failed to update student details');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-6 rounded-2xl border border-border/60 bg-card shadow-lg gap-0">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <User className="w-5 h-5 text-purple-650" />
            Edit Mentee Details
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs font-semibold">
            Update core contact information, cohort batch, and preferences for {student?.name}.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-5 pr-1">
            {/* Full Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-[11px] font-bold text-slate-650 uppercase tracking-wider">
                    Full Name <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input 
                        placeholder="e.g. John Doe"
                        className="pl-9 rounded-xl border-border/50 h-10"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="text-xs font-bold text-red-650" />
                </FormItem>
              )}
            />
            
            {/* Email & Phone */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="student_email"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-[11px] font-bold text-slate-650 uppercase tracking-wider">
                      Email Address
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input 
                          type="email"
                          placeholder="e.g. email@domain.com"
                          className="pl-9 rounded-xl border-border/50 h-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs font-bold text-red-650" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-[11px] font-bold text-slate-650 uppercase tracking-wider">
                      Phone Number
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input 
                          placeholder="e.g. +1 234 567"
                          className="pl-9 rounded-xl border-border/50 h-10"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage className="text-xs font-bold text-red-650" />
                  </FormItem>
                )}
              />
            </div>

            {/* Batch / Cohort */}
            <FormField
              control={form.control}
              name="batch"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-[11px] font-bold text-slate-650 uppercase tracking-wider">
                    Batch / Cohort
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input 
                        placeholder="e.g. batch-2024-Q1"
                        className="pl-9 rounded-xl border-border/50 h-10"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormDescription className="text-[10px] text-slate-400 font-medium">
                    This determines the student cohort and maps metrics on analytics.
                  </FormDescription>
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
                className="min-w-[120px] bg-purple-600 hover:bg-purple-700 font-bold rounded-xl h-10 px-4 transition-colors text-white flex items-center justify-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
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
