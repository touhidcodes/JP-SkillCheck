import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import { PatchFormSchema } from '@/lib/validations/attendance-form';
import { getAttendanceFormById, updateAttendanceForm } from '@/lib/sheets/attendance-forms';
import { buildPublicFormUrl } from '@/lib/utils/form-url';
import { appendAuditLog } from '@/lib/sheets/audit';
import { ensureAttendanceFormsSheet } from '@/lib/sheets/initialize';

function isApiError(error: unknown): error is { message: string; status: number } {
  return typeof error === 'object' && error !== null && 'status' in error;
}

function responseFromError(error: unknown) {
  if (isApiError(error)) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
}

// Public GET — students and mentors both use this to check form status
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  await ensureAttendanceFormsSheet();

  const form = await getAttendanceFormById(params.id);
  if (!form) return NextResponse.json({ message: 'Form not found' }, { status: 404 });

  const now = new Date();
  const is_expired = new Date(form.expires_at) <= now;

  // Never expose mentor_email in the public response
  return NextResponse.json({
    id: form.id,
    session_label: form.session_label,
    date: form.date,
    mode: form.mode,
    period: form.period,
    expires_at: form.expires_at,
    is_active: form.is_active && !is_expired,
    is_expired,
    submission_count: form.submission_count,
    public_url: buildPublicFormUrl(form.id, request),
  });
}

// Protected PATCH — mentors only
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  let user;
  try {
    user = requireRole(request.headers, ['mentor', 'manager']);
  } catch (error) {
    return responseFromError(error);
  }

  await ensureAttendanceFormsSheet();

  const form = await getAttendanceFormById(params.id);
  if (!form) return NextResponse.json({ message: 'Form not found' }, { status: 404 });

  if (form.mentor_email !== user.email) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = PatchFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: 'Validation failed', errors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const updates: Parameters<typeof updateAttendanceForm>[1] = {};
  if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active;
  if (parsed.data.expiry_minutes !== undefined) {
    updates.expires_at = new Date(Date.now() + parsed.data.expiry_minutes * 60_000).toISOString();
  }

  await updateAttendanceForm(params.id, updates);

  await appendAuditLog({
    user_email: user.email,
    actor_id: user.id,
    role: user.role,
    action: 'ATTENDANCE_FORM_UPDATED',
    entity_type: 'attendance_form',
    entity_id: params.id,
    payload: parsed.data,
    request,
  }).catch(() => undefined);

  return NextResponse.json({ success: true });
}
