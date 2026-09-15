import { NextResponse } from 'next/server';
import { filterStudents, createStudent } from '@/lib/sheets/students';
import { CreateStudentSchema } from '@/lib/validators/student.schema';
import { requireRole } from '@/lib/auth/helpers';
import { getUserByEmail } from '@/lib/sheets/users';
import { sanitizeForSheet } from '@/lib/security/sanitize';
import type { ApiError } from '@/lib/auth/helpers';
import type { StudentStage, RiskStatus } from '@/types';

function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && 'status' in error;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const stage = searchParams.get('stage') as StudentStage | null;
    const risk_status = searchParams.get('risk_status') as RiskStatus | null;
    const batch = searchParams.get('batch');
    const project = searchParams.get('project');
    const search = searchParams.get('search');
    const job_focus = searchParams.get('job_focus');
    const terminatedParam = searchParams.get('terminated');
    const hiredParam = searchParams.get('hired');
    const experience = searchParams.get('experience');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const user = requireRole(request.headers, ['manager', 'mentor']);

    const filters: {
      stage?: StudentStage;
      risk_status?: RiskStatus;
      batch?: string;
      project?: string;
      mentor_email?: string;
      job_focus?: string;
      terminated?: boolean;
      hired?: boolean;
      search?: string;
      experience?: string;
    } = {};

    if (stage && (stage as string) !== 'all') filters.stage = stage;
    if (risk_status && (risk_status as string) !== 'all') filters.risk_status = risk_status;
    if (batch && batch !== 'all') filters.batch = batch;
    if (project && project !== 'all') filters.project = project;
    if (search) filters.search = search;
    if (job_focus && job_focus !== 'all') filters.job_focus = job_focus;
    if (terminatedParam === 'true') filters.terminated = true;
    else if (terminatedParam === 'false') filters.terminated = false;
    if (hiredParam === 'true') filters.hired = true;
    else if (hiredParam === 'false') filters.hired = false;
    if (experience && experience !== 'all') filters.experience = experience;

    if (user.role === 'mentor') {
      filters.mentor_email = user.email;
    }

    const students = await filterStudents(filters);

    const total = students.length;
    const pages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const data = students.slice(start, start + limit);

    return NextResponse.json({ data, total, page, limit, pages });
  } catch (error: unknown) {
    const status = isApiError(error) ? error.status : 500;
    const message = isApiError(error) ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    requireRole(request.headers, ['manager']);

    const body = await request.json();
    const result = CreateStudentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Validate mentor exists and is active
    const mentor = await getUserByEmail(result.data.mentor_email);
    if (!mentor || !mentor.active) {
      return NextResponse.json(
        { message: 'Mentor not found or inactive' },
        { status: 400 }
      );
    }

    // Sanitize text fields
    const sanitizedData = {
      ...result.data,
      name: sanitizeForSheet(result.data.name),
      batch: sanitizeForSheet(result.data.batch),
    };

    const student = await createStudent(sanitizedData);
    return NextResponse.json({ data: student }, { status: 201 });
  } catch (error: unknown) {
    const status = isApiError(error) ? error.status : 500;
    const message = isApiError(error) ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}
