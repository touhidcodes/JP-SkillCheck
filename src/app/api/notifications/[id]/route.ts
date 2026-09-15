/**
 * PATCH /api/notifications/[id]     — mark single notification as read
 * PATCH /api/notifications/read-all — mark all as read (id = "read-all")
 */

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import type { ApiError } from '@/lib/auth/helpers';
import { markNotificationRead, markAllNotificationsRead } from '@/lib/sheets/notifications';

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'status' in e;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireRole(request.headers, ['manager', 'mentor']);
    const { id } = await params;

    if (id === 'read-all') {
      const count = await markAllNotificationsRead(user.email);
      return NextResponse.json({ success: true, marked_count: count });
    }

    await markNotificationRead(id, user.email);
    return NextResponse.json({ success: true });
  } catch (e) {
    const status = isApiError(e) ? e.status : 500;
    const message = isApiError(e) ? e.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}
