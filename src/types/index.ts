export type StudentStage = "learning" | "applying" | "interviewing" | "offer_pending" | "placed" | "hired";

export type RiskStatus = "safe" | "at_risk";

export type RiskLevel = "safe" | "medium" | "high";

export type JobFocus = "remote" | "onsite" | "hybrid";

export type ExperienceLevel = "fresher" | "experienced";

export type UserRole = "manager" | "mentor";

export type ProjectName =
  | 'Endgame'
  | 'SCPC'
  | 'EAP'
  | 'Squid Game'
  | 'Kaizen'
  | 'Odyssey'
  | 'STN'
  | 'Other';

export const PROJECT_NAMES: ProjectName[] = [
  'Endgame', 'SCPC', 'EAP', 'Squid Game', 'Kaizen', 'Odyssey', 'STN', 'Other',
];

export interface Student {
  id: string;
  name: string;
  batch: string;
  /** Project/program name — e.g. "Endgame", "SCPC", "EAP" */
  project: ProjectName | '';
  mentor_email: string;
  /** Student's personal email for direct notifications (absent emails, show cause) */
  student_email?: string;
  stage: StudentStage;
  risk_status: RiskStatus;
  risk_reasons: string;
  /** From probability-based risk scoring (0.0–1.0) */
  risk_probability?: number;
  /** From probability-based risk scoring: safe|watch|concern|at_risk|critical */
  risk_band?: string;
  last_activity_date: string;
  job_focus: JobFocus | "";
  terminated: boolean;
  hired: boolean;
  created_at: string;
  updated_at: string;
  experience: ExperienceLevel | "";
  deleted_at?: string;
  deleted_by?: string;
  created_by?: string;
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
  risk_override_level?: RiskLevel | '';
  risk_override_note?: string;
  risk_override_expires_at?: string;
}

/**
 * Activity rubric tiers — computed from attendance rate + weekly activity.
 * Used in analytics and leaderboard to classify student engagement.
 */
export type ActivityTier = 'Excellent' | 'Good' | 'Moderate' | 'Inactive' | 'Critical';

export type AbsenceExcuse = 'exam' | 'sick' | 'personal' | 'other';

export interface AttendanceLog {
  id: string;
  student_id: string;
  date: string;
  present: boolean;
  logged_by: string;
  session_label?: string;
  excuse?: AbsenceExcuse | '';
  excuse_note?: string;
  status_label?: string;
}

export type ProgressLogType = "Interview Call" | "Job Applied" | "Mock Interview" | "Job Task" | "Offer" | "Other";

export type MockInterviewType = 'technical' | 'behavioral' | 'system_design' | 'hr' | 'mock';

export interface ProgressLog {
  id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  log_type: ProgressLogType;
  company_name: string;
  scheduled_date: string;
  scheduled_time: string;
  note: string;
  logged_at: string;
  logged_by: string;
  job_url?: string;
  mock_feedback?: string;
  mock_score?: number;
  mock_strengths?: string;
  mock_improvements?: string;
  mock_interview_type?: MockInterviewType;
  mock_interviewer?: string;
  company_id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  deleted_by?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
}

export interface JWTPayload {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface RiskResult {
  is_at_risk: boolean;
  reasons: string[];
}

export interface PlacementStats {
  learning: number;
  applying: number;
  interviewing: number;
  offer_pending: number;
  placed: number;
  hired: number;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export type MentorTaskType =
  | 'follow_up'
  | 'schedule_interview'
  | 'review_progress'
  | 'risk_check'
  | 'update_student_data'
  | 'other';

export interface MentorTask {
  id: string;
  mentor_email: string;
  student_id?: string;
  student_name?: string;
  task_type: MentorTaskType;
  title: string;
  description: string;
  due_date: string;
  completed: boolean;
  completed_at: string;
  created_at: string;
  priority: TaskPriority;
  source: 'auto' | 'manual';
}

export interface RiskScore {
  student_id: string;
  score: number;
  level: RiskLevel;
  previous_level?: RiskLevel;
  top_factor: string;
  recommended_action: string;
  factors: {
    attendance: number;
    inactivity: number;
    stage_stagnation: number;
    interview_progress: number;
    assignment_completion: number;
    communication_gap: number;
  };
  calculated_at: string;
  manual_override?: {
    level: RiskLevel;
    note: string;
    expires_at: string;
  };
}

export interface PlacementNote {
  id: string;
  student_id: string;
  student_name: string;
  body: string;
  created_at: string;
  created_by: string;
}

export interface PlacementAlert {
  id: string;
  student_id: string;
  student_name: string;
  level: RiskLevel;
  message: string;
  created_at: string;
  status: 'open' | 'dismissed' | 'resolved';
}

export interface ImportBatch {
  id: string;
  file_name: string;
  total_rows: number;
  imported: number;
  updated: number;
  conflicts: number;
  created_at: string;
}
