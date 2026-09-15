import { readSheet, appendRow, findRowIndex, deleteRow } from './client';
import type { ProgressLog, ProgressLogType } from '@/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Sheet columns (23 total, with additive production columns):
 *  0: id
 *  1: student_id
 *  2: student_name
 *  3: student_email
 *  4: log_type
 *  5: company_name
 *  6: scheduled_date
 *  7: scheduled_time
 *  8: note
 *  9: logged_at
 * 10: logged_by
 * 11: job_url        (new — "Job Applied" logs)
 * 12: mock_feedback  (existing — "Mock Interview" logs)
 * 13: mock_score     (new — "Mock Interview" score 1–10)
 * 14: mock_strengths (new — "Mock Interview" strengths)
 * 15: mock_improvements (new — "Mock Interview" improvements)
 * 16: mock_interview_type (new — technical/behavioral/system_design/hr/mock)
 * 17: mock_interviewer (new — interviewer name)
 * 18: company_id      (canonical companies.id; company_name retained for display/backfill)
 * 19: created_at
 * 20: updated_at
 * 21: deleted_at
 * 22: deleted_by
 */
function rowToProgressLog(row: string[]): ProgressLog {
  return {
    id: row[0] || '',
    student_id: row[1] || '',
    student_name: row[2] || '',
    student_email: row[3] || '',
    log_type: (row[4] as ProgressLogType) || 'Other',
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
    mock_interview_type: row[16] as ProgressLog['mock_interview_type'] || undefined,
    mock_interviewer: row[17] || '',
    company_id: row[18] || '',
    created_at: row[19] || row[9] || '',
    updated_at: row[20] || '',
    deleted_at: row[21] || '',
    deleted_by: row[22] || '',
  };
}

export function progressLogToRow(log: ProgressLog): unknown[] {
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
    log.mock_score ?? '',
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

export async function getProgressLogsByStudent(studentId: string): Promise<ProgressLog[]> {
  const rows = await readSheet('progress_logs');
  return rows
    .map(rowToProgressLog)
    .filter(log => log.student_id === studentId)
    .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());
}

export async function getProgressLogsByMentor(mentorEmail: string): Promise<ProgressLog[]> {
  const rows = await readSheet('progress_logs');
  return rows
    .map(rowToProgressLog)
    .filter(log => log.logged_by === mentorEmail)
    .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());
}

export async function getAllProgressLogs(): Promise<ProgressLog[]> {
  const rows = await readSheet('progress_logs');
  return rows
    .map(rowToProgressLog)
    .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());
}

export async function createProgressLog(
  data: Omit<ProgressLog, 'id' | 'logged_at'>
): Promise<ProgressLog> {
  const log: ProgressLog = {
    ...data,
    id: uuidv4(),
    logged_at: new Date().toISOString(),
  };
  await appendRow('progress_logs', progressLogToRow(log));
  return log;
}

export async function deleteProgressLog(id: string, requesterEmail: string, isAdmin: boolean): Promise<void> {
  const rowIndex = await findRowIndex('progress_logs', 0, id);
  if (rowIndex === -1) throw Object.assign(new Error('Log not found'), { status: 404 });

  const rows = await readSheet('progress_logs');
  const existing = rowToProgressLog(rows[rowIndex - 2]);

  if (!isAdmin && existing.logged_by !== requesterEmail) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }

  await deleteRow('progress_logs', rowIndex);
}
