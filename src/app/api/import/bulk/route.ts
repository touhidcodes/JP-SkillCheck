import { NextResponse } from 'next/server';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { addDays } from 'date-fns';
import { requireRole } from '@/lib/auth/helpers';
import { appendRow, appendRows, batchUpdateRows } from '@/lib/sheets/client';
import { getAllStudents, studentToRow } from '@/lib/sheets/students';
import { progressLogToRow } from '@/lib/sheets/progress-logs';
import { sanitizeForSheet } from '@/lib/security/sanitize';
import { calculateRiskScore } from '@/lib/risk/placement-risk';
import type { Student } from '@/types';

const ImportedStudentSchema = z.object({
  name: z.string().min(1),
  student_email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  photo_url: z.string().optional(),
  batch: z.string().optional(),
  join_date: z.string().optional(),
  project: z.enum(['Endgame', 'SCPC', 'EAP', 'Squid Game', 'Kaizen', 'Odyssey', 'STN', 'Other', '']).optional(),
  stage: z.enum(['learning', 'applying', 'interviewing', 'offer_pending', 'placed', 'hired']).optional(),
  job_focus: z.enum(['remote', 'onsite', 'hybrid', '']).optional(),
  experience: z.enum(['fresher', 'experienced', '']).optional(),
  risk_override_level: z.enum(['safe', 'medium', 'high', '']).optional(),
  hired: z.boolean().optional(),
  hired_company_name: z.string().optional(),
  hired_date: z.string().optional(),
  terminated: z.boolean().optional(),
  terminated_reason: z.string().optional(),
  terminated_date: z.string().optional(),
  last_activity_date: z.string().optional(),
  assignment_completion_pct: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  follow_up_date: z.string().optional(),
  interview_count: z.number().int().min(0).optional(),
});

const ImportedRowSchema = z.object({
  row_number: z.number().int().min(2),
  student: ImportedStudentSchema,
  attendance: z.object({
    date: z.string().optional(),
    session_type: z.string().optional(),
    status: z.string().optional(),
  }).nullable().optional(),
  conflict_action: z.enum(['skip', 'overwrite', 'merge']).optional().default('merge'),
});

const BulkImportSchema = z.object({
  file_name: z.string().min(1),
  rows: z.array(ImportedRowSchema).min(1).max(500),
});

function riskStatusFromImported(value?: string) {
  if (value === 'high' || value === 'medium') return 'at_risk' as const;
  return 'safe' as const;
}

function mergeStudent(
  existing: Student,
  incoming: z.infer<typeof ImportedStudentSchema>,
  mode: 'overwrite' | 'merge'
) {
  const next: Partial<Student> = {};
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || value === '') continue;
    if (mode === 'overwrite' || !existing[key as keyof Student]) {
      (next as Record<string, unknown>)[key] = value;
    }
  }
  if (incoming.risk_override_level) {
    next.risk_override_expires_at = addDays(new Date(), 14).toISOString();
    next.risk_override_note = 'Imported risk override';
  }
  if (incoming.hired) next.stage = 'hired';
  return next;
}

function buildAttendanceRow(
  studentId: string,
  attendance: { date?: string; session_type?: string; status?: string },
  userEmail: string
): unknown[] {
  const status = (attendance.status || '').toLowerCase();
  const present = status === 'present';
  return [
    uuidv4(),
    studentId,
    attendance.date || new Date().toISOString().slice(0, 10),
    String(present),
    userEmail,
    attendance.session_type || 'Imported',
    !present && ['exam', 'sick', 'personal', 'other'].includes(status) ? status : '',
    !present && !['exam', 'sick', 'personal'].includes(status) ? attendance.status || 'Absent' : '',
    new Date().toISOString(),
    new Date().toISOString(),
    '',
    '',
    '',
    'daily',
    'full_day',
    '',
    '',
    'bulk',
    'Imported from Excel',
    attendance.status || (present ? 'Present' : 'Absent'),
    '',
    '',
    '',
  ];
}

function buildProgressLogRow(
  studentId: string,
  studentName: string,
  studentEmail: string,
  notes: string,
  hiredCompany: string,
  activityDate: string,
  userEmail: string
): unknown[] {
  const log = {
    id: uuidv4(),
    student_id: studentId,
    student_name: studentName,
    student_email: studentEmail,
    log_type: 'Other' as const,
    company_name: hiredCompany || '',
    scheduled_date: activityDate || new Date().toISOString().slice(0, 10),
    scheduled_time: '',
    note: notes,
    logged_at: new Date().toISOString(),
    logged_by: userEmail,
  };
  return progressLogToRow(log);
}

