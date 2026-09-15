/**
 * MIGRATION: 002_production_schema_alignment
 *
 * Purpose: Aligns the Google Sheets database with PROJECT_OVERVIEW.md using
 * additive, production-safe changes. Existing columns are never reordered or
 * removed; missing columns are appended so existing data and index-based code
 * keep working.
 *
 * This migration also creates relationship/support sheets that Google Sheets
 * needs to model production database concepts safely:
 * - mentor_assignments: historical student-to-mentor assignments
 * - cohorts: normalized batch/cohort metadata
 * - company_aliases: canonical company name normalization support
 * - schema_migrations: migration audit trail
 * - sheet_indexes: documented lookup/index strategy for Sheets and future SQL
 *
 * Re-run safety: idempotent. It only creates missing sheets, appends missing
 * headers, and backfills rows that do not already exist.
 */

const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const { randomUUID } = require('crypto');

const envPath = path.resolve(__dirname, '../../.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (!match) return;
      const key = match[1].trim();
      const val = match[2].trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
      if (!process.env[key]) process.env[key] = val;
    });
}

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const GOOGLE_SERVICE_ACCOUNT = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');

if (!SPREADSHEET_ID) {
  console.error('GOOGLE_SPREADSHEET_ID is required');
  process.exit(1);
}

const sheets = google.sheets({
  version: 'v4',
  auth: new google.auth.GoogleAuth({
    credentials: GOOGLE_SERVICE_ACCOUNT,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  }),
});

const SCHEMAS = {
  students: [
    'id', 'name', 'batch', 'project', 'mentor_email', 'student_email',
    'stage', 'risk_status', 'risk_reasons', 'last_activity_date',
    'job_focus', 'terminated', 'hired', 'experience', 'created_at', 'updated_at',
    'risk_probability', 'risk_band', 'deleted_at', 'deleted_by',
  ],
  attendance_logs: [
    'id', 'student_id', 'date', 'present', 'logged_by', 'session_label',
    'excuse', 'excuse_note', 'created_at', 'updated_at', 'deleted_at', 'deleted_by',
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
    'id', 'recipient_email', 'type', 'student_id', 'student_name', 'message',
    'read', 'created_at', 'payload', 'read_at', 'delivery_channel', 'deleted_at',
  ],
  risk_history: [
    'id', 'student_id', 'student_name', 'mentor_email', 'reasons', 'flagged_at',
    'resolved_at', 'risk_probability', 'risk_band', 'created_at', 'created_by',
  ],
  mentor_tasks: [
    'id', 'mentor_email', 'student_id', 'student_name', 'task_type', 'title',
    'description', 'due_date', 'completed', 'completed_at', 'created_at',
    'priority', 'source', 'assigned_by', 'updated_at', 'deleted_at', 'deleted_by',
  ],
  companies: [
    'id', 'canonical_name', 'industry', 'size_range', 'location', 'contact_name',
    'contact_email', 'hiring_status', 'notes', 'added_at', 'added_by',
    'normalized_name', 'website', 'created_at', 'updated_at', 'deleted_at', 'deleted_by',
  ],
  company_aliases: [
    'id', 'company_id', 'alias', 'normalized_alias', 'created_at', 'created_by', 'deleted_at',
  ],
  warnings: [
    'id', 'student_id', 'student_name', 'mentor_email', 'severity', 'reason',
    'evidence_notes', 'status', 'created_at', 'created_by', 'resolved_at',
    'resolved_by', 'resolution_notes', 'acknowledged_at', 'acknowledged_by',
    'updated_at', 'deleted_at', 'deleted_by',
  ],
  stage_history: [
    'id', 'student_id', 'from_stage', 'to_stage', 'transitioned_at',
    'triggered_by', 'note', 'actor_email', 'created_at',
  ],
  audit_log: [
    'id', 'actor_id', 'actor_email', 'actor_role', 'action', 'target_type',
    'target_id', 'metadata', 'ip_address', 'user_agent', 'created_at', 'metadata_json',
  ],
  analytics_events: [
    'id', 'event_type', 'actor_email', 'actor_role', 'student_id', 'student_name',
    'created_at', 'payload', 'session_id', 'request_id',
  ],
  daily_metrics: [
    'date', 'student_id', 'student_name', 'mentor_email', 'prs_total_score',
    'prs_grade', 'activity_tier', 'leaderboard_rank', 'leaderboard_score',
    'risk_probability', 'risk_band', 'tasks_completed', 'interviews_count',
    'created_at', 'batch', 'project',
  ],
  error_log: [
    'id', 'route', 'error_message', 'stack_trace', 'user_id', 'created_at',
    'severity', 'request_id', 'resolved_at',
  ],
  escalations: [
    'id', 'student_id', 'channel', 'message_id', 'raised_at', 'mentor_email',
    'acknowledged_at', 'escalated_at', 'resolved_at', 'status', 'severity',
    'description', 'created_at', 'updated_at', 'deleted_at',
  ],
  cohorts: [
    'id', 'name', 'project', 'start_date', 'end_date', 'status', 'created_at', 'updated_at', 'deleted_at',
  ],
  mentor_assignments: [
    'id', 'student_id', 'mentor_email', 'assigned_at', 'assigned_by', 'unassigned_at',
    'status', 'created_at', 'updated_at', 'deleted_at',
  ],
  sheet_indexes: [
    'id', 'sheet_name', 'index_name', 'columns', 'purpose', 'created_at',
  ],
  schema_migrations: [
    'id', 'migration_name', 'applied_at', 'status', 'details',
  ],
};

