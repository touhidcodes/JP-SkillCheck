import "server-only";

import { getCreatedInterviewFromSheets } from "@/lib/sheets/created-interviews";

export type InterviewQuestion = {
  id: string;
  prompt: string;
  rubric: string;
  points: number;
  durationSeconds: number;
};

export type InterviewTemplate = {
  id: string;
  title: string;
  role: string;
  durationMinutes: number;
  questions: InterviewQuestion[];
  batch?: string;
  cameraMandatory?: boolean;
  allowedEmails?: string[];
  slotStartTime?: string;
  slotEndTime?: string;
  instructions?: string;
};

export type PublicInterviewTemplate = Omit<InterviewTemplate, "questions"> & {
  questions: Array<Pick<InterviewQuestion, "id" | "prompt" | "durationSeconds">>;
  batch?: string;
  cameraMandatory?: boolean;
  allowedEmails?: string[];
  slotStartTime?: string;
  slotEndTime?: string;
  instructions?: string;
};

export async function getInterviewTemplate(id: string): Promise<InterviewTemplate | null> {
  const interview = await getCreatedInterviewFromSheets(id);
  if (interview) {
    return {
      ...interview,
      questions: interview.questions,
    };
  }

  return null;
}

export function toPublicInterview(interview: InterviewTemplate): PublicInterviewTemplate {
  return {
    id: interview.id,
    title: interview.title,
    role: interview.role,
    durationMinutes: interview.durationMinutes,
    batch: interview.batch,
    cameraMandatory: interview.cameraMandatory ?? true,
    allowedEmails: interview.allowedEmails,
    slotStartTime: interview.slotStartTime,
    slotEndTime: interview.slotEndTime,
    instructions: interview.instructions,
    questions: interview.questions.map(({ id, prompt, durationSeconds }) => ({
      id,
      prompt,
      durationSeconds,
    })),
  };
}
