/**
 * GET /api/admin/audit-log
 * Manager-only endpoint to query audit log entries.
 * Supports filtering by actor, action type, and date range.
 */

import { NextResponse } from 'next/server';
import { requirePermission, Permission } from '@/lib/security/permissions';
import { readSheet } from '@/lib/sheets/client';
import type { AuditAction } from '@/lib/security/audit-logger';

export async function GET(request: Request) {
  try {
    const checkPermission = requirePermission(Permission.ADMIN_AUDIT_VIEW);
    checkPermission(request.headers);

    const { searchParams } = new URL(request.url);
    const actorFilter = searchParams.get('actor');
    const actionFilter = searchParams.get('action') as AuditAction | null;
    const fromDate = searchParams.get('from');
    const toDate = searchParams.get('to');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = (page - 1) * limit;

    const rows = await readSheet('audit_log');

    if (rows.length === 0) {
      return NextResponse.json({ data: [], total: 0, page, limit });
    }

    const dataRows = rows.slice(1);

    let filtered = dataRows;

    if (actorFilter) {
      filtered = filtered.filter(row =>
        row[1] === actorFilter || row[2]?.toLowerCase().includes(actorFilter.toLowerCase())
      );
    }

    if (actionFilter) {
      filtered = filtered.filter(row => row[4] === actionFilter);
    }

    if (fromDate) {
      filtered = filtered.filter(row => row[10] >= fromDate);
    }

    if (toDate) {
      filtered = filtered.filter(row => row[10] <= toDate + 'T23:59:59.999Z');
    }

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    const formatted = paginated.map((row) => {
      let metadata: Record<string, unknown> = {};
      try {
        metadata = row[7] ? JSON.parse(row[7]) : {};
      } catch {
        metadata = { raw: row[7] };
      }
      return {
        id: row[0],
        actor_id: row[1],
        actor_email: row[2],
        actor_role: row[3],
        action: row[4],
        target_type: row[5],
        target_id: row[6],
        metadata,
        ip_address: row[8],
        user_agent: row[9],
        created_at: row[10],
      };
    });

    return NextResponse.json({
      data: formatted,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const status = error instanceof Error && message.includes('Unauthorized') ? 401 : 500;
    return NextResponse.json({ message }, { status });
  }
}

export const runtime = 'nodejs';