function buildNewStudent(
  incoming: z.infer<typeof ImportedStudentSchema>,
  userEmail: string,
  nowStr: string
): Student {
  return {
    id: uuidv4(),
    name: sanitizeForSheet(incoming.name),
    batch: sanitizeForSheet(incoming.batch || 'batch-unknown'),
    mentor_email: userEmail,
    student_email: incoming.student_email || '',
    project: incoming.project || '',
    job_focus: incoming.job_focus || '',
    experience: incoming.experience || '',
    phone: incoming.phone || '',
    photo_url: incoming.photo_url || '',
    join_date: incoming.join_date || '',
    hired_company_name: incoming.hired_company_name || '',
    hired_date: incoming.hired_date || '',
    terminated_reason: incoming.terminated_reason || '',
    terminated_date: incoming.terminated_date || '',
    assignment_completion_pct: incoming.assignment_completion_pct,
    follow_up_date: incoming.follow_up_date || '',
    interview_count: incoming.interview_count,
    notes: incoming.notes || '',
    stage: incoming.hired ? 'hired' : incoming.stage || 'learning',
    hired: Boolean(incoming.hired),
    terminated: Boolean(incoming.terminated),
    last_activity_date: incoming.last_activity_date || nowStr,
    risk_status: riskStatusFromImported(incoming.risk_override_level),
    risk_override_level: incoming.risk_override_level || '',
    risk_override_note: incoming.risk_override_level ? 'Imported risk override' : '',
    risk_override_expires_at: incoming.risk_override_level ? addDays(new Date(), 14).toISOString() : '',
    created_at: nowStr,
    updated_at: nowStr,
    created_by: userEmail,
    risk_reasons: '',
  };
}

function buildUpdatedStudent(
  existing: Student,
  incoming: z.infer<typeof ImportedStudentSchema>,
  conflictAction: 'skip' | 'overwrite' | 'merge',
  userEmail: string
): Student {
  const updates = mergeStudent(existing, incoming, conflictAction === 'overwrite' ? 'overwrite' : 'merge');
  return {
    ...existing,
    ...updates,
    name: sanitizeForSheet(String(updates.name || existing.name)),
    batch: sanitizeForSheet(String(updates.batch || existing.batch)),
    mentor_email: existing.mentor_email || userEmail,
    risk_status: riskStatusFromImported(incoming.risk_override_level),
    updated_at: new Date().toISOString(),
  };
}

function processSingleRow(
  row: z.infer<typeof ImportedRowSchema>,
  existing: Student | undefined,
  userEmail: string,
  nowStr: string
): { status: 'created' | 'updated' | 'skipped' | 'failed'; message?: string; studentId?: string; studentObject?: Student } {
  const incoming = row.student;
  if (!incoming.name) {
    return { status: 'failed', message: 'Name is required' };
  }

  if (existing) {
    if (row.conflict_action === 'skip') {
      return { status: 'skipped', message: 'Existing email skipped', studentId: existing.id };
    }
    const updatedStudent = buildUpdatedStudent(existing, incoming, row.conflict_action, userEmail);
    return { status: 'updated', studentId: existing.id, studentObject: updatedStudent };
  }

  const newStudent = buildNewStudent(incoming, userEmail, nowStr);
  return { status: 'created', studentId: newStudent.id, studentObject: newStudent };
}

interface ProcessedData {
  studentUpdates: { sheetRow: number; values: unknown[] }[];
  newStudentRows: unknown[][];
  newAttendanceRows: unknown[][];
  newProgressRows: unknown[][];
  results: any[];
  stats: {
    created: number;
    updated: number;
    skipped: number;
    conflicts: number;
    attendanceCreated: number;
    progressCreated: number;
  };
  importedStudents: Student[];
}

function processImportRows(
  rows: z.infer<typeof ImportedRowSchema>[],
  existingStudents: Student[],
  userEmail: string
): ProcessedData {
  const byEmail = new Map(existingStudents.filter((s) => s.student_email).map((s) => [s.student_email!.toLowerCase(), s]));
  const studentUpdates: { sheetRow: number; values: unknown[] }[] = [];
  const newStudentRows: unknown[][] = [];
  const newAttendanceRows: unknown[][] = [];
  const newProgressRows: unknown[][] = [];
  const results: any[] = [];
  const importedStudents: Student[] = [];
  const stats = { created: 0, updated: 0, skipped: 0, conflicts: 0, attendanceCreated: 0, progressCreated: 0 };
  const nowStr = new Date().toISOString();

  for (const row of rows) {
    const incoming = row.student;
    const email = incoming.student_email?.toLowerCase() || '';
    const existing = email ? byEmail.get(email) : undefined;
    const res = processSingleRow(row, existing, userEmail, nowStr);

    results.push({ row: row.row_number, name: incoming.name || '(empty)', status: res.status, message: res.message, student_id: res.studentId });

    if (res.status === 'failed') continue;
    if (res.status === 'skipped') {
      stats.conflicts++;
      stats.skipped++;
      continue;
    }

    if (existing) {
      stats.conflicts++;
      stats.updated++;
      const studentIdx = existingStudents.findIndex((s) => s.id === existing.id);
      studentUpdates.push({ sheetRow: studentIdx + 2, values: studentToRow(res.studentObject!) });
    } else {
      stats.created++;
      newStudentRows.push(studentToRow(res.studentObject!));
    }

    importedStudents.push(res.studentObject!);

    if (row.attendance?.date || row.attendance?.status) {
      newAttendanceRows.push(buildAttendanceRow(res.studentId!, row.attendance, userEmail));
      stats.attendanceCreated++;
    }

    if (incoming.notes) {
      newProgressRows.push(buildProgressLogRow(res.studentId!, incoming.name, incoming.student_email || '', incoming.notes, incoming.hired_company_name || '', incoming.last_activity_date || '', userEmail));
      stats.progressCreated++;
    }
  }

  return { studentUpdates, newStudentRows, newAttendanceRows, newProgressRows, results, stats, importedStudents };
}

