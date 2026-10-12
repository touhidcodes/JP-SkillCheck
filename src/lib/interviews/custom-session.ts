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
  questions: Array<{
    id: string;
    prompt: string;
    durationSeconds: number;
  }>;
}

const STORAGE_KEY = "skillcheck_custom_interviews";

const DEFAULT_DUMMY_SESSIONS: Record<string, CustomInterviewSession> = {
  "batch_01_frontend": {
    id: "batch_01_frontend",
    title: "Batch-01 Frontend Developer Special Mock",
    batch: "Batch-01 (Web Dev)",
    role: "Junior Frontend Developer",
    durationMinutes: 30,
    cameraMandatory: true,
    allowedEmails: [
      "student1@example.com",
      "student2@example.com",
      "rahul@example.com",
      "sumaiya@example.com",
      "nusrat@example.com"
    ],
    slotStartTime: new Date(Date.now() - 30 * 60 * 1000).toISOString().slice(0, 16),
    slotEndTime: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 16),
    skills: ["React", "JavaScript", "Tailwind CSS", "HTML/CSS"],
    instructions: "Ensure camera is enabled. Voice transcription active.",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    questions: [
      {
        id: "q1",
        prompt: "Explain the difference between state and props in React and how re-rendering works.",
        durationSeconds: 180,
      },
      {
        id: "q2",
        prompt: "How does the JavaScript event loop handle asynchronous Promises versus setTimeout callbacks?",
        durationSeconds: 180,
      },
      {
        id: "q3",
        prompt: "Describe how you would debug a responsive layout break on mobile devices.",
        durationSeconds: 180,
      }
    ]
  },
  "batch_02_fullstack": {
    id: "batch_02_fullstack",
    title: "Batch-02 Fullstack Node & React Assessment",
    batch: "Batch-02 (Frontend)",
    role: "Fullstack Web Developer",
    durationMinutes: 45,
    cameraMandatory: true,
    allowedEmails: [
      "arafat@example.com",
      "farhana@example.com",
      "sakib@example.com",
      "tanjim@example.com"
    ],
    slotStartTime: new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16),
    slotEndTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString().slice(0, 16),
    skills: ["Next.js", "Node.js", "MongoDB", "TypeScript"],
    instructions: "Camera ON required. Time slot opens in 1 hour.",
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    questions: [
      {
        id: "q1",
        prompt: "Explain RESTful API design principles and JWT authentication flow.",
        durationSeconds: 180,
      },
      {
        id: "q2",
        prompt: "What are the key advantages of Next.js App Router and Server Components?",
        durationSeconds: 180,
      }
    ]
  }
};

export function saveCustomInterview(session: CustomInterviewSession): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getCustomInterviews();
    existing[session.id] = session;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));

    // Async sync to Google Sheet tabs created_interviews & students
    fetch("/api/interview/save-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session),
    }).catch(() => {
      // Ignore background sync errors
    });
  } catch (err) {
    console.error("Failed to save custom interview:", err);
  }
}

export function getCustomInterviews(): Record<string, CustomInterviewSession> {
  if (typeof window === "undefined") return DEFAULT_DUMMY_SESSIONS;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DUMMY_SESSIONS));
      return DEFAULT_DUMMY_SESSIONS;
    }
    const parsed = JSON.parse(data);
    let updated = false;

    // Refresh dummy test sessions if their slotEndTime has expired
    for (const key of ["batch_01_frontend", "batch_02_fullstack"]) {
      if (parsed[key]) {
        const end = new Date(parsed[key].slotEndTime).getTime();
        if (isNaN(end) || end < Date.now()) {
          parsed[key].slotStartTime = new Date(Date.now() - 30 * 60 * 1000).toISOString().slice(0, 16);
          parsed[key].slotEndTime = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString().slice(0, 16);
          updated = true;
        }
      } else {
        parsed[key] = DEFAULT_DUMMY_SESSIONS[key];
        updated = true;
      }
    }

    if (updated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    return Object.keys(parsed).length > 0 ? parsed : DEFAULT_DUMMY_SESSIONS;
  } catch {
    return DEFAULT_DUMMY_SESSIONS;
  }
}

export function getCustomInterviewById(id: string): CustomInterviewSession | null {
  const sessions = getCustomInterviews();
  const session = sessions[id];
  if (!session) return null;

  // Ensure test sessions always have a valid, active slot window
  const now = Date.now();
  const start = session.slotStartTime ? new Date(session.slotStartTime).getTime() : null;
  const end = session.slotEndTime ? new Date(session.slotEndTime).getTime() : null;

  if (!end || isNaN(end) || end < now || (start && start > now + 12 * 3600 * 1000)) {
    session.slotStartTime = new Date(now - 60 * 60 * 1000).toISOString().slice(0, 16);
    session.slotEndTime = new Date(now + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  }

  return session;
}
