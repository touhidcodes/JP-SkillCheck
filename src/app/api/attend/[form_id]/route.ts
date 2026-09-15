import { NextResponse } from 'next/server';
import { StudentSubmitSchema } from '@/lib/validations/attendance-form';
import {
  getAttendanceFormById,
  incrementSubmissionCount,
  isFormAcceptingSubmissions,
} from '@/lib/sheets/attendance-forms';
import { getStudentByEmail } from '@/lib/sheets/students';
import {
  getAttendanceRecord,
  upsertAttendanceLog,
} from '@/lib/sheets/attendance-logs';
import { appendAuditLog } from '@/lib/sheets/audit';
import { checkRateLimit } from '@/lib/security/rate-limit';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;
  return 'unknown';
}

function errorResponse(code: string, message: string, status: number) {
  return NextResponse.json(
    { success: false, code, message },
    { status, headers: CORS_HEADERS }
  );
}

function validationErrorResponse(errors: Record<string, string[] | undefined>) {
  return NextResponse.json(
    {
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors,
    },
    { status: 400, headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(
  request: Request,
  { params }: { params: { form_id: string } }
) {
  const clientIp = getClientIp(request.headers);
  const limited = await checkRateLimit(`attend:${clientIp}`, {
    max: 10,
    windowMs: 600_000,
  });
  if (limited) {
    return errorResponse(
      'RATE_LIMIT_EXCEEDED',
      'Too many requests. Please wait a few minutes and try again.',
      429
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_JSON', 'Invalid request body.', 400);
  }

  const parsed = StudentSubmitSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(parsed.error.flatten().fieldErrors);
  }

  const { full_name, email } = parsed.data;

  const form = await getAttendanceFormById(params.form_id);
  if (!form) {
    return errorResponse(
      'FORM_NOT_FOUND',
      'This attendance link is invalid. Please contact your instructor.',
      404
    );
  }

  if (!form.is_active) {
    return errorResponse(
      'FORM_INACTIVE',
      'This attendance form has been closed by your instructor.',
      410
    );
  }

  if (!isFormAcceptingSubmissions(form)) {
    return errorResponse(
      'FORM_EXPIRED',
      'This attendance form has expired.',
      410
    );
  }

  const student = await getStudentByEmail(email);
  if (!student) {
    return errorResponse(
      'STUDENT_NOT_FOUND',
      'No student found with this email address. Please check with your mentor.',
      404
    );
  }

  if (student.mentor_email !== form.mentor_email) {
    return errorResponse(
      'STUDENT_NOT_IN_COHORT',
      'This email address is not registered in this cohort.',
      403
    );
  }

  const existingRecord = await getAttendanceRecord({
    student_id: student.id,
    session_id: form.session_id,
    period: form.period,
  });
  if (existingRecord?.present === true) {
    return errorResponse(
      'ALREADY_SUBMITTED',
      `Your attendance for "${form.session_label}" has already been recorded.`,
      409
    );
  }

  await upsertAttendanceLog({
    student_id: student.id,
    date: form.date,
    present: true,
    logged_by: form.mentor_email,
    session_label: form.session_label,
    session_id: form.session_id,
    mode: form.mode,
    period: form.period,
    duration_minutes: form.duration_minutes,
    topic_tags: form.topic_tags,
    source: 'student_form',
    status_label: 'Present',
    status_color: 'emerald',
    status_emoji: '✓',
    attendance_note: `Self-submitted via attendance form. Submitted name: ${full_name}`,
  });

  await incrementSubmissionCount(params.form_id).catch(() => undefined);

  await appendAuditLog({
    user_email: email,
    role: 'student',
    action: 'STUDENT_SELF_ATTENDANCE_SUBMITTED',
    entity_type: 'student',
    entity_id: student.id,
    payload: {
      form_id: params.form_id,
      session_id: form.session_id,
      date: form.date,
      submitted_name: full_name,
    },
    request,
  }).catch(() => undefined);

  return NextResponse.json(
    {
      success: true,
      student_name: student.name,
      session_label: form.session_label,
      date: form.date,
    },
    { status: 201, headers: CORS_HEADERS }
  );
}
