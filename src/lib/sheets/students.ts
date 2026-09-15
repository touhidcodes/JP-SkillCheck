import { readSheet, appendRow, updateRow, findRowIndex } from "./client";
import type {
  Student,
  StudentStage,
  RiskStatus,
  JobFocus,
  ExperienceLevel,
  ProjectName,
} from "@/types";
import { v4 as uuidv4 } from "uuid";

/**
 * Sheet columns (extended additive production/import columns):
 *  0: id
 *  1: name
 *  2: batch
 *  3: project
 *  4: mentor_email
 *  5: student_email    ← new (direct email for absent notifications)
 *  6: stage
 *  7: risk_status
 *  8: risk_reasons
 *  9: last_activity_date
 * 10: job_focus
 * 11: terminated
 * 12: hired
 * 13: experience
 * 14: created_at
 * 15: updated_at
 * 16: risk_probability
 * 17: risk_band
 * 18: deleted_at
 * 19: deleted_by
 * 20: created_by
 * 21: phone
 * 22: photo_url
 * 23: join_date
 * 24: hired_company_name
 * 25: hired_date
 * 26: terminated_reason
 * 27: terminated_date
 * 28: assignment_completion_pct
 * 29: follow_up_date
 * 30: interview_count
 * 31: notes
 * 32: risk_override_level
 * 33: risk_override_note
 * 34: risk_override_expires_at
 *
 * Backward compatibility: rows with < 16 cols get empty student_email.
 * The isNewSchema heuristic detects old 14-col and 15-col rows.
 */

const VALID_STAGES = new Set([
  "learning",
  "applying",
  "interviewing",
  "offer_pending",
  "placed",
  "hired",
]);

function normalizeStage(raw: string): StudentStage {
  const s = (raw || "").toLowerCase().trim();
  if (VALID_STAGES.has(s)) return s as StudentStage;

  const map: Record<string, StudentStage> = {
    beginner: "learning",
    intermediate: "applying",
    advanced: "interviewing",
    bogliner: "learning",
    boginner: "learning",
    learn: "learning",
    apply: "applying",
    applied: "applying",
    interview: "interviewing",
    interviewed: "interviewing",
    offer: "offer_pending",
    "offer pending": "offer_pending",
    place: "placed",
    hire: "hired",
  };
  if (map[s]) return map[s];

  if (s.startsWith("learn")) return "learning";
  if (s.startsWith("apply") || s.startsWith("appli")) return "applying";
  if (s.startsWith("interview")) return "interviewing";
  if (s.startsWith("offer")) return "offer_pending";
  if (s.startsWith("place")) return "placed";
  if (s.startsWith("hire")) return "hired";

  return "learning";
}

/**
 * Schema detection:
 *   16+ cols → new schema (project + student_email, optional additive fields)
 *   15 cols  → intermediate schema (project, no student_email)
 *   14 cols  → old schema (no project, no student_email)
 *   col 3 contains '@' → old schema (mentor_email was at col 3)
 */
function detectSchema(row: string[]): "new" | "intermediate" | "old" {
  if (row.length >= 16) return "new";
  if (row.length === 15) return "intermediate";
  if (row.length >= 4 && row[3].includes("@")) return "old";
  return "old";
}

