/**
 * GET /api/risk-history
 *
 * Returns risk history records.
 *
 * Query params:
 *   student_id  — filter by student (optional)
 *
 * Response includes frequency counts so the UI can show
 * "this student has been at-risk N times".
 */

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import type { ApiError } from '@/lib/auth/helpers';
import { getAllRiskHistory, getRiskHistoryByStudent, getRiskFrequencyMap } from '@/lib/sheets/risk-history';

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'status' in e;
}

export async function GET(request: Request) {
  try {
    const user = requireRole(request.headers, ['manager', 'mentor']);
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');

    if (studentId) {
      const history = await getRiskHistoryByStudent(studentId);
      return NextResponse.json({
        data: history,
        total: history.length,
        times_at_risk: history.length,
      });
    }

    // Full history — mentors only see their own students' history
    let history = await getAllRiskHistory();
    if (user.role === 'mentor') {
      history = history.filter(e => e.mentor_email === user.email);
    }

    // Build frequency map for the response
    const freqMap = await getRiskFrequencyMap();
    const frequentlyAtRisk = Array.from(freqMap.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([studentId, count]) => ({ student_id: studentId, times_at_risk: count }));

    return NextResponse.json({
      data: history,
      total: history.length,
      frequently_at_risk: frequentlyAtRisk,
    });
  } catch (e) {
    const status = isApiError(e) ? e.status : 500;
    const message = isApiError(e) ? e.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}
