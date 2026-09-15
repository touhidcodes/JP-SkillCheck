import { NextResponse } from 'next/server';
import { deleteProgressLog } from '@/lib/sheets/progress-logs';
import { readSheet, findRowIndex, updateRow } from '@/lib/sheets/client';
import { requireRole } from '@/lib/auth/helpers';
import type { ApiError } from '@/lib/auth/helpers';
import type { ProgressLog } from '@/types';
import { z } from 'zod';

function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && 'status' in error;
}

function rowToProgressLog(row: string[]): ProgressLog {
  return {
    id: row[0] || '',
    student_id: row[1] || '',
    student_name: row[2] || '',
    student_email: row[3] || '',
    log_type: (row[4] as ProgressLog['log_type']) || 'Other',
    company_name: row[5] || '',
    scheduled_date: row[6] || '',
    scheduled_time: row[7] || '',
    note: row[8] || '',
    logged_at: row[9] || '',
    logged_by: row[10] || '',
    job_url: row[11] || '',
    mock_feedback: row[12] || '',
    mock_score: row[13] ? (() => { const n = parseInt(row[13], 10); return Number.isNaN(n) ? undefined : n; })() : undefined,
    mock_strengths: row[14] || '',
    mock_improvements: row[15] || '',
    mock_interview_type: (row[16] || undefined) as ProgressLog['mock_interview_type'],
    mock_interviewer: row[17] || '',
    company_id: row[18] || '',
    created_at: row[19] || row[9] || '',
    updated_at: row[20] || '',
    deleted_at: row[21] || '',
    deleted_by: row[22] || '',
  };
}

function progressLogToRow(log: ProgressLog): string[] {
  return [
    log.id,
    log.student_id,
    log.student_name,
    log.student_email,
    log.log_type,
    log.company_name,
    log.scheduled_date,
    log.scheduled_time,
    log.note,
    log.logged_at,
    log.logged_by,
    log.job_url ?? '',
    log.mock_feedback ?? '',
    log.mock_score !== undefined && log.mock_score !== null ? String(log.mock_score) : '',
    log.mock_strengths ?? '',
    log.mock_improvements ?? '',
    log.mock_interview_type ?? '',
    log.mock_interviewer ?? '',
    log.company_id ?? '',
    log.created_at ?? log.logged_at,
    log.updated_at ?? '',
    log.deleted_at ?? '',
    log.deleted_by ?? '',
  ];
}

const PatchSchema = z.object({
  company_name: z.string().max(200).optional(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  scheduled_time: z.string().max(20).optional().nullable(),
  note: z.string().max(1000).optional().nullable(),
  log_type: z.enum(['Interview Call', 'Job Applied', 'Mock Interview', 'Job Task', 'Offer', 'Other']).optional(),
  job_url: z.string().url().optional().nullable(),
  mock_feedback: z.string().max(1000).optional().nullable(),
  mock_score: z.number().int().min(1).max(10).optional().nullable(),
  mock_strengths: z.string().max(500).optional().nullable(),
  mock_improvements: z.string().max(500).optional().nullable(),
  mock_interview_type: z.enum(['technical', 'behavioral', 'system_design', 'hr', 'mock']).optional().nullable(),
  mock_interviewer: z.string().max(100).optional().nullable(),
});

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
      return NextResponse.json({ message: 'Validation failed', errors: result.error.flatten().fieldErrors }, { status: 400 });
    }

    const rowIndex = await findRowIndex('progress_logs', 0, id);
    if (rowIndex === -1) {
      return NextResponse.json({ message: 'Log not found' }, { status: 404 });
    }

    const rows = await readSheet('progress_logs');
    const existing = rowToProgressLog(rows[rowIndex - 1]);
    const updated: ProgressLog = {
      ...existing,
      ...result.data,
      scheduled_date: result.data.scheduled_date ?? existing.scheduled_date,
      scheduled_time: result.data.scheduled_time ?? existing.scheduled_time,
      note: result.data.note ?? existing.note,
      job_url: result.data.job_url ?? existing.job_url,
      mock_feedback: result.data.mock_feedback ?? existing.mock_feedback,
      mock_score: result.data.mock_score ?? existing.mock_score,
      mock_strengths: result.data.mock_strengths ?? existing.mock_strengths,
      mock_improvements: result.data.mock_improvements ?? existing.mock_improvements,
      mock_interview_type: result.data.mock_interview_type ?? existing.mock_interview_type,
      mock_interviewer: result.data.mock_interviewer ?? existing.mock_interviewer,
    };

    await updateRow('progress_logs', rowIndex, progressLogToRow(updated));
    return NextResponse.json({ data: updated });
  } catch (error: unknown) {
    const status = isApiError(error) ? error.status : 500;
    const message = isApiError(error) ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireRole(request.headers, ['manager', 'mentor']);
    const { id } = await params;

    await deleteProgressLog(id, user.email, user.role === 'manager');

    return NextResponse.json({ message: 'Deleted successfully' });
  } catch (error: unknown) {
    const status = isApiError(error) ? error.status : 500;
    const message = isApiError(error) ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}