const VALIDATIONS = {
  students: {
    stage: ['learning', 'applying', 'interviewing', 'offer_pending', 'placed', 'hired'],
    risk_status: ['safe', 'at_risk'],
    risk_band: ['safe', 'watch', 'concern', 'at_risk', 'critical'],
    job_focus: ['remote', 'onsite', 'hybrid'],
    terminated: ['true', 'false'],
    hired: ['true', 'false'],
    experience: ['fresher', 'experienced'],
  },
  attendance_logs: {
    present: ['true', 'false'],
    excuse: ['exam', 'sick', 'personal', 'other'],
  },
  progress_logs: {
    log_type: ['Interview Call', 'Job Applied', 'Mock Interview', 'Job Task', 'Offer', 'Other'],
    mock_interview_type: ['technical', 'behavioral', 'system_design', 'hr', 'mock'],
  },
  users: {
    role: ['manager', 'mentor'],
    active: ['true', 'false'],
  },
  mentor_tasks: {
    task_type: ['follow_up', 'schedule_interview', 'review_progress', 'risk_check', 'update_student_data', 'other'],
    completed: ['true', 'false'],
    priority: ['low', 'medium', 'high', 'critical'],
    source: ['auto', 'manual'],
  },
  companies: {
    hiring_status: ['active', 'paused', 'closed', 'prospect'],
  },
  warnings: {
    severity: ['yellow', 'orange', 'red'],
    status: ['open', 'resolved'],
  },
  notifications: {
    read: ['true', 'false'],
    delivery_channel: ['in_app', 'email', 'webhook'],
  },
};

