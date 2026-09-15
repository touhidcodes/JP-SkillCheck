'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, FileText, Save, CornerDownLeft } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import type { Student } from '@/types';
import { usePlacementStore } from '@/lib/placement/store';

const addNoteSchema = z.object({
  note: z.string().min(1, 'Note content is required').max(1000, 'Note must be under 1000 characters'),
});

type AddNoteValues = z.infer<typeof addNoteSchema>;

interface AddNoteDialogProps {
  student: Student | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddNoteDialog({ student, open, onOpenChange }: AddNoteDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { optimisticStudentUpdate } = usePlacementStore();

  const form = useForm<AddNoteValues>({
    resolver: zodResolver(addNoteSchema),
    defaultValues: {
      note: '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        note: '',
      });
    }
  }, [open, form]);

  const onSubmit = async (values: AddNoteValues) => {
    if (!student) return;
    setIsSubmitting(true);
    try {
      const timestamp = format(new Date(), 'MMM d, yyyy h:mm a');
      const prefix = student.notes ? `${student.notes}\n\n` : '';
      const updatedNotes = `${prefix}[${timestamp}] Added Note:\n${values.note.trim()}`;
      
      await optimisticStudentUpdate(student.id, { notes: updatedNotes });
      onOpenChange(false);
      toast.success('Note added successfully');
    } catch (err) {
      toast.error('Failed to add note to profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Ctrl+Enter / Cmd+Enter keyboard shortcut
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      form.handleSubmit(onSubmit)();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) form.reset();
      onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-md p-6 rounded-2xl border border-border/60 bg-card shadow-lg gap-0">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-650" />
            Add Mentee Note
          </DialogTitle>
          <DialogDescription className="text-slate-500 text-xs font-semibold">
            Append a detailed timeline note or quick internal reminder to {student?.name}&apos;s profile.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-5 pr-1">
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className="text-[11px] font-bold text-slate-650 uppercase tracking-wider">
                    Note Content
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Textarea
                        placeholder="Type your note here..."
                        className="h-32 resize-none rounded-xl border-border/50 p-3 text-sm focus-visible:ring-purple-600 focus-visible:border-purple-600 focus-visible:ring-1"
                        disabled={isSubmitting}
                        onKeyDown={handleKeyDown}
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <div className="flex items-center justify-between mt-1">
                    <FormMessage className="text-xs font-bold text-red-650" />
                    <p className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 ml-auto">
                      <CornerDownLeft className="w-3.5 h-3.5" /> Ctrl + Enter to quickly save
                    </p>
                  </div>
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
                    Save Note
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
