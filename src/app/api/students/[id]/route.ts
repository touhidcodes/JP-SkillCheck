import { NextResponse } from 'next/server';
import { getStudentById, updateStudent } from '@/lib/sheets/students';
import { UpdateStudentSchema } from '@/lib/validators/student.schema';
import { isValidStageTransition, getTransitionErrorMessage } from '@/lib/sheets/stage-transitions';
import { requireRole } from '@/lib/auth/helpers';
import { getUserByEmail } from '@/lib/sheets/users';
import { sanitizeForSheet } from '@/lib/security/sanitize';
import type { ApiError } from '@/lib/auth/helpers';
import type { StudentStage } from '@/types';

function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && 'status' in error;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireRole(request.headers, ['manager', 'mentor']);
    const { id } = await params;
    const student = await getStudentById(id);

    if (!student) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    if (user.role === 'mentor' && student.mentor_email !== user.email) {
      return NextResponse.json({ message: 'Forbidden: you can only view your own students' }, { status: 403 });
    }

    return NextResponse.json({ data: student });
  } catch (error: unknown) {
    const status = isApiError(error) ? error.status : 500;
    const message = isApiError(error) ? error.message : 'Internal server error';
    return NextResponse.json(
      { message },
      { status }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = requireRole(request.headers, ['manager', 'mentor']);

    const { id } = await params;
    const existing = await getStudentById(id);
    if (!existing) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    if (user.role === 'mentor' && existing.mentor_email !== user.email) {
      return NextResponse.json({ message: 'Forbidden: you can only update your own students' }, { status: 403 });
    }

    const body = await request.json();
    const result = UpdateStudentSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updates = { ...result.data };

    // Sanitize text fields
    if (updates.name) updates.name = sanitizeForSheet(updates.name);
    if (updates.batch) updates.batch = sanitizeForSheet(updates.batch);

    // Validate stage transitions
    if (updates.stage && updates.stage !== existing.stage) {
      if (!isValidStageTransition(existing.stage, updates.stage as StudentStage)) {
        return NextResponse.json(
          { message: getTransitionErrorMessage(existing.stage, updates.stage as StudentStage) },
          { status: 400 }
        );
      }
    }

    // Validate mentor email exists if changing mentor
    if (updates.mentor_email && updates.mentor_email !== existing.mentor_email) {
      const mentor = await getUserByEmail(updates.mentor_email);
      if (!mentor || !mentor.active) {
        return NextResponse.json(
          { message: 'Mentor not found or inactive' },
          { status: 400 }
        );
      }
    }

    const student = await updateStudent(id, updates);

    if (!student) {
      return NextResponse.json({ message: 'Student not found' }, { status: 404 });
    }

    return NextResponse.json({ data: student });
  } catch (error: unknown) {
    const status = isApiError(error) ? error.status : 500;
    const message = isApiError(error) ? error.message : 'Internal server error';
    return NextResponse.json(
      { message },
      { status }
    );
  }
}