const INDEX_DEFINITIONS = [
  ['students', 'idx_students_mentor_stage', 'mentor_email,stage,deleted_at', 'Mentor dashboards and pipeline filters'],
  ['students', 'idx_students_batch_project', 'batch,project,deleted_at', 'Cohort and project analytics'],
  ['attendance_logs', 'idx_attendance_student_date', 'student_id,date,deleted_at', 'Attendance timeline and duplicate prevention'],
  ['progress_logs', 'idx_progress_student_logged_at', 'student_id,logged_at,deleted_at', 'Student progress timeline'],
  ['progress_logs', 'idx_progress_company_type', 'company_id,company_name,log_type', 'Company analytics and offer funnels'],
  ['users', 'idx_users_email', 'email,active,deleted_at', 'Authentication and mentor lookups'],
  ['notifications', 'idx_notifications_recipient_read', 'recipient_email,read,created_at,deleted_at', 'Notification badge and inbox queries'],
  ['risk_history', 'idx_risk_student_flagged', 'student_id,flagged_at', 'Risk chronology'],
  ['mentor_tasks', 'idx_tasks_mentor_due', 'mentor_email,completed,due_date,deleted_at', 'Task lists and reminders'],
  ['daily_metrics', 'idx_metrics_date_mentor', 'date,mentor_email,student_id', 'Leaderboards and time-series analytics'],
  ['mentor_assignments', 'idx_assignments_student_status', 'student_id,status,deleted_at', 'Current and historical mentor ownership'],
  ['audit_log', 'idx_audit_actor_created', 'actor_email,created_at', 'Compliance review'],
];

async function getMetadata() {
  const response = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  return response.data.sheets || [];
}

function getSheetId(metadata, title) {
  return metadata.find((sheet) => sheet.properties?.title === title)?.properties?.sheetId;
}

async function ensureSheet(title, headers) {
  let metadata = await getMetadata();
  let sheetId = getSheetId(metadata, title);
  if (sheetId === undefined) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
    metadata = await getMetadata();
    sheetId = getSheetId(metadata, title);
    console.log(`  + created sheet ${title}`);
  }

  const existingRows = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${title}!1:1`,
  });
  const existingHeaders = existingRows.data.values?.[0] || [];
  const existingSet = new Set(existingHeaders.map((header) => String(header).trim()).filter(Boolean));
  const missingHeaders = headers.filter((header) => !existingSet.has(header));
  const nextHeaders = existingHeaders.length === 0 ? headers : [...existingHeaders, ...missingHeaders];

  if (existingHeaders.length === 0 || missingHeaders.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${title}!A1:1`,
      valueInputOption: 'RAW',
      requestBody: { values: [nextHeaders] },
    });
    console.log(`  ~ ${title}: ${missingHeaders.length ? `added ${missingHeaders.join(', ')}` : 'initialized headers'}`);
  } else {
    console.log(`  = ${title}: headers already current`);
  }

  return { sheetId, headers: nextHeaders };
}

async function applySheetPresentation(sheetId, headers, title) {
  const requests = [
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
        cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.93, green: 0.95, blue: 0.99 } } },
        fields: 'userEnteredFormat(textFormat,backgroundColor)',
      },
    },
  ];

  if (VALIDATIONS[title]) {
    for (const [columnName, allowedValues] of Object.entries(VALIDATIONS[title])) {
      const colIndex = headers.indexOf(columnName);
      if (colIndex === -1) continue;
      requests.push({
        setDataValidation: {
          range: { sheetId, startRowIndex: 1, startColumnIndex: colIndex, endColumnIndex: colIndex + 1 },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: allowedValues.map((value) => ({ userEnteredValue: value })),
            },
            strict: false,
            showCustomUi: true,
          },
        },
      });
    }
  }

  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests } });
}

async function getRows(title) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: title });
  return response.data.values || [];
}

async function appendRows(title, rows) {
  if (rows.length === 0) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: title,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
}

function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function backfillCohorts() {
  const studentRows = (await getRows('students')).slice(1);
  const cohortRows = await getRows('cohorts');
  const existing = new Set(cohortRows.slice(1).map((row) => `${row[1] || ''}::${row[2] || ''}`));
  const additions = [];
  const now = new Date().toISOString();

  for (const row of studentRows) {
    const batch = row[2] || '';
    const project = row[3] || '';
    if (!batch) continue;
    const key = `${batch}::${project}`;
    if (existing.has(key)) continue;
    existing.add(key);
    additions.push([randomUUID(), batch, project, '', '', 'active', now, now, '']);
  }

  await appendRows('cohorts', additions);
  if (additions.length) console.log(`  + cohorts: backfilled ${additions.length} row(s)`);
}

