import { beforeEach, describe, expect, it, vi } from 'vitest';

const sharedMocks = vi.hoisted(() => ({
  getAttendanceFormById: vi.fn(),
  incrementSubmissionCount: vi.fn(),
  isFormAcceptingSubmissions: vi.fn(),
  getStudentByEmail: vi.fn(),
  getAttendanceRecord: vi.fn(),
  upsertAttendanceLog: vi.fn(),
  appendAuditLog: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/sheets/attendance-forms', () => ({
  getAttendanceFormById: sharedMocks.getAttendanceFormById,
  incrementSubmissionCount: sharedMocks.incrementSubmissionCount,
  isFormAcceptingSubmissions: sharedMocks.isFormAcceptingSubmissions,
}));
vi.mock('@/lib/sheets/students', () => ({
  getStudentByEmail: sharedMocks.getStudentByEmail,
}));
vi.mock('@/lib/sheets/attendance-logs', () => ({
  getAttendanceRecord: sharedMocks.getAttendanceRecord,
  upsertAttendanceLog: sharedMocks.upsertAttendanceLog,
}));
vi.mock('@/lib/sheets/audit', () => ({
  appendAuditLog: sharedMocks.appendAuditLog,
}));
vi.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: sharedMocks.checkRateLimit,
}));

import { OPTIONS, POST } from '@/app/api/attend/[form_id]/route';

