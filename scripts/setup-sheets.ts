import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

// Load .env.local since ts-node doesn't auto-load it like Next.js
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { google } from 'googleapis';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const SHEETS = [
  'students', 'attendance_logs', 'progress_logs', 'users', 'notifications',
  'risk_history', 'mentor_tasks', 'companies', 'warnings', 'stage_history',
  'audit_log', 'analytics_events', 'daily_metrics', 'error_log', 'escalations',
  'cohorts', 'mentor_assignments', 'company_aliases', 'sheet_indexes', 'schema_migrations',
  'attendance_sessions', 'attendance_statuses', 'attendance_filter_presets',
  'student_upload_batches', 'report_deliveries', 'schema_constraints', 'data_quality_checks',
];

const HEADERS: Record<string, string[]> = {
  students: ['id', 'name', 'batch', 'project', 'mentor_email', 'student_email', 'stage', 'risk_status', 'risk_reasons', 'last_activity_date', 'job_focus', 'terminated', 'hired', 'experience', 'created_at', 'updated_at', 'risk_probability', 'risk_band', 'deleted_at', 'deleted_by', 'created_by', 'phone', 'photo_url', 'join_date', 'hired_company_name', 'hired_date', 'terminated_reason', 'terminated_date', 'assignment_completion_pct', 'follow_up_date', 'interview_count', 'notes', 'risk_override_level', 'risk_override_note', 'risk_override_expires_at'],
  attendance_logs: ['id', 'student_id', 'date', 'present', 'logged_by', 'session_label', 'excuse', 'excuse_note', 'created_at', 'updated_at', 'deleted_at', 'deleted_by', 'session_id', 'mode', 'period', 'duration_minutes', 'topic_tags', 'source', 'attendance_note', 'status_label', 'status_color', 'status_emoji', 'notified_at'],
  progress_logs: ['id', 'student_id', 'student_name', 'student_email', 'log_type', 'company_name', 'scheduled_date', 'scheduled_time', 'note', 'logged_at', 'logged_by', 'job_url', 'mock_feedback', 'mock_score', 'mock_strengths', 'mock_improvements', 'mock_interview_type', 'mock_interviewer', 'company_id', 'created_at', 'updated_at', 'deleted_at', 'deleted_by'],
  users: ['id', 'name', 'email', 'role', 'active', 'password_hash', 'last_login_at', 'created_at', 'updated_at', 'deleted_at', 'deleted_by'],
  notifications: ['id', 'recipient_email', 'type', 'student_id', 'student_name', 'message', 'read', 'created_at', 'payload', 'read_at', 'delivery_channel', 'deleted_at', 'updated_at', 'deleted_by'],
  risk_history: ['id', 'student_id', 'student_name', 'mentor_email', 'reasons', 'flagged_at', 'resolved_at', 'risk_probability', 'risk_band', 'created_at', 'created_by'],
  mentor_tasks: ['id', 'mentor_email', 'student_id', 'student_name', 'task_type', 'title', 'description', 'due_date', 'completed', 'completed_at', 'created_at', 'priority', 'source', 'assigned_by', 'updated_at', 'deleted_at', 'deleted_by'],
  companies: ['id', 'canonical_name', 'industry', 'size_range', 'location', 'contact_name', 'contact_email', 'hiring_status', 'notes', 'added_at', 'added_by', 'normalized_name', 'website', 'created_at', 'updated_at', 'deleted_at', 'deleted_by'],
  warnings: ['id', 'student_id', 'student_name', 'mentor_email', 'severity', 'reason', 'evidence_notes', 'status', 'created_at', 'created_by', 'resolved_at', 'resolved_by', 'resolution_notes', 'acknowledged_at', 'acknowledged_by', 'updated_at', 'deleted_at', 'deleted_by'],
  stage_history: ['id', 'student_id', 'from_stage', 'to_stage', 'transitioned_at', 'triggered_by', 'note', 'actor_email', 'created_at'],
  audit_log: ['id', 'actor_id', 'actor_email', 'actor_role', 'action', 'target_type', 'target_id', 'metadata', 'ip_address', 'user_agent', 'created_at', 'metadata_json'],
  analytics_events: ['id', 'event_type', 'actor_email', 'actor_role', 'student_id', 'student_name', 'created_at', 'payload', 'session_id', 'request_id'],
  daily_metrics: ['date', 'student_id', 'student_name', 'mentor_email', 'prs_total_score', 'prs_grade', 'activity_tier', 'leaderboard_rank', 'leaderboard_score', 'risk_probability', 'risk_band', 'tasks_completed', 'interviews_count', 'created_at', 'batch', 'project'],
  error_log: ['id', 'route', 'error_message', 'stack_trace', 'user_id', 'created_at', 'severity', 'request_id', 'resolved_at'],
  escalations: ['id', 'student_id', 'channel', 'message_id', 'raised_at', 'mentor_email', 'acknowledged_at', 'escalated_at', 'resolved_at', 'status', 'severity', 'description', 'created_at', 'updated_at', 'deleted_at', 'deleted_by'],
  cohorts: ['id', 'name', 'project', 'start_date', 'end_date', 'status', 'created_at', 'updated_at', 'deleted_at', 'deleted_by'],
  mentor_assignments: ['id', 'student_id', 'mentor_email', 'assigned_at', 'assigned_by', 'unassigned_at', 'status', 'created_at', 'updated_at', 'deleted_at', 'deleted_by'],
  company_aliases: ['id', 'company_id', 'alias', 'normalized_alias', 'created_at', 'created_by', 'updated_at', 'deleted_at', 'deleted_by'],
  sheet_indexes: ['id', 'sheet_name', 'index_name', 'columns', 'purpose', 'created_at'],
  schema_migrations: ['id', 'migration_name', 'applied_at', 'status', 'details'],
  attendance_sessions: ['id', 'mentor_email', 'date', 'mode', 'session_name', 'period', 'duration_minutes', 'topic_tags', 'batch_filter', 'default_status', 'visible_statuses', 'auto_close_minutes', 'check_in_url', 'notify_students', 'is_open', 'created_at', 'updated_at', 'closed_at', 'deleted_at', 'deleted_by'],
  attendance_statuses: ['id', 'mentor_email', 'label', 'kind', 'color', 'emoji', 'visible_for_modes', 'is_default', 'sort_order', 'created_at', 'updated_at', 'deleted_at', 'deleted_by'],
  attendance_filter_presets: ['id', 'mentor_email', 'name', 'search', 'batch', 'status', 'sort_order', 'created_at', 'updated_at', 'deleted_at', 'deleted_by'],
  student_upload_batches: ['id', 'uploaded_by', 'file_name', 'file_type', 'total_rows', 'accepted_rows', 'rejected_rows', 'status', 'validation_errors', 'created_at', 'completed_at', 'deleted_at', 'deleted_by'],
  report_deliveries: ['id', 'report_type', 'recipient_email', 'period_start', 'period_end', 'status', 'delivery_channel', 'provider_message_id', 'error_message', 'created_at', 'delivered_at'],
  schema_constraints: ['id', 'constraint_name', 'constraint_type', 'sheet_name', 'columns', 'referenced_sheet', 'referenced_columns', 'allowed_values', 'rule', 'on_delete', 'severity', 'active', 'created_at'],
  data_quality_checks: ['id', 'check_name', 'sheet_name', 'scope', 'status', 'checked_at', 'records_checked', 'issues_found', 'details'],
};