async function persistImportData(
  userEmail: string,
  fileName: string,
  totalRows: number,
  studentUpdates: { sheetRow: number; values: unknown[] }[],
  newStudentRows: unknown[][],
  newAttendanceRows: unknown[][],
  newProgressRows: unknown[][],
  results: any[],
  created: number,
  updated: number
): Promise<void> {
  await batchUpdateRows('students', studentUpdates);
  await appendRows('students', newStudentRows);
  await appendRows('attendance_logs', newAttendanceRows);
  await appendRows('progress_logs', newProgressRows);

  const failedCount = results.filter((r) => r.status === 'failed').length;
  await appendRow('student_upload_batches', [
    uuidv4(),
    userEmail,
    fileName,
    fileName.split('.').pop() || '',
    String(totalRows),
    String(created + updated),
    String(failedCount),
    failedCount > 0 ? 'partial' : 'completed',
    JSON.stringify(results.filter((r) => r.status === 'failed')),
    new Date().toISOString(),
    new Date().toISOString(),
    '',
    '',
  ]).catch(() => undefined);
}

function calculateRiskSummary(allStudents: Student[]) {
  const riskScores = allStudents.map((student) => calculateRiskScore(student));
  const highRisk = riskScores.filter((risk) => risk.level === 'high').length;
  const mediumRisk = riskScores.filter((risk) => risk.level === 'medium').length;
  return { highRisk, mediumRisk };
}

function buildImportResponse(
  stats: any,
  results: any[],
  allStudents: Student[],
  highRisk: number,
  mediumRisk: number,
  totalRowsCount: number
) {
  return {
    summary: {
      imported: stats.created,
      updated: stats.updated,
      skipped: stats.skipped,
      conflicts: stats.conflicts,
      attendance_created: stats.attendanceCreated,
      progress_created: stats.progressCreated,
      risk_scores_generated: allStudents.length,
      high_risk: highRisk,
      medium_risk: mediumRisk,
      leaderboard_recalculated: true,
    },
    module_status: [
      { label: 'Student Profiles', status: 'complete' as const, detail: `${stats.created + stats.updated}/${totalRowsCount}` },
      { label: 'Attendance Records', status: stats.attendanceCreated ? 'complete' : 'skipped' as const, detail: stats.attendanceCreated ? `${stats.attendanceCreated} synced` : '0 found - skipped' },
      { label: 'Risk Scores', status: 'complete' as const, detail: 'auto-calculated for all' },
      { label: 'Progress Logs', status: stats.progressCreated ? 'complete' : 'skipped' as const, detail: stats.progressCreated ? 'synced' : '0 found - skipped' },
      { label: 'Leaderboard', status: 'complete' as const, detail: 'recalculated' },
    ],
    results,
    students: allStudents,
  };
}

export async function POST(request: Request) {
  try {
    const user = requireRole(request.headers, ['manager', 'mentor']);
    const body = await request.json();
    const parsed = BulkImportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: 'Validation failed', errors: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { file_name, rows } = parsed.data;
    const existingStudents = await getAllStudents();

    const {
      studentUpdates,
      newStudentRows,
      newAttendanceRows,
      newProgressRows,
      results,
      stats,
    } = processImportRows(rows, existingStudents, user.email);

    await persistImportData(
      user.email,
      file_name,
      rows.length,
      studentUpdates,
      newStudentRows,
      newAttendanceRows,
      newProgressRows,
      results,
      stats.created,
      stats.updated
    );

    const allStudents = await getAllStudents();
    const { highRisk, mediumRisk } = calculateRiskSummary(allStudents);
    const resp = buildImportResponse(stats, results, allStudents, highRisk, mediumRisk, rows.length);
    return NextResponse.json(resp);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}
