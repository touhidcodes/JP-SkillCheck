import { NextResponse } from 'next/server';
import { getAllStudents } from '@/lib/sheets/students';
import { requireRole } from '@/lib/auth/helpers';
import type { ApiError } from '@/lib/auth/helpers';

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'status' in e;
}

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    requireRole(request.headers, ['manager']);

    const allStudents = await getAllStudents();

    // Aggregate mentor-level data only — no individual student data exposed
    const mentorEmails = Array.from(new Set(allStudents.map(s => s.mentor_email).filter(Boolean)));
    const mentorsCount = mentorEmails.length;
    const activeStudents = allStudents.filter(s => !s.terminated);
    const avgStudentsPerMentor = mentorsCount > 0 ? Math.round(activeStudents.length / mentorsCount) : 0;
    const totalHired = allStudents.filter(s => s.hired).length;

    // Per-mentor aggregates (no individual student info)
    const mentorStats = mentorEmails.map(email => {
      const menteeList = allStudents.filter(s => s.mentor_email === email);
      const active = menteeList.filter(s => !s.terminated).length;
      const hired = menteeList.filter(s => s.hired).length;
      const atRisk = menteeList.filter(s => s.risk_status === 'at_risk' && !s.terminated && !s.hired).length;
      const placementRate = menteeList.length > 0 ? Math.round((hired / menteeList.length) * 100) : 0;
      return { email, total: menteeList.length, active, hired, atRisk, placementRate };
    });

    return NextResponse.json({
      mentorsCount,
      avgStudentsPerMentor,
      totalHired,
      mentorStats,
    });
  } catch (e) {
    const status = isApiError(e) ? e.status : 500;
    const message = isApiError(e) ? e.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}