async function setupSheets() {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) {
    console.error('GOOGLE_SPREADSHEET_ID not set in .env.local');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  console.log('Checking spreadsheet...\n');

  for (const sheetName of SHEETS) {
    try {
      await sheets.spreadsheets.get({
        spreadsheetId,
        ranges: [sheetName],
      });
      console.log(`✓ Sheet "${sheetName}" exists`);
    } catch {
      console.log(`Creating sheet "${sheetName}"...`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{
            addSheet: {
              properties: { title: sheetName },
            },
          }],
        },
      });
      console.log(`✓ Sheet "${sheetName}" created`);
    }
  }

  console.log('\nAdding headers...\n');

  for (const [sheetName, headers] of Object.entries(HEADERS)) {
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1:Z1`,
        valueInputOption: 'RAW',
        requestBody: { values: [headers] },
      });
      console.log(`✓ Headers added to "${sheetName}"`);
    } catch (err) {
      console.error(`Error adding headers to "${sheetName}":`, err);
    }
  }

  console.log('\nCreating default admin user...\n');

  const adminPassword = 'admin123';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  const adminUser = [
    uuidv4(),
    'Admin User',
    'admin@example.com',
    'admin',
    'true',
    hashedPassword,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'users',
    valueInputOption: 'RAW',
    requestBody: { values: [adminUser] },
  });

  console.log('✓ Default admin user created');
  console.log(`  Email: admin@example.com`);
  console.log(`  Password: ${adminPassword}`);
  console.log('\n⚠️  IMPORTANT: Change the admin password after first login!\n');

  console.log('=== SETUP COMPLETE ===\n');
  console.log('Next steps:');
  console.log('1. Share your Google Sheet with the service account email:');
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');
  console.log(`   Email: ${credentials.client_email}`);
  console.log('2. Add your team members to the "users" sheet');
  console.log('3. Run: npm run dev');
}

setupSheets().catch(console.error);
