export interface QuestionEvaluation {
  questionId: string;
  prompt: string;
  candidateAnswer: string;
  score: number;
  feedback: string;
  status: "Answered" | "Partially Answered" | "Incomplete / Silence";
}

export interface CandidateReport {
  id: string;
  interviewId: string;
  interviewTitle: string;
  batch: string;
  candidateEmail: string;
  score: number;
  maxScore: number;
  summary: string;
  strengths: string[];
  improvements: string[];
  tabSwitchCount: number;
  eyeContactScore: string;
  movementScore: string;
  completedAt: string;
  questionBreakdown: QuestionEvaluation[];
}

const STORAGE_KEY = "skillcheck_candidate_reports";

const DEFAULT_DUMMY_REPORTS: CandidateReport[] = [
  {
    id: "rep-001",
    interviewId: "batch_01_frontend",
    interviewTitle: "Batch-01 Frontend Developer Special Mock",
    batch: "Batch-01 (Web Dev)",
    candidateEmail: "student1@example.com",
    score: 88,
    maxScore: 100,
    summary: "Candidate demonstrated strong understanding of React state management and asynchronous JavaScript event loop execution.",
    strengths: [
      "Accurate explanation of call stack, microtask queue vs timer callbacks",
      "Clear distinction between state (component internal) and props (external inputs)",
      "Structured debugging approach for mobile responsive issues"
    ],
    improvements: [
      "Could elaborate further on React 18 automatic batching",
      "Mention browser performance profiler tools in more detail"
    ],
    tabSwitchCount: 0,
    eyeContactScore: "95% Direct Eye Contact",
    movementScore: "Stable Head & Body Position",
    completedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    questionBreakdown: [
      {
        questionId: "q1",
        prompt: "Explain the difference between state and props in React and how re-rendering works.",
        candidateAnswer: "Props are read-only inputs passed from parent components to children. State is local mutable data managed within a component using hooks like useState. When state changes, React schedules a re-render of that component and its children.",
        score: 95,
        feedback: "Excellent answer covering read-only nature of props and state updates triggering re-renders.",
        status: "Answered"
      },
      {
        questionId: "q2",
        prompt: "How does the JavaScript event loop handle asynchronous Promises versus setTimeout callbacks?",
        candidateAnswer: "Synchronous code runs first on the call stack. Promises resolve to the microtask queue which is processed immediately after the current task finishes. setTimeout callbacks go to the macrotask queue and run on subsequent event loop ticks.",
        score: 90,
        feedback: "Clear and accurate breakdown of microtasks vs macrotasks.",
        status: "Answered"
      },
      {
        questionId: "q3",
        prompt: "Describe how you would debug a responsive layout break on mobile devices.",
        candidateAnswer: "I inspect element styles using Chrome DevTools device mode, check viewport meta tags, examine CSS media queries, and check for fixed overflow widths.",
        score: 80,
        feedback: "Good practical debugging workflow.",
        status: "Answered"
      }
    ]
  },
  {
    id: "rep-002",
    interviewId: "batch_01_frontend",
    interviewTitle: "Batch-01 Frontend Developer Special Mock",
    batch: "Batch-01 (Web Dev)",
    candidateEmail: "rahul@example.com",
    score: 72,
    maxScore: 100,
    summary: "Candidate answered basic React questions well but paused on JavaScript event loop microtasks.",
    strengths: [
      "Good understanding of component props",
      "Clear communication on UI debugging"
    ],
    improvements: [
      "Review event loop task queues in JavaScript",
      "Avoid long silence during technical explanations"
    ],
    tabSwitchCount: 1,
    eyeContactScore: "82% Direct Eye Contact",
    movementScore: "Minor Head Tilt Detected",
    completedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    questionBreakdown: [
      {
        questionId: "q1",
        prompt: "Explain the difference between state and props in React and how re-rendering works.",
        candidateAnswer: "State changes inside component, props come from outside parent.",
        score: 75,
        feedback: "Correct basic idea, but concise.",
        status: "Partially Answered"
      },
      {
        questionId: "q2",
        prompt: "How does the JavaScript event loop handle asynchronous Promises versus setTimeout callbacks?",
        candidateAnswer: "Promises run fast and setTimeout waits for timer.",
        score: 60,
        feedback: "Missed microtask queue explanation.",
        status: "Partially Answered"
      },
      {
        questionId: "q3",
        prompt: "Describe how you would debug a responsive layout break on mobile devices.",
        candidateAnswer: "Use inspect element on mobile view and fix CSS flexbox or grid.",
        score: 80,
        feedback: "Solid answer.",
        status: "Answered"
      }
    ]
  }
];

export function saveCandidateReport(report: CandidateReport): void {
  if (typeof window === "undefined") return;
  try {
    const existing = getCandidateReports();
    // Prepend new report
    const updated = [report, ...existing.filter((r) => r.id !== report.id)];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to save candidate report:", err);
  }
}

export function getCandidateReports(interviewId?: string): CandidateReport[] {
  if (typeof window === "undefined") return DEFAULT_DUMMY_REPORTS;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_DUMMY_REPORTS));
      return DEFAULT_DUMMY_REPORTS;
    }
    const parsed: CandidateReport[] = JSON.parse(data);
    const reports = Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_DUMMY_REPORTS;
    return interviewId ? reports.filter((r) => r.interviewId === interviewId) : reports;
  } catch {
    return DEFAULT_DUMMY_REPORTS;
  }
}

export function getCandidateReportById(id: string): CandidateReport | null {
  const reports = getCandidateReports();
  return reports.find((r) => r.id === id) || null;
}
