import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, type ApiError } from "@/lib/auth/helpers";
import { saveCreatedInterviewToGoogleSheets } from "@/lib/sheets/created-interviews";
import { saveStudentToGoogleSheets } from "@/lib/sheets/students";

export const runtime = "nodejs";

const questionSchema = z.object({
  id: z.string().trim().min(1).max(100),
  prompt: z.string().trim().min(1).max(2000),
  rubric: z.string().trim().min(1).max(2000),
  points: z.number().positive().max(100),
  durationSeconds: z.number().int().min(30).max(1800),
});

const sessionSchema = z.object({
  id: z.string().trim().regex(/^[a-zA-Z0-9_-]{6,100}$/),
  title: z.string().trim().min(1).max(200),
  batch: z.string().trim().min(1).max(120),
  role: z.string().trim().min(1).max(160),
  durationMinutes: z.number().int().min(1).max(180),
  cameraMandatory: z.boolean(),
  allowedEmails: z.array(z.string().trim().email()).max(500),
  slotStartTime: z.string().trim().min(1).max(50),
  slotEndTime: z.string().trim().min(1).max(50),
  skills: z.array(z.string().trim().min(1).max(100)).max(30),
  instructions: z.string().trim().max(2000),
  createdAt: z.string().datetime(),
  questions: z.array(questionSchema).min(1).max(20),
});

function isApiError(error: unknown): error is ApiError {
  return typeof error === "object" && error !== null && "status" in error;
}

function requireInterviewEditor(request: Request): void {
  const localAuthBypass =
    process.env.NODE_ENV !== "production" &&
    process.env.NEXT_PUBLIC_ADMIN_AUTH_ENABLED === "false";
  if (!localAuthBypass) requireRole(request.headers, ["manager", "mentor"]);
}

export async function POST(req: Request) {
  try {
    requireInterviewEditor(req);

    const parsed = sessionSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid interview data.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const session = parsed.data;
    await saveCreatedInterviewToGoogleSheets(session);

    await Promise.all(
      session.allowedEmails.map((email) =>
        saveStudentToGoogleSheets({
          batch: session.batch,
          email,
          status: "whitelisted",
        }),
      ),
    );

    return NextResponse.json({ success: true, id: session.id }, { status: 201 });
  } catch (error) {
    if (isApiError(error)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error("Save interview to Google Sheets failed:", error);
    return NextResponse.json(
      { message: "Could not save the interview to Google Sheets." },
      { status: 500 },
    );
  }
}
