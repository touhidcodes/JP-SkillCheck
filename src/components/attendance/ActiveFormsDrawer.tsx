'use client';

import { Copy, X } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAttendanceForms, useDeactivateForm } from '@/hooks/use-attendance-forms';

interface ActiveFormsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
}

export function ActiveFormsDrawer({ open, onOpenChange, date }: ActiveFormsDrawerProps) {
  const { data, isLoading } = useAttendanceForms(date);
  const { mutate: deactivate } = useDeactivateForm();

  const forms = data?.data ?? [];

  function copyLink(url: string) {
    navigator.clipboard.writeText(url).catch(() => undefined);
    toast.success('Link copied');
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Attendance Forms — {date}</SheetTitle>
        </SheetHeader>

        {isLoading && <p className="mt-4 text-sm text-muted-foreground">Loading…</p>}

        {!isLoading && forms.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">No forms created for this date.</p>
        )}

        <ul className="mt-4 space-y-3">
          {forms.map((form: any) => {
            const active = form.is_active && !form.is_expired;
            const expiryLabel = formatDistanceToNow(parseISO(form.expires_at), { addSuffix: true });

            return (
              <li key={form.id} className="space-y-2 rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{form.session_label}</span>
                  <Badge variant={active ? 'default' : 'secondary'}>
                    {form.is_expired ? 'Expired' : form.is_active ? 'Active' : 'Closed'}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground">
                  {form.submission_count} {form.submission_count === 1 ? 'submission' : 'submissions'} ·{' '}
                  {form.is_expired ? `Expired ${expiryLabel}` : `Expires ${expiryLabel}`}
                </p>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => copyLink(form.public_url)}>
                    <Copy className="mr-1 h-3 w-3" />
                    Copy Link
                  </Button>
                  {active && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deactivate({ id: form.id })}
                    >
                      <X className="mr-1 h-3 w-3" />
                      Close
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
