/**
 * Attendance Forms Sheet Module
 *
 * Manages mentor-created attendance forms for student self-submission.
 *
 * Sheet columns:
 *   0: id
 *   1: mentor_email
 *   2: session_id
 *   3: session_label
 *   4: date
 *   5: mode
 *   6: period
 *   7: expires_at
 *   8: created_at
 *   9: is_active
 *   10: submission_count
 *   11: topic_tags
 *   12: duration_minutes
 */

import { readSheet, appendRow, updateRow } from "./client";
import { v4 as uuidv4 } from "uuid";

export interface AttendanceForm {
  id: string;
  mentor_email: string;
  session_id: string;
  session_label: string;
  date: string;
  mode: "session" | "daily";
  period: "full_day" | "morning" | "afternoon";
  expires_at: string;
  created_at: string;
  is_active: boolean;
  submission_count: number;
  topic_tags: string;
  duration_minutes: number;
}

function parseRow(row: string[]): AttendanceForm {
  return {
    id: row[0] || "",
    mentor_email: row[1] || "",
    session_id: row[2] || "",
    session_label: row[3] || "",
    date: row[4] || "",
    mode: (row[5] || "session") as AttendanceForm["mode"],
    period: (row[6] || "full_day") as AttendanceForm["period"],
    expires_at: row[7] || "",
    created_at: row[8] || "",
    is_active: row[9] === "true",
    submission_count: parseInt(row[10] || "0", 10),
    topic_tags: row[11] || "",
    duration_minutes: parseInt(row[12] || "0", 10),
  };
}

export async function getAttendanceFormById(
  id: string,
): Promise<AttendanceForm | null> {
  const rows = await readSheet("attendance_forms");
  const row = rows.find((r) => r[0] === id);
  return row ? parseRow(row) : null;
}

export async function listFormsByMentor(
  mentorEmail: string,
  date: string,
): Promise<AttendanceForm[]> {
  const rows = await readSheet("attendance_forms");
  return rows
    .filter((r) => r[1] === mentorEmail && r[4] === date)
    .map(parseRow)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function findActiveFormForSession(
  mentorEmail: string,
  sessionId: string,
): Promise<AttendanceForm | null> {
  const rows = await readSheet("attendance_forms");
  const row = rows.find(
    (r) => r[1] === mentorEmail && r[2] === sessionId && r[9] === "true",
  );
  return row ? parseRow(row) : null;
}

export interface CreateFormInput {
  mentor_email: string;
  session_id: string;
  session_label: string;
  date: string;
  mode: "session" | "daily";
  period: "full_day" | "morning" | "afternoon";
  expiry_minutes: number;
  topic_tags?: string;
  duration_minutes?: number;
}

export async function createAttendanceForm(
  input: CreateFormInput,
): Promise<AttendanceForm> {
  const id = uuidv4();
  const now = new Date().toISOString();
  const expires_at = new Date(
    Date.now() + input.expiry_minutes * 60_000,
  ).toISOString();

  const row: string[] = [
    id,
    input.mentor_email,
    input.session_id,
    input.session_label,
    input.date,
    input.mode,
    input.period,
    expires_at,
    now,
    "true",
    "0",
    input.topic_tags || "",
    String(input.duration_minutes || 0),
  ];

  await appendRow("attendance_forms", row);

  return {
    id,
    mentor_email: input.mentor_email,
    session_id: input.session_id,
    session_label: input.session_label,
    date: input.date,
    mode: input.mode,
    period: input.period,
    expires_at,
    created_at: now,
    is_active: true,
    submission_count: 0,
    topic_tags: input.topic_tags || "",
    duration_minutes: input.duration_minutes || 0,
  };
}

export async function updateAttendanceForm(
  id: string,
  updates: Partial<Pick<AttendanceForm, "is_active" | "expires_at">>,
): Promise<void> {
  const rows = await readSheet("attendance_forms");
  const rowIndex = rows.findIndex((r) => r[0] === id);
  if (rowIndex === -1) throw new Error(`Form ${id} not found`);

  const row = [...rows[rowIndex]];
  if (updates.is_active !== undefined) row[9] = String(updates.is_active);
  if (updates.expires_at !== undefined) row[7] = updates.expires_at;

  await updateRow("attendance_forms", rowIndex + 2, row);
}

export async function incrementSubmissionCount(id: string): Promise<void> {
  const rows = await readSheet("attendance_forms");
  const rowIndex = rows.findIndex((r) => r[0] === id);
  if (rowIndex === -1) return;

  const row = [...rows[rowIndex]];
  row[10] = String(parseInt(row[10] || "0", 10) + 1);
  await updateRow("attendance_forms", rowIndex + 2, row);
}

export function isFormAcceptingSubmissions(form: AttendanceForm): boolean {
  return form.is_active && new Date(form.expires_at) > new Date();
}
