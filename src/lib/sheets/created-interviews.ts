import { readSheet, appendRow } from './client';
import { ensureAllVideoInterviewSheets } from './initialize';
import type { CustomInterviewSession } from '../interviews/custom-session';

const SHEET_NAME = 'created_interviews';

export async function saveCreatedInterviewToGoogleSheets(session: CustomInterviewSession): Promise<string> {
  try {
    await ensureAllVideoInterviewSheets();
    await appendRow(SHEET_NAME, [
      session.id,
      session.title,
      session.batch,
      session.role,
      session.durationMinutes,
      session.cameraMandatory ? "true" : "false",
      session.slotStartTime,
      session.slotEndTime,
      JSON.stringify(session.allowedEmails || []),
      new Date().toISOString(),
    ]);
  } catch (err) {
    console.warn("Google Sheets append interview session skipped or dev fallback:", err);
  }
  return session.id;
}

export async function getCreatedInterviewsFromSheets(): Promise<CustomInterviewSession[]> {
  try {
    await ensureAllVideoInterviewSheets();
    const rows = await readSheet(SHEET_NAME);
    return rows.map((row) => ({
      id: row[0],
      title: row[1],
      batch: row[2],
      role: row[3],
      durationMinutes: Number(row[4]) || 30,
      cameraMandatory: row[5] === "true",
      slotStartTime: row[6],
      slotEndTime: row[7],
      allowedEmails: safeParseJson<string[]>(row[8], []),
      skills: ["React", "JavaScript"],
      instructions: "Ensure camera is turned on during the interview.",
      createdAt: row[9] || new Date().toISOString(),
      questions: [
        {
          id: "q1",
          prompt: "Explain key concepts related to " + (row[3] || "the role"),
          durationSeconds: 180,
        }
      ],
    }));
  } catch {
    return [];
  }
}

function safeParseJson<T>(val: string, fallback: T): T {
  try {
    return val ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}
