import * as XLSX from "xlsx";
import type {
  ExperienceLevel,
  JobFocus,
  ProjectName,
  RiskLevel,
  StudentStage,
} from "@/types";

export type ImportField =
  | "name"
  | "student_email"
  | "phone"
  | "photo_url"
  | "batch"
  | "join_date"
  | "project"
  | "stage"
  | "job_focus"
  | "experience"
  | "risk_level"
  | "hired"
  | "hired_company_name"
  | "hired_date"
  | "terminated"
  | "terminated_reason"
  | "terminated_date"
  | "last_activity_date"
  | "attendance_date"
  | "attendance_session_type"
  | "attendance_status"
  | "assignment_completion_pct"
  | "notes"
  | "follow_up_date"
  | "interview_count";

export interface ColumnMapping {
  field: ImportField;
  source: string;
  confidence: number;
}

export interface ParsedWorkbook {
  headers: string[];
  rows: Record<string, unknown>[];
  mappings: ColumnMapping[];
}

export const IMPORT_FIELDS: {
  key: ImportField;
  label: string;
  required?: boolean;
}[] = [
  { key: "name", label: "Name", required: true },
  { key: "student_email", label: "Email", required: true },
  { key: "phone", label: "Phone" },
  { key: "photo_url", label: "Photo URL" },
  { key: "batch", label: "Batch" },
  { key: "join_date", label: "Join Date" },
  { key: "project", label: "Project" },
  { key: "stage", label: "Stage" },
  { key: "job_focus", label: "Job Focus" },
  { key: "experience", label: "Experience Level" },
  { key: "risk_level", label: "Risk Level" },
  { key: "hired", label: "Hired" },
  { key: "hired_company_name", label: "Hired Company Name" },
  { key: "hired_date", label: "Hired Date" },
  { key: "terminated", label: "Terminated" },
  { key: "terminated_reason", label: "Termination Reason" },
  { key: "terminated_date", label: "Termination Date" },
  { key: "last_activity_date", label: "Last Active Date" },
  { key: "attendance_date", label: "Attendance Date" },
  { key: "attendance_session_type", label: "Session Type" },
  { key: "attendance_status", label: "Attendance Status" },
  { key: "assignment_completion_pct", label: "Assignment Completion %" },
  { key: "notes", label: "Notes" },
  { key: "follow_up_date", label: "Follow-up Date" },
  { key: "interview_count", label: "Interview Count" },
];

const FIELD_ALIASES: Record<ImportField, string[]> = {
  name: ["name", "student name", "full name", "mentee", "student"],
  student_email: ["email", "student email", "email address", "student_email"],
  phone: ["phone", "mobile", "phone number", "contact"],
  photo_url: ["photo url", "photo", "avatar", "image"],
  batch: ["batch", "cohort"],
  join_date: ["join date", "joined", "enrollment date", "start date"],
  project: ["project", "program"],
  stage: ["stage", "pipeline stage", "status stage"],
  job_focus: ["job focus", "focus", "work mode"],
  experience: ["experience", "experience level", "exp"],
  risk_level: ["risk", "risk level", "risk status"],
  hired: ["hired", "is hired", "placed"],
  hired_company_name: [
    "company",
    "company name",
    "hired company",
    "placement company",
  ],
  hired_date: ["hired date", "placement date"],
  terminated: ["terminated", "is terminated", "dropped"],
  terminated_reason: ["termination reason", "terminated reason", "drop reason"],
  terminated_date: ["termination date", "terminated date"],
  last_activity_date: [
    "last active",
    "last active date",
    "last activity",
    "last activity date",
  ],
  attendance_date: ["attendance date", "date"],
  attendance_session_type: ["session type", "session", "class type"],
  attendance_status: ["attendance status", "status", "present absent"],
  assignment_completion_pct: [
    "assignment completion",
    "assignment completion %",
    "completion",
    "completion %",
  ],
  notes: ["notes", "note", "remarks", "comments"],
  follow_up_date: ["follow up", "follow-up", "follow-up date", "followup date"],
  interview_count: ["interview count", "interviews", "interview_count"],
};

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ");
}

function confidenceFor(field: ImportField, header: string) {
  const normalized = normalizeHeader(header);
  const aliases = FIELD_ALIASES[field];
  if (aliases.some((alias) => normalizeHeader(alias) === normalized))
    return 0.98;
  if (aliases.some((alias) => normalized.includes(normalizeHeader(alias))))
    return 0.82;
  if (aliases.some((alias) => normalizeHeader(alias).includes(normalized)))
    return 0.68;
  return 0;
}

export async function parseExcelFile(file: File): Promise<ParsedWorkbook> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
  });
  const headers = (matrix[0] || []).map(String).filter(Boolean);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
  });
  const mappings = autoMapColumns(headers);
  return { headers, rows, mappings };
}

