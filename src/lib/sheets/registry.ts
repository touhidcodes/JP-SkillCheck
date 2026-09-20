/**
 * Sheet Registry — Single source of truth for all Google Sheet tab names.
 *
 * Every sheet name used in the system is defined here. API routes and sheet
 * modules import from this registry instead of using raw string literals.
 * This prevents typos, makes renames safe, and documents the full data model
 * in one place.
 *
 * Data model (matches PROJECT_OVERVIEW.md):
 *
 * | Sheet Name       | Purpose                                              |
 * |------------------|------------------------------------------------------|
 * | students         | Student identity, batch, mentor, stage, risk status  |
 * | attendance_logs  | Daily attendance records with excuse tracking        |
 * | progress_logs    | Interviews, applications, offers, mock interviews    |
 * | users            | Login users (mentors and managers)                   |
 * | notifications    | System alerts and messages                           |
 * | risk_history     | Risk status changes over time                        |
 * | mentor_tasks     | Mentor to-do items (manual + auto-generated)         |
 * | companies        | Hiring companies and partners                        |
 * | warnings         | Formal warning records                               |
 * | stage_history    | Student movement between stages                      |
 * | audit_log        | Important system actions                             |
 * | analytics_events | Mentor and student activity logs                       |
 * | daily_metrics    | Precomputed summary statistics                       |
 * | error_log        | Technical errors for debugging                       |
 * | escalations      | SLA response tracking for urgent student issues      |
 * | cohorts          | Normalized cohort/batch metadata                     |
 * | mentor_assignments | Historical student-to-mentor assignments           |
 * | company_aliases  | Company name normalization aliases                   |
 * | sheet_indexes    | Documented lookup/index strategy                     |
 * | schema_migrations | Applied migration log                               |
 * | student_upload_batches | Bulk upload validation and processing audit     |
 * | report_deliveries | Weekly/on-demand report delivery audit              |
 * | schema_constraints | Logical constraints, enums, FKs, cascade rules      |
 * | data_quality_checks | Migration and integrity validation results        |
 */

export const SHEETS = {
  STUDENTS:         'students',
  ATTENDANCE_LOGS:  'attendance_logs',
  PROGRESS_LOGS:    'progress_logs',
  USERS:            'users',
  NOTIFICATIONS:    'notifications',
  RISK_HISTORY:     'risk_history',
  MENTOR_TASKS:     'mentor_tasks',
  COMPANIES:        'companies',
  WARNINGS:         'warnings',
  STAGE_HISTORY:    'stage_history',
  AUDIT_LOG:        'audit_log',
  ANALYTICS_EVENTS: 'analytics_events',
  DAILY_METRICS:    'daily_metrics',
  ERROR_LOG:        'error_log',
  ESCALATIONS:      'escalations',
  COHORTS:          'cohorts',
  MENTOR_ASSIGNMENTS: 'mentor_assignments',
  COMPANY_ALIASES:  'company_aliases',
  SHEET_INDEXES:    'sheet_indexes',
  SCHEMA_MIGRATIONS: 'schema_migrations',
  ATTENDANCE_SESSIONS: 'attendance_sessions',
  ATTENDANCE_STATUSES: 'attendance_statuses',
  ATTENDANCE_FILTER_PRESETS: 'attendance_filter_presets',
  STUDENT_UPLOAD_BATCHES: 'student_upload_batches',
  REPORT_DELIVERIES: 'report_deliveries',
  SCHEMA_CONSTRAINTS: 'schema_constraints',
  DATA_QUALITY_CHECKS: 'data_quality_checks',
  INTERVIEW_RESULTS: 'interview_results',
} as const;

export type SheetName = (typeof SHEETS)[keyof typeof SHEETS];

/**
 * Column definitions for each sheet.
 * Used for documentation, template generation, and validation.
 * Index matches the column position in the sheet (0-based).
 */
