import { NextResponse } from "next/server";
import { readSheet, appendRow, updateRow } from "@/lib/sheets/client";
import { getStudentById, filterStudents } from "@/lib/sheets/students";
import { requireRole } from "@/lib/auth/helpers";
import type { ApiError } from "@/lib/auth/helpers";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";

function isApiError(e: unknown): e is ApiError {
  return typeof e === "object" && e !== null && "status" in e;
}

const LogSchema = z
  .object({
    student_id: z.string().min(1),
    date: z.string().min(1),
    present: z.boolean(),
    session_label: z.string().default(""),
    excuse: z.enum(["exam", "sick", "personal", "other"]).optional(),
    excuse_note: z.string().max(200).optional(),
    session_id: z.string().optional(),
    mode: z.enum(["session", "daily"]).default("session"),
    period: z.enum(["full_day", "morning", "afternoon"]).default("full_day"),
    duration_minutes: z.number().int().min(0).max(1440).optional(),
    topic_tags: z.string().max(300).optional(),
    source: z
      .enum([
        "manual",
        "bulk",
        "auto_check_in",
        "offline_sync",
        "keyboard",
        "voice",
        "student_form",
      ])
      .default("manual"),
    attendance_note: z.string().max(300).optional(),
    status_label: z.string().max(40).optional(),
    status_color: z.string().max(40).optional(),
    status_emoji: z.string().max(8).optional(),
    notify_student: z.boolean().optional(),
  })
  .refine(
    (data) =>
      !(
        data.excuse === "other" &&
        data.present === false &&
        (!data.excuse_note || data.excuse_note.trim() === "")
      ),
    {
      message: 'A note is required when marking an absence as "other"',
      path: ["excuse_note"],
    },
  );

/**
 * Sheet columns:
 * 0: id
 * 1: student_id
 * 2: date
 * 3: present
 * 4: logged_by
 * 5: session_label
 * 6: excuse          (Phase 4 — new)
 * 7: excuse_note     (Phase 4 — new)
 * 8+: additive intelligent-attendance metadata
 */
function rowToLog(row: string[]) {
  return {
    id: row[0] || "",
    student_id: row[1] || "",
    date: row[2] || "",
    present: row[3] === "true",
    logged_by: row[4] || "",
    session_label: row[5] || "",
    excuse: (row[6] || "") as string,
    excuse_note: row[7] || "",
    created_at: row[8] || "",
    updated_at: row[9] || "",
    deleted_at: row[10] || "",
    deleted_by: row[11] || "",
    session_id: row[12] || "",
    mode: row[13] || "session",
    period: row[14] || "full_day",
    duration_minutes: row[15] || "",
    topic_tags: row[16] || "",
    source: row[17] || "manual",
    attendance_note: row[18] || "",
    status_label: row[19] || "",
    status_color: row[20] || "",
    status_emoji: row[21] || "",
    notified_at: row[22] || "",
  };
}

// GET /api/attendance?student_id=xxx
export async function GET(request: Request) {
  try {
    const user = requireRole(request.headers, ["manager", "mentor"]);
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("student_id");

    const rows = await readSheet("attendance_logs");
    let logs = rows.map(rowToLog).filter((l) => l.id);

    if (studentId) {
      // When a specific student is requested, verify the mentor owns that student
      if (user.role === "mentor") {
        const student = await getStudentById(studentId);
        if (!student || student.mentor_email !== user.email) {
          return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
      }
      logs = logs.filter((l) => l.student_id === studentId);
    } else if (user.role === "mentor") {
      // No student_id — scope to only the mentor's own students
      const mentorStudents = await filterStudents({ mentor_email: user.email });
      const mentorStudentIds = new Set(mentorStudents.map((s) => s.id));
      logs = logs.filter((l) => mentorStudentIds.has(l.student_id));
    }
    // Managers with no student_id get all records (no filter needed)

    logs.sort((a, b) => a.date.localeCompare(b.date));
    return NextResponse.json({ data: logs, total: logs.length });
  } catch (e) {
    const status = isApiError(e) ? e.status : 500;
    const message = isApiError(e) ? e.message : "Internal server error";
    return NextResponse.json({ message }, { status });
  }
}

// POST /api/attendance — create or update a single attendance record
export async function POST(request: Request) {
  try {
    const user = requireRole(request.headers, ["manager", "mentor"]);
    const body = await request.json();
    const result = LogSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          message: "Validation failed",
          errors: result.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const {
      student_id,
      date,
      present,
      session_label,
      excuse,
      excuse_note,
      session_id,
      mode,
      period,
      duration_minutes,
      topic_tags,
      source,
      attendance_note,
      status_label,
      status_color,
      status_emoji,
      notify_student,
    } = result.data;

    // Validate student exists — also needed for Discord notification
    const student = await getStudentById(student_id);
    if (!student) {
      return NextResponse.json(
        { message: "Student not found" },
        { status: 404 },
      );
    }

    const rows = await readSheet("attendance_logs");
    const existingIdx = rows.findIndex(
      (r) =>
        r[1] === student_id &&
        r[2] === date &&
        (r[12] || "") === (session_id || "") &&
        (r[14] || "full_day") === period,
    );

    const now = new Date().toISOString();
    const buildRow = (id: string, existing?: ReturnType<typeof rowToLog>) => [
      id,
      student_id,
      date,
      String(present),
      user.email,
      session_label,
      present ? "" : (excuse ?? ""), // clear excuse if marking present
      present ? "" : (excuse_note ?? ""),
      existing?.created_at || now,
      now,
      existing?.deleted_at || "",
      existing?.deleted_by || "",
      session_id ||
        existing?.session_id ||
        `${date}:${session_label || mode}:${period}`,
      mode,
      period,
      duration_minutes ?? existing?.duration_minutes ?? "",
      topic_tags ?? existing?.topic_tags ?? "",
      source,
      attendance_note ?? existing?.attendance_note ?? "",
      status_label ?? (present ? "Present" : excuse ? excuse : "Absent"),
      status_color ?? "",
      status_emoji ?? "",
      notify_student ? now : existing?.notified_at || "",
    ];

    let responseData: ReturnType<typeof rowToLog>;

    if (existingIdx !== -1) {
      const sheetRow = existingIdx + 2;
      const existing = rowToLog(rows[existingIdx]);
      await updateRow(
        "attendance_logs",
        sheetRow,
        buildRow(existing.id, existing),
      );
      responseData = rowToLog(buildRow(existing.id, existing) as string[]);
      responseData.id = existing.id;
    } else {
      const id = uuidv4();
      await appendRow("attendance_logs", buildRow(id));
      responseData = rowToLog(buildRow(id) as string[]);
      responseData.id = id;
    }

    await appendRow("audit_log", [
      uuidv4(),
      user.id,
      user.email,
      user.role,
      "ATTENDANCE_STATUS_CHANGED",
      "student",
      student_id,
      JSON.stringify({
        date,
        session_label,
        mode,
        period,
        present,
        excuse: excuse || "",
        source,
      }),
      request.headers.get("x-forwarded-for") || "unknown",
      request.headers.get("user-agent") || "unknown",
      now,
    ]).catch(() => undefined);

    const status = existingIdx === -1 ? 201 : 200;
    return NextResponse.json({ data: responseData }, { status });
  } catch (e) {
    const status = isApiError(e) ? e.status : 500;
    const message = isApiError(e) ? e.message : "Internal server error";
    return NextResponse.json({ message }, { status });
  }
}
