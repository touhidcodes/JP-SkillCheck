/**
 * GET    /api/warnings              — list warnings (filterable)
 * POST   /api/warnings              — create a warning
 * PATCH  /api/warnings/[id]         — resolve or escalate a warning
 *
 * Query params (GET):
 *   student_id=X   — filter by student
 *   mentor_email=X — filter by mentor
 *   status=X       — open | resolved
 *   severity=X     — yellow | orange | red
 */

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import type { ApiError } from '@/lib/auth/helpers';
import {
  getWarnings,
  createWarning,
  resolveWarning,
  escalateWarning,
  type WarningSeverity,
  type WarningStatus,
} from '@/lib/sheets/warnings';

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'status' in e;
}

export async function GET(request: Request) {
  try {
    const user = requireRole(request.headers, ['manager', 'mentor']);
    const { searchParams } = new URL(request.url);

    const warnings = await getWarnings({
      studentId: searchParams.get('student_id') || undefined,
      mentorEmail: user.role === 'mentor' ? user.email : searchParams.get('mentor_email') || undefined,
      status: (searchParams.get('status') as WarningStatus | null) || undefined,
      severity: (searchParams.get('severity') as WarningSeverity | null) || undefined,
    });

    return NextResponse.json({ data: warnings, total: warnings.length });
  } catch (e) {
    const status = isApiError(e) ? e.status : 500;
    const message = isApiError(e) ? e.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = requireRole(request.headers, ['manager', 'mentor']);
    const body = await request.json();

    const { student_id, student_name, severity, reason, evidence_notes } = body;

    if (!student_id || !severity || !reason) {
      return NextResponse.json(
        { message: 'student_id, severity, and reason are required' },
        { status: 400 }
      );
    }

    const validSeverities: WarningSeverity[] = ['yellow', 'orange', 'red'];
    if (!validSeverities.includes(severity)) {
      return NextResponse.json(
        { message: 'severity must be yellow, orange, or red' },
        { status: 400 }
      );
    }

    const warning = await createWarning({
      student_id,
      student_name: student_name || '',
      mentor_email: user.email,
      severity,
      reason,
      evidence_notes: evidence_notes || '',
      status: 'open',
      created_by: user.email,
    });

    return NextResponse.json({ data: warning }, { status: 201 });
  } catch (e) {
    const status = isApiError(e) ? e.status : 500;
    const message = isApiError(e) ? e.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = requireRole(request.headers, ['manager', 'mentor']);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const action = searchParams.get('action');

    if (!id) {
      return NextResponse.json({ message: 'id query param is required' }, { status: 400 });
    }

    if (action === 'resolve') {
      const resolutionNotes = (await request.json()).resolution_notes || '';
      const warning = await resolveWarning(id, user.email, resolutionNotes);
      if (!warning) {
        return NextResponse.json({ message: 'Warning not found' }, { status: 404 });
      }
      return NextResponse.json({ data: warning });
    }

    if (action === 'escalate') {
      const warning = await escalateWarning(id);
      if (!warning) {
        return NextResponse.json({ message: 'Warning not found' }, { status: 404 });
      }
      return NextResponse.json({ data: warning });
    }

    return NextResponse.json({ message: 'Invalid action. Use resolve or escalate' }, { status: 400 });
  } catch (e) {
    const status = isApiError(e) ? e.status : 500;
    const message = isApiError(e) ? e.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}