function rowToStudent(row: string[]): Student {
  const schema = detectSchema(row);

  if (row.length < 14) {
    console.warn(
      `[Students] Row with unexpected column count (${row.length}):`,
      row.slice(0, 3),
    );
  }

  if (schema === "new") {
    return {
      id: row[0] || "",
      name: row[1] || "",
      batch: row[2] || "",
      project: (row[3] || "") as ProjectName | "",
      mentor_email: row[4] || "",
      student_email: row[5] || "",
      stage: normalizeStage(row[6]),
      risk_status: (row[7] as RiskStatus) || "safe",
      risk_reasons: row[8] || "",
      last_activity_date: row[9] || "",
      job_focus: (row[10] as JobFocus) || "",
      terminated: row[11] === "true",
      hired: row[12] === "true",
      experience: (row[13] as ExperienceLevel) || "",
      created_at: row[14] || "",
      updated_at: row[15] || "",
      risk_probability: row[16] ? parseFloat(row[16]) : undefined,
      risk_band: row[17] || undefined,
      deleted_at: row[18] || "",
      deleted_by: row[19] || "",
      created_by: row[20] || "",
      phone: row[21] || "",
      photo_url: row[22] || "",
      join_date: row[23] || "",
      hired_company_name: row[24] || "",
      hired_date: row[25] || "",
      terminated_reason: row[26] || "",
      terminated_date: row[27] || "",
      assignment_completion_pct: row[28] ? parseFloat(row[28]) : undefined,
      follow_up_date: row[29] || "",
      interview_count: row[30] ? parseInt(row[30], 10) : undefined,
      notes: row[31] || "",
      risk_override_level: (row[32] as Student["risk_override_level"]) || "",
      risk_override_note: row[33] || "",
      risk_override_expires_at: row[34] || "",
    };
  }

  if (schema === "intermediate") {
    // 15-col: project at col 3, no student_email
    return {
      id: row[0] || "",
      name: row[1] || "",
      batch: row[2] || "",
      project: (row[3] || "") as ProjectName | "",
      mentor_email: row[4] || "",
      student_email: "",
      stage: normalizeStage(row[5]),
      risk_status: (row[6] as RiskStatus) || "safe",
      risk_reasons: row[7] || "",
      last_activity_date: row[8] || "",
      job_focus: (row[9] as JobFocus) || "",
      terminated: row[10] === "true",
      hired: row[11] === "true",
      experience: (row[12] as ExperienceLevel) || "",
      created_at: row[13] || "",
      updated_at: row[14] || "",
    };
  }

  // Old schema — no project, no student_email (mentor_email at col 3)
  return {
    id: row[0] || "",
    name: row[1] || "",
    batch: row[2] || "",
    project: "",
    mentor_email: row[3] || "",
    student_email: "",
    stage: normalizeStage(row[4]),
    risk_status: (row[5] as RiskStatus) || "safe",
    risk_reasons: row[6] || "",
    last_activity_date: row[7] || "",
    job_focus: (row[8] as JobFocus) || "",
    terminated: row[9] === "true",
    hired: row[10] === "true",
    experience: (row[11] as ExperienceLevel) || "",
    created_at: row[12] || "",
    updated_at: row[13] || "",
  };
}

export function studentToRow(student: Partial<Student>): unknown[] {
  return [
    student.id || "",
    student.name || "",
    student.batch || "",
    student.project || "",
    student.mentor_email || "",
    student.student_email || "",
    student.stage || "learning",
    student.risk_status || "safe",
    student.risk_reasons || "",
    student.last_activity_date || "",
    student.job_focus || "",
    String(student.terminated ?? false),
    String(student.hired ?? false),
    student.experience || "",
    student.created_at || "",
    student.updated_at || "",
    student.risk_probability ?? "",
    student.risk_band || "",
    student.deleted_at || "",
    student.deleted_by || "",
    student.created_by || "",
    student.phone || "",
    student.photo_url || "",
    student.join_date || "",
    student.hired_company_name || "",
    student.hired_date || "",
    student.terminated_reason || "",
    student.terminated_date || "",
    student.assignment_completion_pct ?? "",
    student.follow_up_date || "",
    student.interview_count ?? "",
    student.notes || "",
    student.risk_override_level || "",
    student.risk_override_note || "",
    student.risk_override_expires_at || "",
  ];
}

export async function getAllStudents(): Promise<Student[]> {
  const rows = await readSheet("students");
  return rows.map(rowToStudent);
}

export async function getStudentById(id: string): Promise<Student | null> {
  const students = await getAllStudents();
  return students.find((s) => s.id === id) || null;
}

