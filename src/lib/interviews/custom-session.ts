export interface CustomInterviewQuestion {
  id: string;
  prompt: string;
  rubric: string;
  points: number;
  durationSeconds: number;
}

export interface CustomInterviewSession {
  id: string;
  title: string;
  batch: string;
  role: string;
  durationMinutes: number;
  cameraMandatory: boolean;
  allowedEmails: string[];
  slotStartTime: string;
  slotEndTime: string;
  skills: string[];
  instructions: string;
  createdAt: string;
  questions: CustomInterviewQuestion[];
}