async function backfillMentorAssignments() {
  const studentRows = (await getRows('students')).slice(1);
  const assignmentRows = await getRows('mentor_assignments');
  const existing = new Set(assignmentRows.slice(1).map((row) => `${row[1] || ''}::${row[2] || ''}::${row[6] || ''}`));
  const additions = [];
  const now = new Date().toISOString();

  for (const row of studentRows) {
    const studentId = row[0] || '';
    const mentorEmail = row[4] || '';
    if (!studentId || !mentorEmail) continue;
    const key = `${studentId}::${mentorEmail}::active`;
    if (existing.has(key)) continue;
    existing.add(key);
    additions.push([randomUUID(), studentId, mentorEmail, row[14] || now, 'migration', '', 'active', now, now, '']);
  }

  await appendRows('mentor_assignments', additions);
  if (additions.length) console.log(`  + mentor_assignments: backfilled ${additions.length} row(s)`);
}

async function backfillCompanyAliases() {
  const companyRows = (await getRows('companies')).slice(1);
  const aliasRows = await getRows('company_aliases');
  const existing = new Set(aliasRows.slice(1).map((row) => `${row[1] || ''}::${row[3] || ''}`));
  const additions = [];
  const now = new Date().toISOString();

  for (const row of companyRows) {
    const companyId = row[0] || '';
    const canonicalName = row[1] || '';
    if (!companyId || !canonicalName) continue;
    const normalized = normalizeName(canonicalName);
    const key = `${companyId}::${normalized}`;
    if (existing.has(key)) continue;
    existing.add(key);
    additions.push([randomUUID(), companyId, canonicalName, normalized, now, 'migration', '']);
  }

  await appendRows('company_aliases', additions);
  if (additions.length) console.log(`  + company_aliases: backfilled ${additions.length} row(s)`);
}

async function upsertIndexDefinitions() {
  const rows = await getRows('sheet_indexes');
  const existing = new Set(rows.slice(1).map((row) => row[2]));
  const now = new Date().toISOString();
  const additions = INDEX_DEFINITIONS
    .filter(([, indexName]) => !existing.has(indexName))
    .map(([sheetName, indexName, columns, purpose]) => [randomUUID(), sheetName, indexName, columns, purpose, now]);
  await appendRows('sheet_indexes', additions);
  if (additions.length) console.log(`  + sheet_indexes: documented ${additions.length} index definition(s)`);
}

async function recordMigration(status, details) {
  const rows = await getRows('schema_migrations');
  const alreadyApplied = rows.slice(1).some((row) => row[1] === '002_production_schema_alignment' && row[3] === 'success');
  if (alreadyApplied && status === 'success') return;
  await appendRows('schema_migrations', [[randomUUID(), '002_production_schema_alignment', new Date().toISOString(), status, details]]);
}

async function migrate() {
  console.log('\n=== MIGRATION 002: Production Schema Alignment ===\n');
  const applied = [];

  for (const [title, headers] of Object.entries(SCHEMAS)) {
    const result = await ensureSheet(title, headers);
    await applySheetPresentation(result.sheetId, result.headers, title);
    applied.push(title);
  }

  await backfillCohorts();
  await backfillMentorAssignments();
  await backfillCompanyAliases();
  await upsertIndexDefinitions();
  await recordMigration('success', `Aligned ${applied.length} sheets; additive headers, validations, and relationship support applied.`);

  console.log('\n=== Migration Complete ===');
  console.log(`Aligned sheets: ${applied.join(', ')}`);
  console.log('Safety: no sheets, columns, or rows were deleted. Existing columns were not reordered.\n');
}

migrate().catch(async (error) => {
  console.error('\n!!! Migration failed !!!');
  console.error(error.message || error);
  try {
    await recordMigration('failed', error.message || String(error));
  } catch (_) {
    // If schema_migrations could not be reached, preserve the original failure.
  }
  process.exit(1);
});
