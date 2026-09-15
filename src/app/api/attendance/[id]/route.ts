import { NextResponse } from 'next/server';
import { readSheet, findRowIndex, updateRow } from '@/lib/sheets/client';
import { requireRole } from '@/lib/auth/helpers';
import type { ApiError } from '@/lib/auth/helpers';
import { z } from 'zod';

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'status' in e;
}

type AttendanceRow = string[];

function rowToLog(row: string[]): Record<string, string | boolean> {
  return {
    id: row[0] || '',
    student_id: row[1] || '',
    date: row[2] || '',
    present: row[3] === 'true',
    logged_by: row[4] || '',
    session_label: row[5] || '',
    excuse: row[6] || '',
    excuse_note: row[7] || '',
    created_at: row[8] || '',
    updated_at: row[9] || '',
    deleted_at: row[10] || '',
    deleted_by: row[11] || '',
    session_id: row[12] || '',
    mode: row[13] || 'session',
    period: row[14] || 'full_day',
    duration_minutes: row[15] || '',
    topic_tags: row[16] || '',
    source: row[17] || 'manual',
    attendance_note: row[18] || '',
    status_label: row[19] || '',
    status_color: row[20] || '',
    status_emoji: row[21] || '',
    notified_at: row[22] || '',
  };
}

const PatchSchema = z.object({
  present: z.boolean().optional(),
  session_label: z.string().max(100).optional(),
  excuse: z.enum(['exam', 'sick', 'personal', 'other']).optional(),
  excuse_note: z.string().max(200).optional(),
  attendance_note: z.string().max(300).optional(),
  source: z.string().max(40).optional(),
}).refine(
  data => {
    if (data.excuse === 'other' && data.present === false) {
      return !!data.excuse_note && data.excuse_note.trim() !== '';
    }
    return true;
  },
  { message: 'A note is required when the excuse is "other"', path: ['excuse_note'] }
);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireRole(request.headers, ['manager', 'mentor']);
    const { id } = await params;
    const body = await request.json();
    const result = PatchSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const rowIndex = await findRowIndex('attendance_logs', 0, id);
    if (rowIndex === -1) {
      return NextResponse.json({ message: 'Attendance record not found' }, { status: 404 });
    }

    const rows = await readSheet('attendance_logs');
    const existing = rowToLog(rows[rowIndex - 1]) as Record<string, string | boolean>;
    const updated: Record<string, string | boolean> = { ...existing, ...result.data };

    const newRow: AttendanceRow = [
      id,
      updated.student_id as string,
      updated.date as string,
      String(updated.present),
      updated.logged_by as string,
      updated.session_label as string,
      // Only keep excuse fields when the final present state is false
      updated.present ? '' : (updated.excuse as string || ''),
      updated.present ? '' : (updated.excuse_note as string || ''),
      updated.created_at as string || new Date().toISOString(),
      new Date().toISOString(),
      updated.deleted_at as string || '',
      updated.deleted_by as string || '',
      updated.session_id as string || '',
      updated.mode as string || 'session',
      updated.period as string || 'full_day',
      updated.duration_minutes as string || '',
      updated.topic_tags as string || '',
      updated.source as string || 'manual',
      updated.attendance_note as string || '',
      updated.status_label as string || '',
      updated.status_color as string || '',
      updated.status_emoji as string || '',
      updated.notified_at as string || '',
    ];

    await updateRow('attendance_logs', rowIndex, newRow);
    return NextResponse.json({ data: rowToLog(newRow) });
  } catch (error: unknown) {
    const status = isApiError(error) ? error.status : 500;
    const message = isApiError(error) ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}