export async function getStudentByEmail(
  email: string,
): Promise<Student | null> {
  const normalized = email.trim().toLowerCase();
  const students = await getAllStudents();
  return (
    students.find(
      (s) => (s.student_email || "").trim().toLowerCase() === normalized,
    ) || null
  );
}

export async function createStudent(
  data: Pick<Student, "name" | "batch" | "mentor_email"> & {
    project?: Student["project"];
    student_email?: string;
    job_focus?: Student["job_focus"];
    experience?: Student["experience"];
    phone?: string;
    photo_url?: string;
    join_date?: string;
    hired_company_name?: string;
    hired_date?: string;
    terminated_reason?: string;
    terminated_date?: string;
    assignment_completion_pct?: number;
    follow_up_date?: string;
    interview_count?: number;
    notes?: string;
  },
): Promise<Student> {
  const now = new Date().toISOString();
  const student: Student = {
    id: uuidv4(),
    name: data.name,
    batch: data.batch,
    project: data.project || "",
    mentor_email: data.mentor_email,
    student_email: data.student_email || "",
    stage: "learning",
    risk_status: "safe",
    risk_reasons: "",
    last_activity_date: now,
    job_focus: data.job_focus || "",
    terminated: false,
    hired: false,
    created_at: now,
    updated_at: now,
    experience: data.experience || "",
    created_by: data.mentor_email,
    phone: data.phone || "",
    photo_url: data.photo_url || "",
    join_date: data.join_date || "",
    hired_company_name: data.hired_company_name || "",
    hired_date: data.hired_date || "",
    terminated_reason: data.terminated_reason || "",
    terminated_date: data.terminated_date || "",
    assignment_completion_pct: data.assignment_completion_pct,
    follow_up_date: data.follow_up_date || "",
    interview_count: data.interview_count,
    notes: data.notes || "",
  };
  await appendRow("students", studentToRow(student));
  return student;
}

export async function updateStudent(
  id: string,
  data: Partial<Student>,
): Promise<Student | null> {
  const rowIndex = await findRowIndex("students", 0, id);
  if (rowIndex === -1) return null;

  const existing = await getStudentById(id);
  if (!existing) return null;

  const updated: Student = {
    ...existing,
    ...data,
    updated_at: new Date().toISOString(),
  };

  await updateRow("students", rowIndex, studentToRow(updated));
  return updated;
}

export async function getStudentsByMentor(
  mentorEmail: string,
): Promise<Student[]> {
  const students = await getAllStudents();
  return students.filter((s) => s.mentor_email === mentorEmail);
}

export async function filterStudents(filters: {
  stage?: StudentStage;
  risk_status?: RiskStatus;
  batch?: string;
  project?: string;
  mentor_email?: string;
  job_focus?: string;
  terminated?: boolean;
  hired?: boolean;
  search?: string;
  experience?: string;
}): Promise<Student[]> {
  let students = await getAllStudents();

  if (filters.search) {
    const q = filters.search.toLowerCase();
    students = students.filter((s) => s.name.toLowerCase().includes(q));
  }
  if (filters.stage) {
    students = students.filter((s) => s.stage === filters.stage);
  }
  if (filters.risk_status) {
    students = students.filter((s) => s.risk_status === filters.risk_status);
  }
  if (filters.batch) {
    students = students.filter(
      (s) => s.batch.toLowerCase() === filters.batch!.toLowerCase(),
    );
  }
  if (filters.project) {
    students = students.filter((s) => s.project === filters.project);
  }
  if (filters.mentor_email) {
    students = students.filter((s) => s.mentor_email === filters.mentor_email);
  }
  if (filters.job_focus) {
    students = students.filter((s) => s.job_focus === filters.job_focus);
  }
  if (filters.terminated !== undefined) {
    students = students.filter((s) => s.terminated === filters.terminated);
  }
  if (filters.hired !== undefined) {
    students = students.filter((s) => s.hired === filters.hired);
  }
  if (filters.experience) {
    students = students.filter((s) => s.experience === filters.experience);
  }

  return students;
}
