/**
 * GET  /api/notifications          — get notifications for current user
 * POST /api/notifications/read-all — mark all as read
 *
 * Query params (GET):
 *   unread_only=true  — only return unread notifications
 *   limit=N           — max results (default 20)
 */

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import type { ApiError } from '@/lib/auth/helpers';
import { getNotificationsForUser, markAllNotificationsRead } from '@/lib/sheets/notifications';

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'status' in e;
}

export async function GET(request: Request) {
  try {
    const user = requireRole(request.headers, ['manager', 'mentor']);
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unread_only') === 'true';
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const notifications = await getNotificationsForUser(user.email, unreadOnly);
    const unreadCount = notifications.filter(n => !n.read).length;

    return NextResponse.json({
      data: notifications.slice(0, limit),
      total: notifications.length,
      unread_count: unreadCount,
    });
  } catch (e) {
    const status = isApiError(e) ? e.status : 500;
    const message = isApiError(e) ? e.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = requireRole(request.headers, ['manager', 'mentor']);
    const { searchParams } = new URL(request.url);
    if (searchParams.get('action') === 'read-all') {
      const count = await markAllNotificationsRead(user.email);
      return NextResponse.json({ success: true, marked_count: count });
    }
    return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
  } catch (e) {
    const status = isApiError(e) ? e.status : 500;
    const message = isApiError(e) ? e.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}
