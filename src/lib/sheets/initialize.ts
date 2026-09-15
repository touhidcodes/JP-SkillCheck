/**
 * Sheet Initialization Utilities
 *
 * Ensures required sheets exist on first access.
 * Uses lazy initialization to avoid unnecessary API calls.
 */

import { sheetExists, createSheet } from "./client";

let attendanceFormsInitialized = false;

export async function ensureAttendanceFormsSheet(): Promise<void> {
  if (attendanceFormsInitialized) return;

  const exists = await sheetExists("attendance_forms");
  if (!exists) {
    await createSheet("attendance_forms", [
      "id",
      "mentor_email",
      "session_id",
      "session_label",
      "date",
      "mode",
      "period",
      "expires_at",
      "created_at",
      "is_active",
      "submission_count",
      "topic_tags",
      "duration_minutes",
    ]);
  }

  attendanceFormsInitialized = true;
}
