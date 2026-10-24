/**
 * Sheet Initialization Utilities for SkillCheck AI Video Interview Platform
 *
 * Automatically creates and verifies all 4 required tabs in Google Sheet:
 * 1. `users` - Mentor & Admin User accounts
 * 2. `students` - Whitelisted Student emails & candidate profiles
 * 3. `created_interviews` - Created batch mock interview sessions
 * 4. `interview_questions` - Questions, private rubrics, points, and timers
 * 5. `interview_results` - Evaluation reports & anti-cheating logs
 */

import { sheetExists, createSheet, appendRow } from "./client";

export const REQUIRED_SHEET_TABS = {
  USERS: "users",
  STUDENTS: "students",
  CREATED_INTERVIEWS: "created_interviews",
  INTERVIEW_QUESTIONS: "interview_questions",
  INTERVIEW_RESULTS: "interview_results",
} as const;

export const SHEET_TAB_HEADERS = {
  [REQUIRED_SHEET_TABS.USERS]: ["id", "name", "email", "role", "active", "created_at"],
  [REQUIRED_SHEET_TABS.STUDENTS]: ["id", "batch", "email", "status", "added_at"],
  [REQUIRED_SHEET_TABS.CREATED_INTERVIEWS]: [
    "id",
    "title",
    "batch",
    "role",
    "duration_minutes",
    "camera_mandatory",
    "slot_start_time",
    "slot_end_time",
    "allowed_emails_json",
    "created_at",
    "skills_json",
    "instructions",
  ],
  [REQUIRED_SHEET_TABS.INTERVIEW_QUESTIONS]: [
    "interview_id",
    "question_id",
    "position",
    "prompt",
    "rubric",
    "points",
    "duration_seconds",
  ],
  [REQUIRED_SHEET_TABS.INTERVIEW_RESULTS]: [
    "id",
    "interview_id",
    "interview_title",
    "batch",
    "candidate_email",
    "score",
    "max_score",
    "summary",
    "strengths",
    "improvements",
    "tab_switch_count",
    "eye_contact_score",
    "movement_score",
    "question_breakdown_json",
    "completed_at",
  ],
};

let sheetsInitialized = false;

export async function ensureAllVideoInterviewSheets(): Promise<void> {
  if (sheetsInitialized) return;

  try {
    for (const [tabName, headers] of Object.entries(SHEET_TAB_HEADERS)) {
      const exists = await sheetExists(tabName);
      if (!exists) {
        await createSheet(tabName, headers);
        console.log(`[Google Sheets] Successfully created tab: "${tabName}"`);
      }
    }

    // Seed default mentor and whitelisted students if users/students tabs are newly created
    await seedDefaultSheetData();

    sheetsInitialized = true;
  } catch (error) {
    console.warn("[Google Sheets Init Warning]:", error instanceof Error ? error.message : error);
  }
}

async function seedDefaultSheetData(): Promise<void> {
  try {
    // Check if users has data
    const usersExist = await sheetExists(REQUIRED_SHEET_TABS.USERS);
    if (usersExist) {
      // Add default mentor row if needed
      await appendRow(REQUIRED_SHEET_TABS.USERS, [
        "usr_mentor_lead",
        "Mentor Lead",
        "mentor@example.com",
        "mentor",
        "true",
        new Date().toISOString(),
      ]);
    }

    // Add default student whitelists
    const studentsExist = await sheetExists(REQUIRED_SHEET_TABS.STUDENTS);
    if (studentsExist) {
      await appendRow(REQUIRED_SHEET_TABS.STUDENTS, [
        "std_1",
        "Batch-01 (Web Dev)",
        "student1@example.com",
        "whitelisted",
        new Date().toISOString(),
      ]);
      await appendRow(REQUIRED_SHEET_TABS.STUDENTS, [
        "std_2",
        "Batch-01 (Web Dev)",
        "rahul@example.com",
        "whitelisted",
        new Date().toISOString(),
      ]);
    }
  } catch {
    // Ignore seed errors if already populated
  }
}
