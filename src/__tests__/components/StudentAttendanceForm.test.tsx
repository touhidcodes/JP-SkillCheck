// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: mocks.useRouter,
}));

import { StudentAttendanceForm } from '@/components/attendance/StudentAttendanceForm';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mocks.push.mockReset();
  mocks.useRouter.mockReturnValue({ push: mocks.push });
});

const baseFormMeta = {
  id: 'form-123',
  session_label: 'Morning Session',
  date: '2099-05-17',
  is_active: true,
  is_expired: false,
};

function mockFetch(response: { ok?: boolean; status?: number; json?: unknown } | (() => Promise<Response>)) {
  global.fetch = vi.fn(async () => {
    if (typeof response === 'function') return response();
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: async () => response.json ?? {},
    } as Response;
  }) as typeof fetch;
}

function renderForm(overrides?: Partial<typeof baseFormMeta>) {
  return render(<StudentAttendanceForm formMeta={{ ...baseFormMeta, ...overrides }} />);
}

describe('StudentAttendanceForm', () => {
  it('Renders session label and date as read-only display elements (not editable inputs)', () => {
    renderForm();

    // Session label appears in the heading and in the read-only info block — both are non-editable
    expect(screen.getAllByText('Morning Session').length).toBeGreaterThanOrEqual(1);
    // Date appears in the subtitle and in the read-only info block
    expect(screen.getAllByText('Sunday, May 17, 2099').length).toBeGreaterThanOrEqual(1);
    // Only the two student-input textboxes (Full Name, Email) should be editable
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    // No textbox labelled "session" or "date" — those are display divs
    expect(screen.queryByRole('textbox', { name: /session/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /date/i })).not.toBeInTheDocument();
  });

  it('Renders Full Name and Email inputs', () => {
    renderForm();

    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });

  it('Submit button shows "Submitting…" while in flight', async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    mockFetch(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    renderForm();
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'jane@cohort.com' } });
    fireEvent.click(screen.getByRole('button', { name: /submit attendance/i }));

    expect(screen.getByRole('button', { name: /submitting…/i })).toBeInTheDocument();
    resolveFetch?.(
      new Response(JSON.stringify({ success: true }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
  });

  it('Shows inline error under Full Name when submitted empty', async () => {
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: /submit attendance/i }));

    expect(await screen.findByText(/full name must be at least 2 characters/i)).toBeInTheDocument();
  });

  it('Shows inline error under Email when submitted with invalid format', async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'not-an-email' } });
    fireEvent.click(screen.getByRole('button', { name: /submit attendance/i }));

    expect(await screen.findByText(/please enter a valid email address/i)).toBeInTheDocument();
  });

  it('Calls POST /api/attend/[form_id] with correct body on valid submit', async () => {
    mockFetch({ ok: true, status: 201, json: { success: true } });

    renderForm();
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: '  Jane Doe  ' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: '  JANE@COHORT.COM  ' } });
    fireEvent.click(screen.getByRole('button', { name: /submit attendance/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/attend/form-123',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: 'Jane Doe', email: 'jane@cohort.com' }),
      }),
    );
  });

  it('Redirects to /attend/[form_id]/success on 201 response', async () => {
    mockFetch({ ok: true, status: 201, json: { success: true } });

    renderForm();
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'jane@cohort.com' } });
    fireEvent.click(screen.getByRole('button', { name: /submit attendance/i }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/attend/form-123/success'));
  });

  it('Shows STUDENT_NOT_FOUND error under the email field', async () => {
    mockFetch({ ok: false, status: 404, json: { code: 'STUDENT_NOT_FOUND', message: 'No student found with this email address.' } });

    renderForm();
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'missing@cohort.com' } });
    fireEvent.click(screen.getByRole('button', { name: /submit attendance/i }));

    expect(await screen.findByText(/no student found with this email address/i)).toBeInTheDocument();
  });

  it('Shows ALREADY_SUBMITTED full-page state when server returns 409', async () => {
    mockFetch({ ok: false, status: 409, json: { code: 'ALREADY_SUBMITTED', message: 'Already recorded' } });

    renderForm();
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'jane@cohort.com' } });
    fireEvent.click(screen.getByRole('button', { name: /submit attendance/i }));

    expect(await screen.findByRole('heading', { name: /already recorded/i })).toBeInTheDocument();
    expect(screen.getByText('Already recorded')).toBeInTheDocument();
  });

  it('Shows form-closed state when formMeta.is_active is false', () => {
    renderForm({ is_active: false });

    expect(screen.getByRole('heading', { name: /form closed/i })).toBeInTheDocument();
  });

  it('Shows form-closed state when formMeta.is_expired is true', () => {
    renderForm({ is_expired: true });

    expect(screen.getByRole('heading', { name: /form closed/i })).toBeInTheDocument();
  });

  it('Retry button appears for NETWORK_ERROR', async () => {
    mockFetch(() => Promise.reject(new Error('offline')));

    renderForm();
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Doe' } });
    fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: 'jane@cohort.com' } });
    fireEvent.click(screen.getByRole('button', { name: /submit attendance/i }));

    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
