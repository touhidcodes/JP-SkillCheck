/**
 * GET /api/analytics-events
 *
 * Query params:
 *   student_id=X   — filter by student
 *   event_type=X   — filter by event type
 *   limit=N        — max results (default 50)
 *
 * Mentors can only see their own events. Managers can see all.
 */

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import type { ApiError } from '@/lib/auth/helpers';
import { getEventsByMentor, getEventsByStudent, type EventType } from '@/lib/sheets/analytics-events';

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'status' in e;
}

export async function GET(request: Request) {
  try {
    const user = requireRole(request.headers, ['manager', 'mentor']);
    const { searchParams } = new URL(request.url);

    const studentId = searchParams.get('student_id');
    const eventType = searchParams.get('event_type') as EventType | null;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let events;

    if (studentId) {
      events = await getEventsByStudent(studentId);
    } else {
      events = await getEventsByMentor(user.email, {
        limit,
        event_type: eventType || undefined,
      });
    }

    return NextResponse.json({ data: events, total: events.length });
  } catch (e) {
    const status = isApiError(e) ? e.status : 500;
    const message = isApiError(e) ? e.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}
