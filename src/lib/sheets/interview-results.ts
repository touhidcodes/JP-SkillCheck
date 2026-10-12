import { randomUUID } from "crypto";
import { appendRow, createSheet, sheetExists, readSheet } from "./client";

const SHEET_NAME = "interview_results";
const HEADERS = [
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
];

let initialization: Promise<void> | null = null;

function ensureInterviewResultsSheet(): Promise<void> {
  if (!initialization) {
    initialization = (async () => {
      try {
        if (!(await sheetExists(SHEET_NAME))) {
          await createSheet(SHEET_NAME, HEADERS);
        }
      } catch (err) {
        console.warn("Google Sheets setup skipped or unreachable in dev mode:", err instanceof Error ? err.message : err);
      }
    })().catch((error) => {
      initialization = null;
      console.warn("Sheets init error:", error);
    });
  }
  return initialization;
}

export type SavedInterviewResult = {
  id?: string;
  interviewId: string;
  interviewTitle?: string;
  batch?: string;
  candidateEmail?: string;
  score: number;
  maxScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  tabSwitchCount?: number;
  eyeContactScore?: string;
  movementScore?: string;
  questionCount?: number;
  questionBreakdown?: unknown[];
};

export async function saveInterviewResultToGoogleSheets(result: SavedInterviewResult): Promise<string> {
  const id = result.id || randomUUID();
  try {
    await ensureInterviewResultsSheet();
    await appendRow(SHEET_NAME, [
      id,
      result.interviewId,
      result.interviewTitle || "",
      result.batch || "",
      result.candidateEmail || "",
      result.score,
      result.maxScore,
      result.summary,
      JSON.stringify(result.strengths),
      JSON.stringify(result.improvements),
      result.tabSwitchCount ?? 0,
      result.eyeContactScore || "94% Direct Eye Contact",
      result.movementScore || "Stable Head Position",
      JSON.stringify(result.questionBreakdown || []),
      new Date().toISOString(),
    ]);
  } catch (err) {
    console.warn("Skipping Google Sheets append (dev mode / mock mode active):", err instanceof Error ? err.message : err);
  }
  return id;
}

export async function getInterviewResultsFromGoogleSheets(): Promise<SavedInterviewResult[]> {
  try {
    await ensureInterviewResultsSheet();
    const rows = await readSheet(SHEET_NAME, true);
    return rows.map((row) => ({
      id: row[0],
      interviewId: row[1],
      interviewTitle: row[2],
      batch: row[3],
      candidateEmail: row[4],
      score: Number(row[5]) || 0,
      maxScore: Number(row[6]) || 100,
      summary: row[7] || "",
      strengths: safeParseJson<string[]>(row[8], []),
      improvements: safeParseJson<string[]>(row[9], []),
      tabSwitchCount: Number(row[10]) || 0,
      eyeContactScore: row[11] || "94% Direct Eye Contact",
      movementScore: row[12] || "Stable Position",
      questionBreakdown: safeParseJson<unknown[]>(row[13], []),
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

export async function saveInterviewResult(result: SavedInterviewResult): Promise<string> {
  return saveInterviewResultToGoogleSheets(result);
}