export function autoMapColumns(headers: string[]): ColumnMapping[] {
  const used = new Set<string>();
  return IMPORT_FIELDS.map(({ key }) => {
    const best = headers
      .filter((header) => !used.has(header))
      .map((header) => ({ header, confidence: confidenceFor(key, header) }))
      .sort((a, b) => b.confidence - a.confidence)[0];
    if (best && best.confidence > 0.5) {
      used.add(best.header);
      return { field: key, source: best.header, confidence: best.confidence };
    }
    return { field: key, source: "", confidence: 0 };
  });
}

export function generateExcelTemplate(): void {
  const headers = IMPORT_FIELDS.map((f) => f.label);
  const worksheet = XLSX.utils.aoa_to_sheet([headers]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
  XLSX.writeFile(workbook, "placement_student_import_template.xlsx");
}

function text(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? "").trim();
}

function parseBool(value: unknown) {
  const v = text(value).toLowerCase();
  return ["yes", "y", "true", "1", "hired", "placed", "terminated"].includes(v);
}

function normalizeStage(value: unknown): StudentStage {
  const v = text(value).toLowerCase().replace(/\s+/g, "_");
  if (
    [
      "learning",
      "applying",
      "interviewing",
      "offer_pending",
      "placed",
      "hired",
    ].includes(v)
  )
    return v as StudentStage;
  if (v.includes("offer")) return "offer_pending";
  if (v.includes("interview")) return "interviewing";
  if (v.includes("apply")) return "applying";
  if (v.includes("place")) return "placed";
  if (v.includes("hire")) return "hired";
  return "learning";
}

function normalizeProject(value: unknown): ProjectName | "" {
  const raw = text(value);
  const projects: ProjectName[] = [
    "Kaizen",
    "Endgame",
    "Squid Game",
    "SCPC",
    "STN",
    "EAP",
    "Odyssey",
    "Other",
  ];
  return (
    projects.find((project) => project.toLowerCase() === raw.toLowerCase()) ??
    (raw ? "Other" : "")
  );
}

function normalizeFocus(value: unknown): JobFocus | "" {
  const v = text(value).toLowerCase();
  if (["remote", "onsite", "hybrid"].includes(v)) return v as JobFocus;
  return "";
}

function normalizeExperience(value: unknown): ExperienceLevel | "" {
  const v = text(value).toLowerCase();
  if (v.startsWith("fresh")) return "fresher";
  if (v.startsWith("exp")) return "experienced";
  return "";
}

function normalizeRisk(value: unknown): RiskLevel | "" {
  const v = text(value).toLowerCase();
  if (v === "safe" || v === "low") return "safe";
  if (v === "medium" || v === "at risk") return "medium";
  if (v === "high" || v === "critical") return "high";
  return "";
}

export function normalizeRows(
  rows: Record<string, unknown>[],
  mappings: ColumnMapping[],
) {
  const sourceFor = new Map(
    mappings.map((mapping) => [mapping.field, mapping.source]),
  );
  const value = (row: Record<string, unknown>, field: ImportField) => {
    const source = sourceFor.get(field);
    return source ? row[source] : "";
  };

  return rows.map((row, index) => {
    const stage = normalizeStage(value(row, "stage"));
    const hired = parseBool(value(row, "hired")) || stage === "hired";
    const terminated = parseBool(value(row, "terminated"));
    return {
      row_number: index + 2,
      student: {
        name: text(value(row, "name")),
        student_email: text(value(row, "student_email")),
        phone: text(value(row, "phone")),
        photo_url: text(value(row, "photo_url")),
        batch: text(value(row, "batch")),
        join_date: text(value(row, "join_date")),
        project: normalizeProject(value(row, "project")),
        stage,
        job_focus: normalizeFocus(value(row, "job_focus")),
        experience: normalizeExperience(value(row, "experience")),
        risk_override_level: normalizeRisk(value(row, "risk_level")),
        hired,
        hired_company_name: text(value(row, "hired_company_name")),
        hired_date: text(value(row, "hired_date")),
        terminated,
        terminated_reason: text(value(row, "terminated_reason")),
        terminated_date: text(value(row, "terminated_date")),
        last_activity_date: text(value(row, "last_activity_date")),
        assignment_completion_pct:
          Number(
            text(value(row, "assignment_completion_pct")).replace("%", ""),
          ) || undefined,
        notes: text(value(row, "notes")),
        follow_up_date: text(value(row, "follow_up_date")),
        interview_count: Number(text(value(row, "interview_count"))) || 0,
      },
      attendance:
        text(value(row, "attendance_date")) ||
        text(value(row, "attendance_status"))
          ? {
              date: text(value(row, "attendance_date")),
              session_type: text(value(row, "attendance_session_type")),
              status: text(value(row, "attendance_status")),
            }
          : null,
    };
  });
}
