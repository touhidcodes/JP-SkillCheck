/**
 * GET /api/risk — returns students with risk data for the authenticated user
 * POST /api/risk — triggers a manual risk scan (manager only)
 *
 * GET query params:
 *   status  'all' | 'at_risk' | 'concern' | 'watch'  (default: 'at_risk')
 *   — mentors see only their own students, managers see all
 */

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import { getAllStudents } from '@/lib/sheets/students';
import { runRiskScan } from '@/lib/risk/engine';
import type { ApiError } from '@/lib/auth/helpers';

function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && 'status' in error;
}

export async function GET(request: Request) {
  try {
    const user = requireRole(request.headers, ['manager', 'mentor']);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'at_risk';

    let students = await getAllStudents();

    // Mentors only see their own students
    if (user.role === 'mentor') {
      students = students.filter(s => s.mentor_email === user.email);
    }

    // Filter out terminated/hired
    students = students.filter(s => !s.terminated && !s.hired);

    let filtered: typeof students;
    if (status === 'all') {
      // Show all students with any risk signal (probability > 0)
      filtered = students.filter(s => (s.risk_probability || 0) > 0);
    } else if (status === 'at_risk') {
      // Binary at_risk flag
      filtered = students.filter(s => s.risk_status === 'at_risk');
    } else {
      // Filter by risk_band
      filtered = students.filter(s => s.risk_band === status);
    }

    // Sort by risk probability descending
    filtered.sort((a, b) => (b.risk_probability || 0) - (a.risk_probability || 0));

    return NextResponse.json({
      data: filtered,
      total: filtered.length,
    });
  } catch (error: unknown) {
    const status = isApiError(error) ? error.status : 500;
    const message = isApiError(error) ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    requireRole(request.headers, ['manager']);

    const result = await runRiskScan();

    return NextResponse.json({
      success: true,
      updated: result.updated,
      newly_at_risk: result.newly_at_risk,
      newly_resolved: result.newly_resolved,
      band_updated: result.band_updated.length,
      skipped_terminated: result.skipped_terminated,
    });
  } catch (error: unknown) {
    const status = isApiError(error) ? error.status : 500;
    const message = isApiError(error) ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}