function makeRequest(body?: unknown, headers?: HeadersInit): Request {
  return new Request('https://app.test/api/attend/form-123', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(headers || {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function makeForm(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: 'form-123',
    mentor_email: 'mentor@example.com',
    session_id: 'session-abc',
    session_label: 'Morning Session',
    date: '2099-05-17',
    mode: 'session' as const,
    period: 'full_day' as const,
    expires_at: '2099-05-17T10:00:00.000Z',
    created_at: '2099-05-17T08:00:00.000Z',
    is_active: true,
    submission_count: 0,
    topic_tags: 'frontend,react',
    duration_minutes: 90,
    ...overrides,
  };
}

function makeStudent(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: 'student-1',
    name: 'Jane Doe',
    mentor_email: 'mentor@example.com',
    student_email: 'jane@cohort.com',
    ...overrides,
  };
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe('POST /api/attend/[form_id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedMocks.checkRateLimit.mockResolvedValue(false);
    sharedMocks.getAttendanceFormById.mockResolvedValue(makeForm());
    sharedMocks.isFormAcceptingSubmissions.mockReturnValue(true);
    sharedMocks.getStudentByEmail.mockResolvedValue(makeStudent());
    sharedMocks.getAttendanceRecord.mockResolvedValue(null);
    sharedMocks.upsertAttendanceLog.mockResolvedValue({ id: 'attendance-1' });
    sharedMocks.incrementSubmissionCount.mockResolvedValue(undefined);
    sharedMocks.appendAuditLog.mockResolvedValue(undefined);
  });

  it('returns 201 and writes attendance_logs on valid submission', async () => {
    const response = await POST(
      makeRequest({ full_name: '  Jane Doe  ', email: 'JANE@COHORT.COM' }, {
        'x-forwarded-for': '203.0.113.10',
      }),
      { params: { form_id: 'form-123' } },
    );

    expect(response.status).toBe(201);
    expect(sharedMocks.upsertAttendanceLog).toHaveBeenCalledWith(
      expect.objectContaining({
        student_id: 'student-1',
        date: '2099-05-17',
        present: true,
        logged_by: 'mentor@example.com',
        session_label: 'Morning Session',
        session_id: 'session-abc',
        mode: 'session',
        period: 'full_day',
        duration_minutes: 90,
        topic_tags: 'frontend,react',
        source: 'student_form',
        status_label: 'Present',
        status_color: 'emerald',
        status_emoji: '✓',
        attendance_note: 'Self-submitted via attendance form. Submitted name: Jane Doe',
      }),
    );
    expect(sharedMocks.incrementSubmissionCount).toHaveBeenCalledWith('form-123');
    expect(sharedMocks.appendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        user_email: 'jane@cohort.com',
        role: 'student',
        action: 'STUDENT_SELF_ATTENDANCE_SUBMITTED',
        entity_type: 'student',
        entity_id: 'student-1',
      }),
    );

    const upsertOrder = sharedMocks.upsertAttendanceLog.mock.invocationCallOrder[0];
    const incrementOrder = sharedMocks.incrementSubmissionCount.mock.invocationCallOrder[0];
    expect(upsertOrder).toBeLessThan(incrementOrder);

    const body = await readJson(response);
    expect(body).toMatchObject({
      success: true,
      student_name: 'Jane Doe',
      session_label: 'Morning Session',
      date: '2099-05-17',
    });
  });

  it('returns 410 FORM_INACTIVE when is_active is false', async () => {
    sharedMocks.getAttendanceFormById.mockResolvedValue(makeForm({ is_active: false }));

    const response = await POST(
      makeRequest({ full_name: 'Jane Doe', email: 'jane@cohort.com' }),
      { params: { form_id: 'form-123' } },
    );

    expect(response.status).toBe(410);
    const body = await readJson(response);
    expect(body).toMatchObject({
      success: false,
      code: 'FORM_INACTIVE',
    });
  });

  it('returns 410 FORM_EXPIRED when expires_at is in the past', async () => {
    sharedMocks.isFormAcceptingSubmissions.mockReturnValue(false);
    sharedMocks.getAttendanceFormById.mockResolvedValue(
      makeForm({ expires_at: '2020-01-01T00:00:00.000Z' }),
    );

    const response = await POST(
      makeRequest({ full_name: 'Jane Doe', email: 'jane@cohort.com' }),
      { params: { form_id: 'form-123' } },
    );

    expect(response.status).toBe(410);
    const body = await readJson(response);
    expect(body).toMatchObject({
      success: false,
      code: 'FORM_EXPIRED',
    });
    expect(sharedMocks.upsertAttendanceLog).not.toHaveBeenCalled();
  });

  it('returns 404 FORM_NOT_FOUND for unknown form_id', async () => {
    sharedMocks.getAttendanceFormById.mockResolvedValue(null);

    const response = await POST(
      makeRequest({ full_name: 'Jane Doe', email: 'jane@cohort.com' }),
      { params: { form_id: 'missing-form' } },
    );

    expect(response.status).toBe(404);
    const body = await readJson(response);
    expect(body).toMatchObject({
      success: false,
      code: 'FORM_NOT_FOUND',
    });
  });

  it('returns 404 STUDENT_NOT_FOUND for unregistered email', async () => {
    sharedMocks.getStudentByEmail.mockResolvedValue(null);

    const response = await POST(
      makeRequest({ full_name: 'Jane Doe', email: 'missing@cohort.com' }),
      { params: { form_id: 'form-123' } },
    );

    expect(response.status).toBe(404);
    const body = await readJson(response);
    expect(body).toMatchObject({
      success: false,
      code: 'STUDENT_NOT_FOUND',
    });
  });

  it('returns 403 STUDENT_NOT_IN_COHORT when student belongs to different mentor', async () => {
    sharedMocks.getStudentByEmail.mockResolvedValue(
      makeStudent({ mentor_email: 'other-mentor@example.com' }),
    );

    const response = await POST(
      makeRequest({ full_name: 'Jane Doe', email: 'jane@cohort.com' }),
      { params: { form_id: 'form-123' } },
    );

    expect(response.status).toBe(403);
    const body = await readJson(response);
    expect(body).toMatchObject({
      success: false,
      code: 'STUDENT_NOT_IN_COHORT',
    });
  });

  it('returns 409 ALREADY_SUBMITTED when student already has a present record for this session', async () => {
    sharedMocks.getAttendanceRecord.mockResolvedValue({ present: true });

    const response = await POST(
      makeRequest({ full_name: 'Jane Doe', email: 'jane@cohort.com' }),
      { params: { form_id: 'form-123' } },
    );

    expect(response.status).toBe(409);
    const body = await readJson(response);
    expect(body).toMatchObject({
      success: false,
      code: 'ALREADY_SUBMITTED',
    });
    expect(sharedMocks.upsertAttendanceLog).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR for missing full_name', async () => {
    const response = await POST(
      makeRequest({ full_name: '', email: 'jane@cohort.com' }),
      { params: { form_id: 'form-123' } },
    );

    expect(response.status).toBe(400);
    const body = await readJson(response);
    expect(body).toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
    });
    expect(body.errors).toHaveProperty('full_name');
  });

  it('returns 400 VALIDATION_ERROR for invalid email format', async () => {
    const response = await POST(
      makeRequest({ full_name: 'Jane Doe', email: 'not-an-email' }),
      { params: { form_id: 'form-123' } },
    );

    expect(response.status).toBe(400);
    const body = await readJson(response);
    expect(body).toMatchObject({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
    });
    expect(body.errors).toHaveProperty('email');
  });

  it('calls incrementSubmissionCount after successful write', async () => {
    await POST(
      makeRequest({ full_name: 'Jane Doe', email: 'jane@cohort.com' }),
      { params: { form_id: 'form-123' } },
    );

    expect(sharedMocks.incrementSubmissionCount).toHaveBeenCalledWith('form-123');
    const upsertOrder = sharedMocks.upsertAttendanceLog.mock.invocationCallOrder[0];
    const incrementOrder = sharedMocks.incrementSubmissionCount.mock.invocationCallOrder[0];
    expect(upsertOrder).toBeLessThan(incrementOrder);
  });

  it('OPTIONS returns 204 with correct CORS headers', async () => {
    const response = await OPTIONS();

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
  });

  it('POST returns 429 RATE_LIMIT_EXCEEDED after 10 requests from same IP within 10 minutes', async () => {
    sharedMocks.checkRateLimit
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    for (let i = 0; i < 10; i += 1) {
      const response = await POST(
        makeRequest({ full_name: 'Jane Doe', email: 'jane@cohort.com' }, {
          'x-forwarded-for': '198.51.100.20',
        }),
        { params: { form_id: 'form-123' } },
      );
      expect(response.status).not.toBe(429);
    }

    const response = await POST(
      makeRequest({ full_name: 'Jane Doe', email: 'jane@cohort.com' }, {
        'x-forwarded-for': '198.51.100.20',
      }),
      { params: { form_id: 'form-123' } },
    );

    expect(response.status).toBe(429);
    const body = await readJson(response);
    expect(body).toMatchObject({
      success: false,
      code: 'RATE_LIMIT_EXCEEDED',
    });
  });
});
