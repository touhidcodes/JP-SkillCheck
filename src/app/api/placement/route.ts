import { NextResponse } from 'next/server';
import { getAllStudents } from '@/lib/sheets/students';
import { requireRole } from '@/lib/auth/helpers';
import type { PlacementStats, StudentStage } from '@/types';
import { differenceInDays } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const user = requireRole(request.headers, ['manager', 'mentor']);
    let students = await getAllStudents();

    // Scope to the mentor's own students only
    if (user.role === 'mentor') {
      students = students.filter(s => s.mentor_email === user.email);
    }

    const now = new Date();

    const stats: PlacementStats = {
      learning: 0,
      applying: 0,
      interviewing: 0,
      offer_pending: 0,
      placed: 0,
      hired: 0,
    };

    const studentsByStage: Record<StudentStage, { id: string; name: string; batch: string; days_in_stage: number; risk_status?: string; job_focus?: string; project?: string }[]> = {
      learning: [],
      applying: [],
      interviewing: [],
      offer_pending: [],
      placed: [],
      hired: [],
    };

    for (const student of students) {
      if (student.terminated) continue; // exclude terminated from pipeline
      const daysInStage = differenceInDays(now, new Date(student.updated_at));
      const stage = student.hired ? 'hired' : student.stage;
      if (stage in stats) {
        stats[stage as keyof PlacementStats]++;
        studentsByStage[stage as StudentStage].push({
          id: student.id,
          name: student.name,
          batch: student.batch,
          days_in_stage: daysInStage,
          risk_status: student.risk_status,
          job_focus: student.job_focus,
          project: student.project,
        });
      }
    }

    return NextResponse.json({ ...stats, students_by_stage: studentsByStage });
  } catch (error: unknown) {
    console.error('[Placement] Error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  }
}