import { NextResponse } from 'next/server';
import { getAllProgressLogs, getProgressLogsByStudent, getProgressLogsByMentor, createProgressLog } from '@/lib/sheets/progress-logs';
import { getStudentById } from '@/lib/sheets/students';
import { requireRole } from '@/lib/auth/helpers';
import { logEvent } from '@/lib/sheets/analytics-events';
import type { ApiError } from '@/lib/auth/helpers';
import { z } from 'zod';

function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && 'status' in error;
}

const CreateProgressLogSchema = z.object({
  student_id: z.string().min(1),
  log_type: z.enum(['Interview Call', 'Job Applied', 'Mock Interview', 'Job Task', 'Offer', 'Other']),
  company_name: z.string().min(1).max(200),
  scheduled_date: z.string().min(1),
  scheduled_time: z.string().default(''),
  note: z.string().max(1000).default(''),
  job_url: z.string().url().optional().or(z.literal('')),
  mock_feedback: z.string().max(1000).optional(),
  mock_score: z.number().int().min(1).max(10).optional(),
  mock_strengths: z.string().max(500).optional(),
  mock_improvements: z.string().max(500).optional(),
  mock_interview_type: z.enum(['technical', 'behavioral', 'system_design', 'hr', 'mock']).optional(),
  mock_interviewer: z.string().max(100).optional(),
});

export async function GET(request: Request) {
  try {
    const user = requireRole(request.headers, ['manager', 'mentor']);
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('student_id');

    let logs;
    if (studentId) {
      // Specific student — used by student detail views
      logs = await getProgressLogsByStudent(studentId);
    } else if (user.role === 'mentor') {
      // Mentors only see logs they logged (i.e. for their own students)
      logs = await getProgressLogsByMentor(user.email);
    } else {
      // Managers see everything
      logs = await getAllProgressLogs();
    }

    return NextResponse.json({ data: logs, total: logs.length });
  } catch (error: unknown) {
    const status = isApiError(error) ? error.status : 500;
    const message = isApiError(error) ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const user = requireRole(request.headers, ['manager', 'mentor']);
    const body = await request.json();
    const result = CreateProgressLogSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const student = await getStudentById(result.data.student_id);
    if (!student) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    const log = await createProgressLog({
      student_id: result.data.student_id,
      student_name: student.name,
      student_email: student.student_email || student.mentor_email,
      log_type: result.data.log_type,
      company_name: result.data.company_name,
      scheduled_date: result.data.scheduled_date,
      scheduled_time: result.data.scheduled_time,
      note: result.data.note,
      logged_by: user.email,
      job_url: result.data.job_url ?? '',
      mock_feedback: result.data.mock_feedback ?? '',
      mock_score: result.data.mock_score,
      mock_strengths: result.data.mock_strengths ?? '',
      mock_improvements: result.data.mock_improvements ?? '',
      mock_interview_type: result.data.mock_interview_type,
      mock_interviewer: result.data.mock_interviewer ?? '',
    });

    await logEvent(
      'progress_log_created',
      user.email,
      user.role,
      student.id,
      student.name,
      { log_id: log.id, log_type: log.log_type, company: log.company_name }
    ).catch(() => { /* best-effort */ });

    return NextResponse.json({ data: log }, { status: 201 });
  } catch (error: unknown) {
    const status = isApiError(error) ? error.status : 500;
    const message = isApiError(error) ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}
