/**
 * Attendance Logs Sheet Module
 *
 * Manages daily attendance records with excuse tracking.
 *
 * Sheet columns:
 *   0: id
 *   1: student_id
 *   2: date
 *   3: present
 *   4: logged_by
 *   5: session_label
 *   6: excuse
 *   7: excuse_note
 */

import { readSheet, appendRow, updateRow, findRowIndex } from "./client";
import { v4 as uuidv4 } from "uuid";
import type { AttendanceLog, AbsenceExcuse } from "@/types";

export interface AttendanceRecord {
  id: string;
  student_id: string;
  date: string;
  present: boolean;
  logged_by: string;
  session_label: string;
  excuse: string;
  excuse_note: string;
  created_at: string;
  updated_at: string;
  deleted_at: string;
  deleted_by: string;
  session_id: string;
  mode: "session" | "daily";
  period: "full_day" | "morning" | "afternoon";
  duration_minutes: string;
  topic_tags: string;
  source: string;
  attendance_note: string;
  status_label: string;
  status_color: string;
  status_emoji: string;
  notified_at: string;
}

export interface UpsertAttendanceRecordInput {
  student_id: string;
  date: string;
  present: boolean;
  logged_by: string;
  session_label: string;
  session_id: string;
  mode: "session" | "daily";
  period: "full_day" | "morning" | "afternoon";
  duration_minutes?: number;
  topic_tags?: string;
  source?: string;
  attendance_note?: string;
  status_label?: string;
  status_color?: string;
  status_emoji?: string;
  excuse?: string;
  excuse_note?: string;
}

function rowToAttendanceLog(row: string[]): AttendanceLog {
  return {
    id: row[0] || "",
    student_id: row[1] || "",
    date: row[2] || "",
    present: row[3] === "true",
    logged_by: row[4] || "",
    session_label: row[5] || "",
    excuse: (row[6] || "") as AbsenceExcuse | "",
    excuse_note: row[7] || "",
  };
}

function attendanceLogToRow(log: AttendanceLog): string[] {
  return [
    log.id,
    log.student_id,
    log.date,
    String(log.present),
    log.logged_by,
    log.session_label || "",
    log.excuse || "",
    log.excuse_note || "",
  ];
}

export async function getAllAttendanceLogs(): Promise<AttendanceLog[]> {
  const rows = await readSheet("attendance_logs");
  return rows.map(rowToAttendanceLog).filter((l) => l.id);
}

export async function getAttendanceByStudent(
  studentId: string,
): Promise<AttendanceLog[]> {
  const logs = await getAllAttendanceLogs();
  return logs
    .filter((l) => l.student_id === studentId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getAttendanceByDateRange(
  studentId: string,
  from: string,
  to: string,
): Promise<AttendanceLog[]> {
  const logs = await getAttendanceByStudent(studentId);
  return logs.filter((l) => l.date >= from && l.date <= to);
}

export async function createAttendanceLog(
  data: Omit<AttendanceLog, "id">,
): Promise<AttendanceLog> {
  const log: AttendanceLog = {
    ...data,
    id: uuidv4(),
  };
  await appendRow("attendance_logs", attendanceLogToRow(log));
  return log;
}

export async function updateAttendanceLog(
  id: string,
  updates: Partial<AttendanceLog>,
): Promise<AttendanceLog | null> {
  const rowIndex = await findRowIndex("attendance_logs", 0, id);
  if (rowIndex === -1) return null;

  const rows = await readSheet("attendance_logs");
  const existing = rowToAttendanceLog(rows[rowIndex - 2]);
  const updated: AttendanceLog = { ...existing, ...updates };

  await updateRow("attendance_logs", rowIndex, attendanceLogToRow(updated));
  return updated;
}

function attendanceRecordToRow(record: AttendanceRecord): string[] {
  return [
    record.id,
    record.student_id,
    record.date,
    String(record.present),
    record.logged_by,
    record.session_label,
    record.excuse,
    record.excuse_note,
    record.created_at,
    record.updated_at,
    record.deleted_at,
    record.deleted_by,
    record.session_id,
    record.mode,
    record.period,
    record.duration_minutes,
    record.topic_tags,
    record.source,
    record.attendance_note,
    record.status_label,
    record.status_color,
    record.status_emoji,
    record.notified_at,
  ];
}

function rowToAttendanceRecord(row: string[]): AttendanceRecord {
  return {
    id: row[0] || "",
    student_id: row[1] || "",
    date: row[2] || "",
    present: row[3] === "true",
    logged_by: row[4] || "",
    session_label: row[5] || "",
    excuse: row[6] || "",
    excuse_note: row[7] || "",
    created_at: row[8] || "",
    updated_at: row[9] || "",
    deleted_at: row[10] || "",
    deleted_by: row[11] || "",
    session_id: row[12] || "",
    mode: (row[13] || "session") as "session" | "daily",
    period: (row[14] || "full_day") as "full_day" | "morning" | "afternoon",
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

export async function getAttendanceRecord(filters: {
  student_id: string;
  session_id: string;
  period: "full_day" | "morning" | "afternoon";
}): Promise<AttendanceRecord | null> {
  const rows = await readSheet("attendance_logs");
  const row = rows.find(
    (current) =>
      current[1] === filters.student_id &&
      (current[12] || "") === filters.session_id &&
      (current[14] || "full_day") === filters.period,
  );
  return row ? rowToAttendanceRecord(row) : null;
}

export async function upsertAttendanceLog(
  input: UpsertAttendanceRecordInput,
): Promise<AttendanceRecord> {
  const now = new Date().toISOString();
  const existing = await getAttendanceRecord({
    student_id: input.student_id,
    session_id: input.session_id,
    period: input.period,
  });

  const row: AttendanceRecord = {
    id: existing?.id || uuidv4(),
    student_id: input.student_id,
    date: input.date,
    present: input.present,
    logged_by: input.logged_by,
    session_label: input.session_label,
    excuse: input.present ? "" : input.excuse || "",
    excuse_note: input.present ? "" : input.excuse_note || "",
    created_at: existing?.created_at || now,
    updated_at: now,
    deleted_at: existing?.deleted_at || "",
    deleted_by: existing?.deleted_by || "",
    session_id: input.session_id,
    mode: input.mode,
    period: input.period,
    duration_minutes: String(input.duration_minutes ?? ""),
    topic_tags: input.topic_tags || "",
    source: input.source || "manual",
    attendance_note: input.attendance_note || "",
    status_label: input.status_label || (input.present ? "Present" : "Absent"),
    status_color: input.status_color || "",
    status_emoji: input.status_emoji || "",
    notified_at: existing?.notified_at || "",
  };

  if (existing) {
    const rowIndex = await findRowIndex("attendance_logs", 0, existing.id);
    if (rowIndex !== -1) {
      await updateRow("attendance_logs", rowIndex, attendanceRecordToRow(row));
      return row;
    }
  }

  await appendRow("attendance_logs", attendanceRecordToRow(row));
  return row;
}

export async function getAttendanceStats(studentId: string): Promise<{
  total: number;
  present: number;
  absent: number;
  excused: number;
  rate: number;
}> {
  const logs = await getAttendanceByStudent(studentId);
  const total = logs.length;
  const present = logs.filter((l) => l.present).length;
  const excused = logs.filter(
    (l) => !l.present && l.excuse && l.excuse.trim() !== "",
  ).length;
  const absent = total - present;
  const rate = total > 0 ? Math.round((present / total) * 100) : 0;

  return { total, present, absent, excused, rate };
}
