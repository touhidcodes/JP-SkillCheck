import { NextResponse } from 'next/server';
import { getAllStudents } from '@/lib/sheets/students';
import { requireRole } from '@/lib/auth/helpers';

export async function GET(request: Request) {
  try {
    requireRole(request.headers, ['manager']);
    const allStudents = await getAllStudents();

    const batchMap = new Map<string, {
      total: number;
      placed: number;
      hired: number;
      learning: number;
      applying: number;
      interviewing: number;
      offer_pending: number;
      active: number;
    }>();

    for (const student of allStudents) {
      const batch = student.batch || 'Unknown';
      if (!batchMap.has(batch)) {
        batchMap.set(batch, {
          total: 0, placed: 0, hired: 0,
          learning: 0, applying: 0, interviewing: 0, offer_pending: 0, active: 0,
        });
      }
      const entry = batchMap.get(batch)!;
      entry.total++;
      if (student.hired) { entry.hired++; entry.placed++; entry.active++; }
      else if (student.stage === 'placed') { entry.placed++; entry.active++; }
      else if (!student.terminated) { entry.active++; }

      if (student.stage === 'learning') entry.learning++;
      if (student.stage === 'applying') entry.applying++;
      if (student.stage === 'interviewing') entry.interviewing++;
      if (student.stage === 'offer_pending') entry.offer_pending++;
    }

    const cohorts = Array.from(batchMap.entries())
      .map(([batch, data]) => ({
        batch,
        total: data.total,
        active: data.active,
        placed: data.placed,
        hired: data.hired,
        placementRate: data.total > 0 ? Math.round((data.placed / data.total) * 100) : 0,
        hireRate: data.total > 0 ? Math.round((data.hired / data.total) * 100) : 0,
        learning: data.learning,
        applying: data.applying,
        interviewing: data.interviewing,
        offer_pending: data.offer_pending,
      }))
      .sort((a, b) => a.batch.localeCompare(b.batch));

    return NextResponse.json({ data: cohorts, total: cohorts.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}