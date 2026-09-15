'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { StudentSubmitSchema } from '@/lib/validations/attendance-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface FormMeta {
  id: string;
  session_label: string;
  date: string;
  is_active: boolean;
  is_expired: boolean;
}

interface Props {
  formMeta: FormMeta;
}

interface FieldErrors {
  full_name?: string;
  email?: string;
}

interface SubmitError {
  code: string;
  message: string;
}

function formatDateLabel(date: string): string {
  try {
    return format(parseISO(date), 'EEEE, MMMM d, yyyy');
  } catch {
    return date;
  }
}

function ClosedState({ sessionLabel }: { sessionLabel: string }) {
  return (
    <div className="w-full max-w-md space-y-3 rounded-2xl border bg-card text-card-foreground p-8 text-center shadow-sm">
      <div className="text-4xl">🔒</div>
      <h1 className="text-xl font-semibold text-foreground">Form Closed</h1>
      <p className="text-sm text-muted-foreground">
        The attendance form for <strong>{sessionLabel}</strong> is no longer accepting submissions.
      </p>
      <p className="text-xs text-muted-foreground/80">Please contact your instructor if you need help.</p>
    </div>
  );
}

function AlreadySubmittedState({ message }: { message: string }) {
  return (
    <div className="w-full max-w-md space-y-3 rounded-2xl border bg-card text-card-foreground p-8 text-center shadow-sm">
      <div className="text-4xl">✅</div>
      <h1 className="text-xl font-semibold text-foreground">Already Recorded</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function StudentAttendanceForm({ formMeta }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formattedDate = useMemo(() => formatDateLabel(formMeta.date), [formMeta.date]);

  if (!formMeta.is_active || formMeta.is_expired) {
    return <ClosedState sessionLabel={formMeta.session_label} />;
  }

  if (submitError?.code === 'ALREADY_SUBMITTED') {
    return <AlreadySubmittedState message={submitError.message} />;
  }

  async function handleSubmit() {
    setSubmitError(null);

    const result = StudentSubmitSchema.safeParse({ full_name: fullName, email });
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      setErrors({
        full_name: fieldErrors.full_name?.[0],
        email: fieldErrors.email?.[0],
      });
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/attend/${formMeta.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: result.data.full_name,
          email: result.data.email,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 409) {
        setSubmitError({
          code: data.code ?? 'ALREADY_SUBMITTED',
          message:
            data.message ??
            `Your attendance for "${formMeta.session_label}" has already been recorded.`,
        });
        return;
      }

      if (!response.ok) {
        if (data.code === 'STUDENT_NOT_FOUND' || data.code === 'STUDENT_NOT_IN_COHORT') {
          setErrors((prev) => ({
            ...prev,
            email: data.message ?? 'Please verify your email address.',
          }));
          return;
        }

        if (data.code === 'VALIDATION_ERROR') {
          setErrors({
            full_name: data.errors?.full_name?.[0],
            email: data.errors?.email?.[0],
          });
          return;
        }

        setSubmitError({
          code: data.code ?? 'SERVER_ERROR',
          message: data.message ?? 'Something went wrong. Please try again.',
        });
        return;
      }

      router.push(`/attend/${formMeta.id}/success`);
    } catch {
      setSubmitError({
        code: 'NETWORK_ERROR',
        message: 'Could not reach the server. Check your connection and try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md space-y-6 rounded-2xl border bg-card text-card-foreground p-6 shadow-sm sm:p-8">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-500">
          Attendance Form
        </p>
        <h1 className="text-xl font-bold text-foreground">{formMeta.session_label}</h1>
        <p className="text-sm text-muted-foreground">{formattedDate}</p>
      </div>

      <hr />

      <div className="space-y-3">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Session</p>
          <div className="rounded-lg border bg-muted px-3 py-3 text-sm font-medium text-foreground">
            {formMeta.session_label}
          </div>
        </div>
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Date</p>
          <div className="rounded-lg border bg-muted px-3 py-3 text-sm font-medium text-foreground">
            {formattedDate}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Full Name</Label>
          <Input
            id="full_name"
            type="text"
            placeholder="Jane Doe"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className={`h-12 text-base ${errors.full_name ? 'border-red-500' : ''}`}
            autoComplete="name"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.full_name)}
          />
          {errors.full_name && <p className="text-xs text-red-600">{errors.full_name}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email Address</Label>
          <Input
            id="email"
            type="email"
            placeholder="jane@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={`h-12 text-base ${errors.email ? 'border-red-500' : ''}`}
            autoComplete="email"
            inputMode="email"
            disabled={isSubmitting}
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
        </div>
      </div>

      {submitError && submitError.code !== 'ALREADY_SUBMITTED' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError.message}
          {submitError.code === 'NETWORK_ERROR' && (
            <button
              onClick={handleSubmit}
              className="ml-2 underline font-medium"
              disabled={isSubmitting}
            >
              Retry
            </button>
          )}
        </div>
      )}

      <Button onClick={handleSubmit} disabled={isSubmitting} className="h-12 w-full text-base font-semibold">
        {isSubmitting ? 'Submitting…' : 'Submit Attendance'}
      </Button>
    </div>
  );
}
