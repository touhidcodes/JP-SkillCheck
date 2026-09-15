import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createStudent, updateStudent, getAllStudents } from '@/lib/sheets/students';
import { requireRole } from '@/lib/auth/helpers';
import type { ApiError } from '@/lib/auth/helpers';
import type { JobFocus, StudentStage } from '@/types';
import { z } from 'zod';
import { sanitizeForSheet } from '@/lib/security/sanitize';
import { validateTemplateHeaders } from '@/lib/validators/upload-template';

function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && 'status' in error;
}

const VALID_JOB_FOCUS: JobFocus[] = ['remote', 'onsite', 'hybrid'];
const VALID_STAGES: StudentStage[] = ['learning', 'applying', 'interviewing', 'offer_pending', 'placed', 'hired'];

type RowResult = { row: number; name: string; success: boolean; error?: string };

const BulkUpdateSchema = z.object({
  student_ids: z.array(z.string().min(1)).min(1).max(50),
  updates: z.object({
    stage: z.enum(VALID_STAGES).optional(),
    project: z.string().max(100).optional(),
    mentor_email: z.string().email().optional(),
    job_focus: z.enum(VALID_JOB_FOCUS).optional(),
    risk_status: z.enum(['safe', 'at_risk']).optional(),
    terminated: z.boolean().optional(),
  }),
}).strict();

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const currentIndex = index++;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.allSettled(workers);
  return results;
}

export async function PATCH(request: Request) {
  try {
    requireRole(request.headers, ['manager']);
    const body = await request.json();
    const result = BulkUpdateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { student_ids, updates } = result.data;

    const allStudents = await getAllStudents();
    const studentMap = new Map(allStudents.map((s) => [s.id, s]));

    const tasks = student_ids.map((id) => async () => {
      const student = studentMap.get(id);
      if (!student) {
        return { id, name: id, success: false, error: 'Student not found' };
      }
      try {
        const updated = await updateStudent(id, updates as Parameters<typeof updateStudent>[1]);
        if (!updated) {
          return { id, name: student.name, success: false, error: 'Update failed' };
        }
        return { id, name: updated.name, success: true };
      } catch {
        return { id, name: student.name, success: false, error: 'Update failed' };
      }
    });

    const results = await runWithConcurrency(tasks, 5);
    const updated = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({ updated, failed, total: student_ids.length, results });
  } catch (error: unknown) {
    const status = isApiError(error) ? error.status : 500;
    const message = isApiError(error) ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = requireRole(request.headers, ['manager', 'mentor']);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ message: 'No file provided' }, { status: 400 });
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { message: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
      return NextResponse.json(
        { message: 'Invalid file type. Please upload .xlsx, .xls, or .csv' },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    // Validate column headers before processing any rows
    const rawSheet = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: '' });
    const headerRow = (rawSheet[0] ?? []).map(String);

    if (headerRow.length === 0) {
      return NextResponse.json(
        { message: 'File has no header row. Download the template from /api/students/template.' },
        { status: 400 }
      );
    }

    const headerValidation = validateTemplateHeaders(headerRow);
    if (!headerValidation.valid) {
      return NextResponse.json(
        { message: headerValidation.message, missing_columns: headerValidation.missing },
        { status: 400 }
      );
    }

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    if (rows.length === 0) {
      return NextResponse.json({ message: 'File is empty or has no data rows' }, { status: 400 });
    }

    if (rows.length > 200) {
      return NextResponse.json(
        { message: 'Maximum 200 students per upload' },
        { status: 400 }
      );
    }

    const results: RowResult[] = [];

    const tasks: (() => Promise<RowResult>)[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;

      const name = String(row['name'] ?? row['Name'] ?? '').trim();
      const batch = String(row['batch'] ?? row['Batch'] ?? '').trim();
      const mentorEmail = String(
        row['mentor_email'] ?? row['Mentor Email'] ?? row['mentor email'] ?? ''
      ).trim();
      const jobFocusRaw = String(
        row['job_focus'] ?? row['Job Focus'] ?? row['job focus'] ?? ''
      ).trim().toLowerCase();
      const experienceRaw = String(
        row['experience'] ?? row['Experience'] ?? ''
      ).trim().toLowerCase();

      if (!name) {
        results.push({ row: rowNum, name: name || '(empty)', success: false, error: 'Name is required' });
        continue;
      }
      if (!batch) {
        results.push({ row: rowNum, name, success: false, error: 'Batch is required' });
        continue;
      }
      if (!mentorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mentorEmail)) {
        results.push({ row: rowNum, name, success: false, error: 'Valid mentor email is required' });
        continue;
      }

      if (user.role === 'mentor' && mentorEmail !== user.email) {
        results.push({
          row: rowNum,
          name,
          success: false,
          error: `Mentor can only add students to their own email (${user.email})`,
        });
        continue;
      }

      const jobFocus = VALID_JOB_FOCUS.includes(jobFocusRaw as JobFocus)
        ? (jobFocusRaw as JobFocus)
        : undefined;

      const VALID_EXPERIENCE = ['fresher', 'experienced'];
      const experience = VALID_EXPERIENCE.includes(experienceRaw)
        ? (experienceRaw as 'fresher' | 'experienced')
        : undefined;

      tasks.push(async () => {
        try {
          await createStudent({
            name: sanitizeForSheet(name),
            batch: sanitizeForSheet(batch),
            mentor_email: mentorEmail,
            job_focus: jobFocus,
            experience,
          });
          return { row: rowNum, name, success: true };
        } catch {
          return { row: rowNum, name, success: false, error: 'Failed to save to sheet' };
        }
      });
    }

    const taskResults = await runWithConcurrency(tasks, 5);
    results.push(...taskResults);

    const created = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      created,
      failed,
      total: rows.length,
      results,
    });
  } catch (error: unknown) {
    const status = isApiError(error) ? error.status : 500;
    const message = isApiError(error) ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}
