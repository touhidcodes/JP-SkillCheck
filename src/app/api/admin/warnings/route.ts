import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requirePermission, Permission } from '@/lib/security/permissions';
import { getWarnings, createWarning, resolveWarning, escalateWarning } from '@/lib/sheets/warnings';
import { withCsrfProtection } from '@/lib/security/csrf';
import { logWarningIssued } from '@/lib/security/audit-logger';
import { sanitizeForSheet } from '@/lib/security/sanitize';
import { CreateWarningSchema, ResolveWarningSchema } from '@/lib/validators/warning.schema';
import type { WarningSeverity, WarningStatus } from '@/lib/sheets/warnings';

export async function GET(request: Request) {
  try {
    requirePermission(Permission.WARNINGS_VIEW)(request.headers);

    const { searchParams } = new URL(request.url);

    const filters = {
      studentId: searchParams.get('studentId') ?? undefined,
      mentorEmail: searchParams.get('mentorEmail') ?? undefined,
      status: (searchParams.get('status') ?? undefined) as WarningStatus | undefined,
      severity: (searchParams.get('severity') ?? undefined) as WarningSeverity | undefined,
    };

    const warnings = await getWarnings(filters);
    return NextResponse.json({ data: warnings, total: warnings.length });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return withCsrfProtection(async (req: NextRequest) => {
    const user = requirePermission(Permission.WARNINGS_ISSUE)(req.headers);

    const body = await req.json();
    const result = CreateWarningSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const sanitizedData = {
      student_id: sanitizeForSheet(result.data.student_id),
      student_name: sanitizeForSheet(result.data.student_name),
      mentor_email: sanitizeForSheet(result.data.mentor_email),
      severity: result.data.severity,
      reason: sanitizeForSheet(result.data.reason),
      evidence_notes: sanitizeForSheet(result.data.evidence_notes || ''),
    };

    const warning = await createWarning({
      ...sanitizedData,
      status: 'open',
      created_by: user.role,
    });

    await logWarningIssued(
      { id: user.id, email: user.email, role: user.role },
      warning.id,
      sanitizedData.student_id,
      sanitizedData.severity,
      sanitizedData.reason,
      req
    );

    return NextResponse.json({ data: warning }, { status: 201 });
  })(request);
}

export async function PATCH(request: NextRequest) {
  return withCsrfProtection(async (req: NextRequest) => {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ message: 'id query param is required' }, { status: 400 });
    }

    if (action === 'resolve') {
      const user = requirePermission(Permission.WARNINGS_RESOLVE)(req.headers);

      const body = await req.json();
      const result = ResolveWarningSchema.safeParse(body);

      if (!result.success) {
        return NextResponse.json(
          { message: 'Validation failed', errors: result.error.flatten().fieldErrors },
          { status: 400 }
        );
      }

      const updated = await resolveWarning(
        id,
        user.email,
        sanitizeForSheet(result.data.resolution_notes)
      );

      if (!updated) {
        return NextResponse.json({ message: 'Warning not found' }, { status: 404 });
      }

      return NextResponse.json({ data: updated });
    }

    if (action === 'escalate') {
      requirePermission(Permission.WARNINGS_ISSUE)(req.headers);

      const updated = await escalateWarning(id);
      if (!updated) {
        return NextResponse.json({ message: 'Warning not found' }, { status: 404 });
      }

      return NextResponse.json({ data: updated });
    }

    return NextResponse.json(
      { message: 'Unknown action. Use ?action=resolve or ?action=escalate' },
      { status: 400 }
    );
  })(request);
}
