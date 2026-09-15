import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getStudentById, updateStudent } from "@/lib/sheets/students";
import { logStageTransition } from "@/lib/sheets/stage-history";
import {
  isValidStageTransition,
  getTransitionErrorMessage,
} from "@/lib/sheets/stage-transitions";
import { Permission } from "@/lib/security/permissions";
import { logStudentTerminated } from "@/lib/security/audit-logger";
import { sanitizeForSheet } from "@/lib/security/sanitize";
import { z } from "zod";
import type { UserRole, StudentStage } from "@/types";

const StageSchema = z.object({
  stage: z.enum([
    "learning",
    "applying",
    "interviewing",
    "offer_pending",
    "placed",
  ]),
});

const TerminateSchema = z.object({
  reason: z.string().min(1).max(1000),
  terminated: z.boolean(),
});

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  manager: [Permission.STUDENTS_UPDATE, Permission.STUDENTS_TERMINATE],
  mentor: [Permission.STUDENTS_UPDATE],
};

function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.includes(permission) : false;
}

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

function getUserFromHeaders(headers: Headers): AuthUser | null {
  const userId = headers.get("x-user-id");
  const userRole = headers.get("x-user-role") as UserRole | null;
  const userEmail = headers.get("x-user-email");
  const userName = headers.get("x-user-name");

  if (!userId || !userRole || !userEmail || !userName) {
    return null;
  }

  return {
    id: userId,
    email: userEmail,
    name: userName,
    role: userRole,
  };
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  const user = getUserFromHeaders(request.headers);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user.role, Permission.STUDENTS_UPDATE)) {
    return NextResponse.json(
      { message: "Forbidden: insufficient permissions" },
      { status: 403 },
    );
  }

  const body = await request.json();
  const result = StageSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      {
        message: "Validation failed",
        errors: result.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const existing = await getStudentById(studentId);
  if (!existing) {
    return NextResponse.json({ message: "Student not found" }, { status: 404 });
  }

  if (user.role === "mentor" && existing.mentor_email !== user.email) {
    return NextResponse.json(
      {
        message: "Forbidden: You can only update your own assigned students",
      },
      { status: 403 },
    );
  }

  const previousStage = existing.stage;
  const newStage = result.data.stage as StudentStage;

  if (!isValidStageTransition(previousStage, newStage)) {
    return NextResponse.json(
      { message: getTransitionErrorMessage(previousStage, newStage) },
      { status: 400 },
    );
  }

  const student = await updateStudent(studentId, {
    stage: newStage,
  });

  if (!student) {
    return NextResponse.json({ message: "Student not found" }, { status: 404 });
  }

  if (previousStage !== result.data.stage) {
    try {
      await logStageTransition(
        studentId,
        previousStage,
        result.data.stage,
        "admin",
        `Stage changed via placement board`,
      );
    } catch (err) {
      console.error("Failed to log stage transition:", err);
    }
  }

  return NextResponse.json({ data: student });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ studentId: string }> },
) {
  const { studentId } = await params;
  const user = getUserFromHeaders(request.headers);

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!hasPermission(user.role, Permission.STUDENTS_TERMINATE)) {
    return NextResponse.json(
      { message: "Forbidden: insufficient permissions" },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const result = TerminateSchema.safeParse({ ...body, terminated: true });

  if (!result.success) {
    return NextResponse.json(
      {
        message: "Validation failed",
        errors: result.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const existing = await getStudentById(studentId);
  if (!existing) {
    return NextResponse.json({ message: "Student not found" }, { status: 404 });
  }

  const student = await updateStudent(studentId, { terminated: true });

  if (!student) {
    return NextResponse.json({ message: "Student not found" }, { status: 404 });
  }

  await logStudentTerminated(
    { id: user.id, email: user.email, role: user.role },
    studentId,
    existing.name,
    sanitizeForSheet(result.data.reason),
    request,
  );

  return NextResponse.json({ data: student, message: "Student terminated" });
}
