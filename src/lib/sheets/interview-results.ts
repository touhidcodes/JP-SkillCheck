import { randomUUID } from "crypto";
import { appendRow, createSheet, sheetExists } from "./client";

const SHEET_NAME = "interview_results";
const HEADERS = [
  "id",
  "interview_id",
  "score",
  "max_score",
  "summary",
  "strengths",
  "improvements",
  "question_count",
  "completed_at",
];

let initialization: Promise<void> | null = null;

function ensureInterviewResultsSheet(): Promise<void> {
  if (!initialization) {
    initialization = (async () => {
      if (!(await sheetExists(SHEET_NAME))) {
        await createSheet(SHEET_NAME, HEADERS);
      }
    })().catch((error) => {
      initialization = null;
      throw error;
    });
  }
  return initialization;
}

export type SavedInterviewResult = {
  interviewId: string;
  score: number;
  maxScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  questionCount: number;
};

export async function saveInterviewResult(result: SavedInterviewResult): Promise<string> {
  await ensureInterviewResultsSheet();
  const id = randomUUID();
  await appendRow(SHEET_NAME, [
    id,
    result.interviewId,
    result.score,
    result.maxScore,
    result.summary,
    JSON.stringify(result.strengths),
    JSON.stringify(result.improvements),
    result.questionCount,
    new Date().toISOString(),
  ]);
  return id;
}
