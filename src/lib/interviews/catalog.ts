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
};

export type PublicInterviewTemplate = Omit<InterviewTemplate, "questions"> & {
  questions: Array<Pick<InterviewQuestion, "id" | "prompt" | "durationSeconds">>;
};

const INTERVIEWS: Record<string, InterviewTemplate> = {
  "frontend-developer": {
    id: "frontend-developer",
    title: "Frontend Developer Mock Interview",
    role: "Junior Frontend Developer",
    durationMinutes: 15,
    questions: [
      {
        id: "javascript-event-loop",
        prompt: "Explain how the JavaScript event loop handles synchronous code, promises, and setTimeout callbacks.",
        rubric: "Mentions call stack, task queue, microtask queue, and that promise callbacks run before timer callbacks.",
        points: 20,
        durationSeconds: 120,
      },
      {
        id: "react-state",
        prompt: "What is the difference between props and state in React, and when would you use each?",
        rubric: "Clearly distinguishes parent-provided read-only inputs from component-owned changing data, with a practical example.",
        points: 20,
        durationSeconds: 120,
      },
      {
        id: "react-performance",
        prompt: "A React page becomes slow when a user types in a search box. How would you investigate and improve it?",
        rubric: "Uses profiling, identifies unnecessary renders or expensive work, and discusses debounce, memoization, or list virtualization appropriately.",
        points: 20,
        durationSeconds: 180,
      },
      {
        id: "api-errors",
        prompt: "How would you design the UI states for data loaded from an API that can be slow or fail?",
        rubric: "Covers loading, success, empty and error states, retry behavior, and accessible user feedback.",
        points: 20,
        durationSeconds: 150,
      },
      {
        id: "debugging",
        prompt: "Tell us how you would debug a button that works locally but does nothing in production.",
        rubric: "Provides a structured process using reproduction, browser console/network tools, environment/config checks, logs, and a verified fix.",
        points: 20,
        durationSeconds: 180,
      },
    ],
  },
};

export function getInterviewTemplate(id: string): InterviewTemplate | null {
  return INTERVIEWS[id] ?? null;
}

export function toPublicInterview(interview: InterviewTemplate): PublicInterviewTemplate {
  return {
    id: interview.id,
    title: interview.title,
    role: interview.role,
    durationMinutes: interview.durationMinutes,
    questions: interview.questions.map(({ id, prompt, durationSeconds }) => ({
      id,
      prompt,
      durationSeconds,
    })),
  };
}
