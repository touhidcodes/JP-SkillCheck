import "server-only";

import { appendRow, appendRows, createSheet, readSheet, sheetExists, updateRow } from "./client";
import type { CustomInterviewQuestion, CustomInterviewSession } from "../interviews/custom-session";

const INTERVIEWS_SHEET = "created_interviews";
const QUESTIONS_SHEET = "interview_questions";

export const CREATED_INTERVIEW_HEADERS = [
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
];

export const INTERVIEW_QUESTION_HEADERS = [
  "interview_id",
  "question_id",
  "position",
  "prompt",
  "rubric",
  "points",
  "duration_seconds",
];

async function ensureInterviewSheets(): Promise<void> {
  const interviewsExist = await sheetExists(INTERVIEWS_SHEET);
  if (!interviewsExist) {
    await createSheet(INTERVIEWS_SHEET, CREATED_INTERVIEW_HEADERS);
  } else {
    await updateRow(INTERVIEWS_SHEET, 1, CREATED_INTERVIEW_HEADERS);
  }
  if (!(await sheetExists(QUESTIONS_SHEET))) {
    await createSheet(QUESTIONS_SHEET, INTERVIEW_QUESTION_HEADERS);
  } else {
    await updateRow(QUESTIONS_SHEET, 1, INTERVIEW_QUESTION_HEADERS);
  }
}

async function interviewSheetsExist(): Promise<boolean> {
  const [interviewsExist, questionsExist] = await Promise.all([
    sheetExists(INTERVIEWS_SHEET),
    sheetExists(QUESTIONS_SHEET),
  ]);
  return interviewsExist && questionsExist;
}

function safeParseJson<T>(value: string | undefined, fallback: T): T {
  try {
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function parseQuestion(row: string[]): CustomInterviewQuestion {
  return {
    id: row[1],
    prompt: row[3],
    rubric: row[4],
    points: Number(row[5]) || 0,
    durationSeconds: Number(row[6]) || 180,
  };
}

function parseSession(row: string[], questions: CustomInterviewQuestion[]): CustomInterviewSession {
  return {
    id: row[0],
    title: row[1],
    batch: row[2],
    role: row[3],
    durationMinutes: Number(row[4]) || 15,
    cameraMandatory: row[5] !== "false",
    slotStartTime: row[6] || "",
    slotEndTime: row[7] || "",
    allowedEmails: safeParseJson<string[]>(row[8], []),
    createdAt: row[9] || new Date(0).toISOString(),
    skills: safeParseJson<string[]>(row[10], []),
    instructions: row[11] || "",
    questions,
  };
}

export async function saveCreatedInterviewToGoogleSheets(
  session: CustomInterviewSession,
): Promise<string> {
  await ensureInterviewSheets();

  const existing = await getCreatedInterviewFromSheets(session.id);
  if (existing) return existing.id;

  await appendRow(INTERVIEWS_SHEET, [
    session.id,
    session.title,
    session.batch,
    session.role,
    session.durationMinutes,
    String(session.cameraMandatory),
    session.slotStartTime,
    session.slotEndTime,
    JSON.stringify(session.allowedEmails),
    session.createdAt,
    JSON.stringify(session.skills),
    session.instructions,
  ]);

  await appendRows(
    QUESTIONS_SHEET,
    session.questions.map((question, position) => [
      session.id,
      question.id,
      position + 1,
      question.prompt,
      question.rubric,
      question.points,
      question.durationSeconds,
    ]),
  );

  return session.id;
}

export async function getCreatedInterviewFromSheets(
  id: string,
): Promise<CustomInterviewSession | null> {
  if (!(await interviewSheetsExist())) return null;
  const [interviewRows, questionRows] = await Promise.all([
    readSheet(INTERVIEWS_SHEET),
    readSheet(QUESTIONS_SHEET),
  ]);
  const interviewRow = interviewRows.find((row) => row[0] === id);
  if (!interviewRow) return null;

  const questions = questionRows
    .filter((row) => row[0] === id)
    .sort((a, b) => Number(a[2]) - Number(b[2]))
    .map(parseQuestion);

  return parseSession(interviewRow, questions);
}

export async function getCreatedInterviewsFromSheets(): Promise<CustomInterviewSession[]> {
  if (!(await interviewSheetsExist())) return [];
  const [interviewRows, questionRows] = await Promise.all([
    readSheet(INTERVIEWS_SHEET),
    readSheet(QUESTIONS_SHEET),
  ]);

  const questionsByInterview = new Map<string, Array<{ position: number; question: CustomInterviewQuestion }>>();
  for (const row of questionRows) {
    const items = questionsByInterview.get(row[0]) ?? [];
    items.push({ position: Number(row[2]) || 0, question: parseQuestion(row) });
    questionsByInterview.set(row[0], items);
  }

  return interviewRows.map((row) => {
    const questions = (questionsByInterview.get(row[0]) ?? [])
      .sort((a, b) => a.position - b.position)
      .map((item) => item.question);
    return parseSession(row, questions);
  });
}
