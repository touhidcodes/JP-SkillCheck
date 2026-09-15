import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import { CreateFormSchema } from '@/lib/validations/attendance-form';
import {
  createAttendanceForm,
  findActiveFormForSession,
  listFormsByMentor,
} from '@/lib/sheets/attendance-forms';
import { ensureAttendanceFormsSheet } from '@/lib/sheets/initialize';
import { buildPublicFormUrl } from '@/lib/utils/form-url';
import { appendAuditLog } from '@/lib/sheets/audit';

function isApiError(error: unknown): error is { message: string; status: number } {
  return typeof error === 'object' && error !== null && 'status' in error;
}

function responseFromError(error: unknown) {
  if (isApiError(error)) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
}

export async function POST(request: Request) {
  let user;
  try {
    user = requireRole(request.headers, ['mentor', 'manager']);
  } catch (error) {
    return responseFromError(error);
  }

  await ensureAttendanceFormsSheet();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = CreateFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const existing = await findActiveFormForSession(user.email, data.session_id);

  if (existing) {
    return NextResponse.json({
      id: existing.id,
      public_url: buildPublicFormUrl(existing.id, request),
      expires_at: existing.expires_at,
      session_label: existing.session_label,
      date: existing.date,
      is_existing: true,
    });
  }

  const form = await createAttendanceForm({
    mentor_email: user.email,
    session_id: data.session_id,
    session_label: data.session_label,
    date: data.date,
    mode: data.mode,
    period: data.period,
    expiry_minutes: data.expiry_minutes,
    topic_tags: data.topic_tags,
    duration_minutes: data.duration_minutes,
  });

  await appendAuditLog({
    user_email: user.email,
    actor_id: user.id,
    role: user.role,
    action: 'ATTENDANCE_FORM_CREATED',
    entity_type: 'attendance_form',
    entity_id: form.id,
    payload: {
      session_id: data.session_id,
      date: data.date,
      expiry_minutes: data.expiry_minutes,
    },
    request,
  }).catch(() => undefined);

  return NextResponse.json(
    {
      id: form.id,
      public_url: buildPublicFormUrl(form.id, request),
      expires_at: form.expires_at,
      session_label: form.session_label,
      date: form.date,
      is_existing: false,
    },
    { status: 201 }
  );
}

export async function GET(request: Request) {
  let user;
  try {
    user = requireRole(request.headers, ['mentor', 'manager']);
  } catch (error) {
    return responseFromError(error);
  }

  await ensureAttendanceFormsSheet();

  const date = new URL(request.url).searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  const forms = await listFormsByMentor(user.email, date);
  const now = new Date();

  const enriched = forms.map((form) => ({
    ...form,
    is_expired: new Date(form.expires_at) <= now,
    public_url: buildPublicFormUrl(form.id, request),
  }));

  return NextResponse.json({ data: enriched, total: enriched.length });
}