export const SHEET_COLUMNS: Record<SheetName, readonly string[]> = {
  students: [
    'id', 'name', 'batch', 'project', 'mentor_email', 'student_email',
    'stage', 'risk_status', 'risk_reasons', 'last_activity_date',
    'job_focus', 'terminated', 'hired', 'experience', 'created_at', 'updated_at',
    'risk_probability', 'risk_band', 'deleted_at', 'deleted_by', 'created_by',
    'phone', 'photo_url', 'join_date', 'hired_company_name', 'hired_date',
    'terminated_reason', 'terminated_date', 'assignment_completion_pct',
    'follow_up_date', 'interview_count', 'notes', 'risk_override_level',
    'risk_override_note', 'risk_override_expires_at',
  ],
  attendance_logs: [
    'id', 'student_id', 'date', 'present', 'logged_by',
    'session_label', 'excuse', 'excuse_note', 'created_at', 'updated_at', 'deleted_at', 'deleted_by',
    'session_id', 'mode', 'period', 'duration_minutes', 'topic_tags', 'source',
    'attendance_note', 'status_label', 'status_color', 'status_emoji', 'notified_at',
  ],
  progress_logs: [
    'id', 'student_id', 'student_name', 'student_email', 'log_type',
    'company_name', 'scheduled_date', 'scheduled_time', 'note', 'logged_at',
    'logged_by', 'job_url', 'mock_feedback', 'mock_score', 'mock_strengths',
    'mock_improvements', 'mock_interview_type', 'mock_interviewer',
    'company_id', 'created_at', 'updated_at', 'deleted_at', 'deleted_by',
  ],
  users: [
    'id', 'name', 'email', 'role', 'active', 'password_hash',
    'last_login_at', 'created_at', 'updated_at', 'deleted_at', 'deleted_by',
  ],
  notifications: [
    'id', 'recipient_email', 'type', 'student_id', 'student_name',
    'message', 'read', 'created_at', 'payload', 'read_at', 'delivery_channel', 'deleted_at',
    'updated_at', 'deleted_by',
  ],
  risk_history: [
    'id', 'student_id', 'student_name', 'mentor_email', 'reasons',
    'flagged_at', 'resolved_at', 'risk_probability', 'risk_band', 'created_at', 'created_by',
  ],
  mentor_tasks: [
    'id', 'mentor_email', 'student_id', 'student_name', 'task_type',
    'title', 'description', 'due_date', 'completed', 'completed_at',
    'created_at', 'priority', 'source', 'assigned_by', 'updated_at', 'deleted_at', 'deleted_by',
  ],
  companies: [
    'id', 'canonical_name', 'industry', 'size_range', 'location',
    'contact_name', 'contact_email', 'hiring_status', 'notes',
    'added_at', 'added_by', 'normalized_name', 'website', 'created_at', 'updated_at', 'deleted_at', 'deleted_by',
  ],
  warnings: [
    'id', 'student_id', 'student_name', 'mentor_email', 'severity',
    'reason', 'evidence_notes', 'status', 'created_at', 'created_by',
    'resolved_at', 'resolved_by', 'resolution_notes', 'acknowledged_at', 'acknowledged_by',
    'updated_at', 'deleted_at', 'deleted_by',
  ],
  stage_history: [
    'id', 'student_id', 'from_stage', 'to_stage',
    'transitioned_at', 'triggered_by', 'note', 'actor_email', 'created_at',
  ],
  audit_log: [
    'id', 'actor_id', 'actor_email', 'actor_role', 'action',
    'target_type', 'target_id', 'metadata', 'ip_address',
    'user_agent', 'created_at', 'metadata_json',
  ],
  analytics_events: [
    'id', 'event_type', 'actor_email', 'actor_role',
    'student_id', 'student_name', 'created_at', 'payload', 'session_id', 'request_id',
  ],
  daily_metrics: [
    'date', 'student_id', 'student_name', 'mentor_email',
    'prs_total_score', 'prs_grade', 'activity_tier',
    'leaderboard_rank', 'leaderboard_score', 'risk_probability', 'risk_band',
    'tasks_completed', 'interviews_count', 'created_at', 'batch', 'project',
  ],
  error_log: [
    'id', 'route', 'error_message', 'stack_trace', 'user_id', 'created_at',
    'severity', 'request_id', 'resolved_at',
  ],
  escalations: [
    'id', 'student_id', 'channel', 'message_id', 'raised_at', 'mentor_email',
    'acknowledged_at', 'escalated_at', 'resolved_at', 'status', 'severity',
    'description', 'created_at', 'updated_at', 'deleted_at', 'deleted_by',
  ],
  cohorts: [
    'id', 'name', 'project', 'start_date', 'end_date', 'status', 'created_at', 'updated_at', 'deleted_at', 'deleted_by',
  ],
  mentor_assignments: [
    'id', 'student_id', 'mentor_email', 'assigned_at', 'assigned_by', 'unassigned_at',
    'status', 'created_at', 'updated_at', 'deleted_at', 'deleted_by',
  ],
  company_aliases: [
    'id', 'company_id', 'alias', 'normalized_alias', 'created_at', 'created_by', 'updated_at', 'deleted_at', 'deleted_by',
  ],
  sheet_indexes: [
    'id', 'sheet_name', 'index_name', 'columns', 'purpose', 'created_at',
  ],
  schema_migrations: [
    'id', 'migration_name', 'applied_at', 'status', 'details',
  ],
  attendance_sessions: [
    'id', 'mentor_email', 'date', 'mode', 'session_name', 'period', 'duration_minutes',
    'topic_tags', 'batch_filter', 'default_status', 'visible_statuses', 'auto_close_minutes',
    'check_in_url', 'notify_students', 'is_open', 'created_at', 'updated_at', 'closed_at', 'deleted_at', 'deleted_by',
  ],
  attendance_statuses: [
    'id', 'mentor_email', 'label', 'kind', 'color', 'emoji', 'visible_for_modes',
    'is_default', 'sort_order', 'created_at', 'updated_at', 'deleted_at', 'deleted_by',
  ],
  attendance_filter_presets: [
    'id', 'mentor_email', 'name', 'search', 'batch', 'status', 'sort_order', 'created_at', 'updated_at', 'deleted_at', 'deleted_by',
  ],
  student_upload_batches: [
    'id', 'uploaded_by', 'file_name', 'file_type', 'total_rows', 'accepted_rows',
    'rejected_rows', 'status', 'validation_errors', 'created_at', 'completed_at',
    'deleted_at', 'deleted_by',
  ],
  report_deliveries: [
    'id', 'report_type', 'recipient_email', 'period_start', 'period_end',
    'status', 'delivery_channel', 'provider_message_id', 'error_message',
    'created_at', 'delivered_at',
  ],
  schema_constraints: [
    'id', 'constraint_name', 'constraint_type', 'sheet_name', 'columns',
    'referenced_sheet', 'referenced_columns', 'allowed_values', 'rule',
    'on_delete', 'severity', 'active', 'created_at',
  ],
  data_quality_checks: [
    'id', 'check_name', 'sheet_name', 'scope', 'status', 'checked_at',
    'records_checked', 'issues_found', 'details',
  ],
  interview_results: [
    'id', 'interview_id', 'score', 'max_score', 'summary', 'strengths',
    'improvements', 'question_count', 'completed_at',
  ],
} as const;
