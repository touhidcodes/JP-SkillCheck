/**
 * MIGRATION: 004_project_overview_schema_hardening
 *
 * Quota optimisations vs original:
 *  - spreadsheets.get (metadata) is called ONCE and cached for the whole run.
 *  - Every sheet's row-1 read is batched into a single batchGet call so the
 *    entire ensureSheet loop costs 1 read instead of 30.
 *  - runDataQualityChecks and repairStudentsHeaderIfSafe reuse the in-memory
 *    cache populated during ensureSheet — zero extra reads for those sheets.
 *  - A small sleep(ms) helper throttles batchUpdate calls to stay well under
 *    the 60 write-requests-per-minute-per-user limit.
 *  - recordMigration reuses the cached schema_migrations rows.
 *
 * Safety model (unchanged):
 *  - Idempotent and additive. Never deletes sheets, rows, or columns.
 *  - The only non-additive operation is the guarded students header repair.
 */

const path = require('path');
const fs   = require('fs');
const { google }     = require('googleapis');
const { randomUUID } = require('crypto');

// ── env ──────────────────────────────────────────────────────────────────────
const envPath = path.resolve(__dirname, '../../.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) return;
    const key = match[1].trim();
    const val = match[2].trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
    if (!process.env[key]) process.env[key] = val;
  });
}

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
if (!SPREADSHEET_ID) { console.error('GOOGLE_SPREADSHEET_ID is required'); process.exit(1); }

const sheets = google.sheets({
  version: 'v4',
  auth: new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  }),
});

// ── throttle helpers ─────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Sheets API limits: 60 read req/min/user, 60 write req/min/user.
// We stay safe by waiting 1 s between every batchUpdate (write) call.
const WRITE_DELAY_MS = 1100;

// ── in-memory caches ─────────────────────────────────────────────────────────
let metadataCache = null;          // result of spreadsheets.get — fetched once
const rowCache    = new Map();     // title → string[][] — populated by batchGet

async function getMetadata(force = false) {
  if (!metadataCache || force) {
    const res = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    metadataCache = res.data.sheets || [];
  }
  return metadataCache;
}

function getSheetId(metadata, title) {
  return metadata.find((s) => s.properties?.title === title)?.properties?.sheetId;
}

/**
 * Fetch row-1 for every known sheet in ONE batchGet call, then cache the
 * results.  Any title not yet in the spreadsheet is silently skipped.
 */
async function primeRowCache(titles) {
  const metadata = await getMetadata();
  const existing = titles.filter((t) => getSheetId(metadata, t) !== undefined);
  if (!existing.length) return;

  const ranges = existing.map((t) => `${t}!1:1`);
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges,
  });

  (res.data.valueRanges || []).forEach((vr, i) => {
    rowCache.set(existing[i], vr.values || []);
  });
}

/**
 * Read ALL rows for a sheet.  Uses cache when available; falls back to a live
 * read (and caches the result) otherwise.
 */
async function readRows(title) {
  if (rowCache.has(title) && rowCache.get(title).length > 1) return rowCache.get(title);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: title,
  });
  const rows = res.data.values || [];
  rowCache.set(title, rows);
  return rows;
}

async function appendRows(title, rows) {
  if (!rows.length) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: title,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
  // Invalidate cache so subsequent reads see the new rows.
  rowCache.delete(title);
}

// ── canonical schemas ────────────────────────────────────────────────────────
const CANONICAL_SCHEMAS = {
  students: [
    'id','name','batch','project','mentor_email','student_email',
    'stage','risk_status','risk_reasons','last_activity_date',
    'job_focus','terminated','hired','experience','created_at','updated_at',
    'risk_probability','risk_band','deleted_at','deleted_by','created_by',
  ],
  attendance_logs: [
    'id','student_id','date','present','logged_by','session_label',
    'excuse','excuse_note','created_at','updated_at','deleted_at','deleted_by',
    'session_id','mode','period','duration_minutes','topic_tags','source',
    'attendance_note','status_label','status_color','status_emoji','notified_at',
  ],
  progress_logs: [
    'id','student_id','student_name','student_email','log_type',
    'company_name','scheduled_date','scheduled_time','note','logged_at',
    'logged_by','job_url','mock_feedback','mock_score','mock_strengths',
    'mock_improvements','mock_interview_type','mock_interviewer',
    'company_id','created_at','updated_at','deleted_at','deleted_by',
  ],
  users: [
    'id','name','email','role','active','password_hash',
    'last_login_at','created_at','updated_at','deleted_at','deleted_by',
  ],
  notifications: [
    'id','recipient_email','type','student_id','student_name','message',
    'read','created_at','payload','read_at','delivery_channel','deleted_at',
    'updated_at','deleted_by',
  ],
  risk_history: [
    'id','student_id','student_name','mentor_email','reasons','flagged_at',
    'resolved_at','risk_probability','risk_band','created_at','created_by',
  ],
  mentor_tasks: [
    'id','mentor_email','student_id','student_name','task_type','title',
    'description','due_date','completed','completed_at','created_at',
    'priority','source','assigned_by','updated_at','deleted_at','deleted_by',
  ],
  companies: [
    'id','canonical_name','industry','size_range','location','contact_name',
    'contact_email','hiring_status','notes','added_at','added_by',
    'normalized_name','website','created_at','updated_at','deleted_at','deleted_by',
  ],
  company_aliases: [
    'id','company_id','alias','normalized_alias','created_at','created_by',
    'updated_at','deleted_at','deleted_by',
  ],
  warnings: [
    'id','student_id','student_name','mentor_email','severity','reason',
    'evidence_notes','status','created_at','created_by','resolved_at',
    'resolved_by','resolution_notes','acknowledged_at','acknowledged_by',
    'updated_at','deleted_at','deleted_by',
  ],
  stage_history: [
    'id','student_id','from_stage','to_stage','transitioned_at',
    'triggered_by','note','actor_email','created_at',
  ],
  audit_log: [
    'id','actor_id','actor_email','actor_role','action','target_type',
    'target_id','metadata','ip_address','user_agent','created_at','metadata_json',
  ],
  analytics_events: [
    'id','event_type','actor_email','actor_role','student_id','student_name',
    'created_at','payload','session_id','request_id',
  ],
  daily_metrics: [
    'date','student_id','student_name','mentor_email','prs_total_score',
    'prs_grade','activity_tier','leaderboard_rank','leaderboard_score',
    'risk_probability','risk_band','tasks_completed','interviews_count',
    'created_at','batch','project',
  ],
  error_log: [
    'id','route','error_message','stack_trace','user_id','created_at',
    'severity','request_id','resolved_at',
  ],
  escalations: [
    'id','student_id','channel','message_id','raised_at','mentor_email',
    'acknowledged_at','escalated_at','resolved_at','status','severity',
    'description','created_at','updated_at','deleted_at','deleted_by',
  ],
  cohorts: [
    'id','name','project','start_date','end_date','status','created_at',
    'updated_at','deleted_at','deleted_by',
  ],
  mentor_assignments: [
    'id','student_id','mentor_email','assigned_at','assigned_by','unassigned_at',
    'status','created_at','updated_at','deleted_at','deleted_by',
  ],
  attendance_sessions: [
    'id','mentor_email','date','mode','session_name','period','duration_minutes',
    'topic_tags','batch_filter','default_status','visible_statuses','auto_close_minutes',
    'check_in_url','notify_students','is_open','created_at','updated_at','closed_at',
    'deleted_at','deleted_by',
  ],
  attendance_statuses: [
    'id','mentor_email','label','kind','color','emoji','visible_for_modes',
    'is_default','sort_order','created_at','updated_at','deleted_at','deleted_by',
  ],
  attendance_filter_presets: [
    'id','mentor_email','name','search','batch','status','sort_order',
    'created_at','updated_at','deleted_at','deleted_by',
  ],
  student_upload_batches: [
    'id','uploaded_by','file_name','file_type','total_rows','accepted_rows',
    'rejected_rows','status','validation_errors','created_at','completed_at',
    'deleted_at','deleted_by',
  ],
  report_deliveries: [
    'id','report_type','recipient_email','period_start','period_end',
    'status','delivery_channel','provider_message_id','error_message',
    'created_at','delivered_at',
  ],
  schema_constraints: [
    'id','constraint_name','constraint_type','sheet_name','columns',
    'referenced_sheet','referenced_columns','allowed_values','rule',
    'on_delete','severity','active','created_at',
  ],
  data_quality_checks: [
    'id','check_name','sheet_name','scope','status','checked_at',
    'records_checked','issues_found','details',
  ],
  sheet_indexes: [
    'id','sheet_name','index_name','columns','purpose','created_at',
  ],
  schema_migrations: [
    'id','migration_name','applied_at','status','details',
  ],
};

// ── validations & index/constraint definitions ───────────────────────────────
const VALIDATIONS = {
  students: {
    stage: ['learning','applying','interviewing','offer_pending','placed','hired'],
    risk_status: ['safe','at_risk'],
    risk_band: ['safe','watch','concern','at_risk','critical'],
    job_focus: ['remote','onsite','hybrid'],
    terminated: ['true','false'],
    hired: ['true','false'],
    experience: ['fresher','experienced'],
  },
  attendance_logs: {
    present: ['true','false'],
    excuse: ['exam','sick','personal','other'],
    mode: ['daily','session','check_in'],
    source: ['manual','bulk','auto_check_in','offline_sync','keyboard','voice'],
  },
  attendance_sessions: {
    mode: ['daily','session','check_in'],
    notify_students: ['true','false'],
    is_open: ['true','false'],
  },
  attendance_statuses: {
    kind: ['present','absent','excused','late','custom'],
    is_default: ['true','false'],
  },
  progress_logs: {
    log_type: ['Interview Call','Job Applied','Mock Interview','Job Task','Offer','Other'],
    mock_interview_type: ['technical','behavioral','system_design','hr','mock'],
  },
  users: { role: ['manager','mentor'], active: ['true','false'] },
  notifications: {
    type: ['risk_alert','risk_resolved','task_due','stage_changed','mentor_update_reminder','attendance_alert','action_required','system_message'],
    read: ['true','false'],
    delivery_channel: ['in_app','email','webhook'],
  },
  mentor_tasks: {
    task_type: ['follow_up','schedule_interview','review_progress','risk_check','update_student_data','other'],
    completed: ['true','false'],
    priority: ['low','medium','high','critical'],
    source: ['auto','manual'],
  },
  companies: { hiring_status: ['active','paused','closed','prospect'] },
  warnings: { severity: ['yellow','orange','red'], status: ['open','resolved'] },
  escalations: {
    status: ['open','acknowledged','escalated','resolved'],
    severity: ['low','medium','high','critical'],
  },
  student_upload_batches: {
    file_type: ['xlsx','xls','csv'],
    status: ['processing','completed','failed','partial'],
  },
  report_deliveries: {
    report_type: ['weekly_program','mentor_performance','student_detail','cohort_completion','company_hiring'],
    status: ['queued','sent','failed','skipped'],
    delivery_channel: ['email','download','webhook'],
  },
  schema_constraints: {
    constraint_type: ['primary_key','foreign_key','unique','enum','check','soft_delete','audit','cascade_rule'],
    severity: ['info','warning','error'],
    active: ['true','false'],
  },
  data_quality_checks: { status: ['passed','warning','failed'] },
};

const INDEX_DEFINITIONS = [
  ['students','idx_students_mentor_stage','mentor_email,stage,deleted_at','Mentor dashboards and pipeline filters'],
  ['students','idx_students_batch_project','batch,project,deleted_at','Cohort and project analytics'],
  ['students','idx_students_risk_activity','risk_status,risk_band,last_activity_date,deleted_at','Daily risk scan and at-risk table'],
  ['attendance_logs','idx_attendance_student_date','student_id,date,deleted_at','Attendance timeline and duplicate prevention'],
  ['attendance_logs','idx_attendance_session','session_id,status_label,date,deleted_at','Session attendance views'],
  ['progress_logs','idx_progress_student_logged_at','student_id,logged_at,deleted_at','Student progress timeline'],
  ['progress_logs','idx_progress_company_type','company_id,company_name,log_type','Company analytics and offer funnels'],
  ['users','idx_users_email','email,active,deleted_at','Authentication and mentor lookups'],
  ['notifications','idx_notifications_recipient_read','recipient_email,read,created_at,deleted_at','Notification badge and inbox queries'],
  ['risk_history','idx_risk_student_flagged','student_id,flagged_at','Risk chronology'],
  ['mentor_tasks','idx_tasks_mentor_due','mentor_email,completed,due_date,deleted_at','Task lists and reminders'],
  ['daily_metrics','idx_metrics_date_mentor','date,mentor_email,student_id','Leaderboards and time-series analytics'],
  ['mentor_assignments','idx_assignments_student_status','student_id,status,deleted_at','Current and historical mentor ownership'],
  ['audit_log','idx_audit_actor_created','actor_email,created_at','Compliance review'],
  ['student_upload_batches','idx_uploads_actor_created','uploaded_by,created_at,status','Bulk upload audit review'],
  ['report_deliveries','idx_reports_recipient_period','recipient_email,period_start,period_end,status','Weekly report delivery audit'],
];

const CONSTRAINT_DEFINITIONS = [
  ['pk_students','primary_key','students','id','','','','id must be non-empty and unique','restrict','error'],
  ['fk_students_mentor_email_users','foreign_key','students','mentor_email','users','email','','mentor_email should reference an active mentor user','restrict','error'],
  ['enum_students_stage','enum','students','stage','','',VALIDATIONS.students.stage.join(','),'stage must be a supported placement pipeline stage','','error'],
  ['enum_students_risk_status','enum','students','risk_status','','',VALIDATIONS.students.risk_status.join(','),'risk_status must be safe or at_risk','','error'],
  ['soft_delete_students','soft_delete','students','deleted_at,deleted_by','','','','soft-deleted students remain as source history','cascade_soft_delete','warning'],
  ['fk_attendance_student','foreign_key','attendance_logs','student_id','students','id','','attendance records require a valid student','cascade_soft_delete','error'],
  ['fk_attendance_session','foreign_key','attendance_logs','session_id','attendance_sessions','id','','session_id references attendance_sessions when present','set_null','warning'],
  ['fk_progress_student','foreign_key','progress_logs','student_id','students','id','','progress records require a valid student','cascade_soft_delete','error'],
  ['fk_progress_company','foreign_key','progress_logs','company_id','companies','id','','company_id references canonical companies when present','set_null','warning'],
  ['fk_notification_recipient','foreign_key','notifications','recipient_email','users','email','','notifications should target a known active user','restrict','warning'],
  ['fk_tasks_mentor','foreign_key','mentor_tasks','mentor_email','users','email','','task mentor should reference a known mentor user','restrict','error'],
  ['fk_tasks_student','foreign_key','mentor_tasks','student_id','students','id','','student task references a student when present','cascade_soft_delete','warning'],
  ['fk_company_alias_company','foreign_key','company_aliases','company_id','companies','id','','company aliases require a canonical company','cascade_soft_delete','error'],
  ['unique_users_email','unique','users','email','','','','user email must be unique for authentication','restrict','error'],
  ['unique_companies_normalized_name','unique','companies','normalized_name','','','','normalized company names should be unique','restrict','warning'],
  ['audit_users_password_hash','check','users','password_hash','','','','password_hash must contain only bcrypt hashes; never store plaintext passwords','','error'],
  ['append_only_audit_log','audit','audit_log','id,created_at','','','','audit_log is append-only and should not be hard-deleted','restrict','error'],
  ['append_only_stage_history','audit','stage_history','id,created_at','','','','stage_history is append-only; corrections require compensating rows','restrict','error'],
  ['append_only_risk_history','audit','risk_history','id,created_at','','','','risk_history is append-only; resolved_at closes risk events','restrict','error'],
];

// ── ensureSheet ───────────────────────────────────────────────────────────────
/**
 * Ensure a sheet exists and has all required headers.
 * Uses the pre-populated rowCache for the header read — no extra API call.
 * Creates the sheet via batchUpdate if missing (1 write), then updates headers
 * if any are absent (1 write).  Returns { sheetId, headers }.
 */
async function ensureSheet(title, headers) {
  let metadata = await getMetadata();
  let sheetId  = getSheetId(metadata, title);

  if (sheetId === undefined) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
    await sleep(WRITE_DELAY_MS);
    // Refresh metadata cache after creating the sheet.
    metadataCache = null;
    metadata = await getMetadata();
    sheetId  = getSheetId(metadata, title);
    console.log(`  + created ${title}`);
    // New sheet has no rows yet — seed the cache entry.
    rowCache.set(title, []);
  }

  // Use cached header row (populated by primeRowCache or a previous readRows).
  const cached        = rowCache.get(title) || [];
  const existingHeaders = cached[0] || [];
  const existingSet   = new Set(existingHeaders.map((h) => String(h).trim()).filter(Boolean));
  const missing       = headers.filter((h) => !existingSet.has(h));
  const nextHeaders   = existingHeaders.length ? [...existingHeaders, ...missing] : headers;

  if (!existingHeaders.length || missing.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${title}!A1:1`,
      valueInputOption: 'RAW',
      requestBody: { values: [nextHeaders] },
    });
    // Update cache to reflect new header row.
    rowCache.set(title, [nextHeaders, ...(cached.slice(1))]);
    console.log(`  ~ ${title}: ${missing.length ? `added ${missing.join(', ')}` : 'initialized headers'}`);
  } else {
    console.log(`  = ${title}: headers present`);
  }

  return { sheetId, headers: nextHeaders };
}

// ── applyPresentation ─────────────────────────────────────────────────────────
/**
 * Freeze header row, bold + tint it, and add dropdown validation for enum
 * columns.  All requests are batched into a single batchUpdate call per sheet.
 */
async function applyPresentation(sheetId, headers, title) {
  if (sheetId === undefined) return;

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
        cell: {
          userEnteredFormat: {
            textFormat: { bold: true },
            backgroundColor: { red: 0.93, green: 0.95, blue: 0.99 },
          },
        },
        fields: 'userEnteredFormat(textFormat,backgroundColor)',
      },
    },
  ];

  if (VALIDATIONS[title]) {
    for (const [col, allowed] of Object.entries(VALIDATIONS[title])) {
      const colIndex = headers.indexOf(col);
      if (colIndex === -1) continue;
      requests.push({
        setDataValidation: {
          range: { sheetId, startRowIndex: 1, startColumnIndex: colIndex, endColumnIndex: colIndex + 1 },
          rule: {
            condition: { type: 'ONE_OF_LIST', values: allowed.map((v) => ({ userEnteredValue: v })) },
            strict: false,
            showCustomUi: true,
          },
        },
      });
    }
  }

  await sheets.spreadsheets.batchUpdate({ spreadsheetId: SPREADSHEET_ID, requestBody: { requests } });
  await sleep(WRITE_DELAY_MS);
}

// ── students header repair ────────────────────────────────────────────────────
function isKnownStudentsHeaderDrift(headers) {
  const drifted = [
    'id','name','batch','project','mentor_email','student_email',
    'stage','risk_status','risk_reasons','risk_probability','risk_band',
    'last_activity_date','job_focus','terminated','hired','experience',
    'created_at','updated_at','deleted_at','deleted_by',
  ];
  return drifted.every((h, i) => headers[i] === h);
}

function isIsoDateLike(v) { return /^\d{4}-\d{2}-\d{2}/.test(String(v || '')); }

/**
 * Reuses the full students rows already in rowCache — no extra API call.
 */
async function repairStudentsHeaderIfSafe() {
  // readRows will return the cached value populated during ensureSheet.
  const rows     = await readRows('students');
  const headers  = rows[0] || [];
  const canonical = CANONICAL_SCHEMAS.students.slice(0, 20);

  if (canonical.every((h, i) => headers[i] === h)) {
    console.log('  = students: canonical header order already correct');
    return { repaired: false, issue: null };
  }

  const dataRows         = rows.slice(1);
  const hasKnownDrift    = isKnownStudentsHeaderDrift(headers);
  const rowsLookCanonical = dataRows.every((row) => {
    if (!row[0]) return true;
    return (
      row.length <= 20 &&
      isIsoDateLike(row[9]) &&
      ['true','false',''].includes(String(row[11] || '')) &&
      ['true','false',''].includes(String(row[12] || ''))
    );
  });

  if (!hasKnownDrift || !rowsLookCanonical) {
    const issue = 'students header order differs from canonical, but the data shape is not the known safe repair pattern';
    console.log(`  ! students: ${issue}`);
    return { repaired: false, issue };
  }

  const nextHeaders = [...canonical, ...headers.slice(20).filter((h) => !canonical.includes(h))];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'students!A1:1',
    valueInputOption: 'RAW',
    requestBody: { values: [nextHeaders] },
  });
  rowCache.set('students', [nextHeaders, ...rows.slice(1)]);
  console.log('  ~ students: repaired header drift; data rows were not moved');
  return { repaired: true, issue: null };
}

// ── index & constraint upserts ────────────────────────────────────────────────
async function upsertIndexDefinitions() {
  const rows     = await readRows('sheet_indexes');
  const existing = new Set(rows.slice(1).map((r) => r[2]));
  const now      = new Date().toISOString();
  const additions = INDEX_DEFINITIONS
    .filter(([, name]) => !existing.has(name))
    .map(([sheet, name, cols, purpose]) => [randomUUID(), sheet, name, cols, purpose, now]);
  await appendRows('sheet_indexes', additions);
  if (additions.length) console.log(`  + sheet_indexes: added ${additions.length} definition(s)`);
}

async function upsertConstraintDefinitions() {
  const rows     = await readRows('schema_constraints');
  const existing = new Set(rows.slice(1).map((r) => r[1]));
  const now      = new Date().toISOString();
  const additions = CONSTRAINT_DEFINITIONS
    .filter(([name]) => !existing.has(name))
    .map(([name, type, sheet, cols, refSheet, refCols, allowed, rule, onDel, sev]) => [
      randomUUID(), name, type, sheet, cols, refSheet, refCols, allowed, rule, onDel, sev, 'true', now,
    ]);
  await appendRows('schema_constraints', additions);
  if (additions.length) console.log(`  + schema_constraints: documented ${additions.length} constraint(s)`);
}

// ── data quality checks ───────────────────────────────────────────────────────
async function recordQualityCheck(checkName, sheetName, scope, status, recordsChecked, issuesFound, details) {
  await appendRows('data_quality_checks', [[
    randomUUID(), checkName, sheetName, scope, status,
    new Date().toISOString(), String(recordsChecked), String(issuesFound), details,
  ]]);
}

/**
 * All four sheets are already in rowCache from ensureSheet — zero extra reads.
 */
async function runDataQualityChecks(headerRepair) {
  const [students, users, progress, attendance] = await Promise.all([
    readRows('students'),
    readRows('users'),
    readRows('progress_logs'),
    readRows('attendance_logs'),
  ]);

  const studentRows  = students.slice(1);
  const userRows     = users.slice(1);
  const studentIds   = new Set(studentRows.map((r) => r[0]).filter(Boolean));
  const mentorEmails = new Set(
    userRows.filter((r) => r[3] === 'mentor' && r[4] === 'true').map((r) => r[2]).filter(Boolean)
  );

  const duplicateStudentIds = studentRows.length - studentIds.size;
  const missingMentors      = studentRows.filter((r) => r[4] && !mentorEmails.has(r[4])).length;
  const orphanProgress      = progress.slice(1).filter((r) => r[1] && !studentIds.has(r[1])).length;
  const orphanAttendance    = attendance.slice(1).filter((r) => r[1] && !studentIds.has(r[1])).length;

  const studentIssues = duplicateStudentIds + missingMentors + (headerRepair.issue ? 1 : 0);
  await recordQualityCheck(
    'students_integrity', 'students', 'ids,mentor_email,header_order',
    studentIssues ? 'warning' : 'passed', studentRows.length, studentIssues,
    JSON.stringify({
      duplicate_student_ids: duplicateStudentIds,
      students_with_unknown_active_mentor: missingMentors,
      header_repaired: headerRepair.repaired,
      header_issue: headerRepair.issue,
    })
  );

  await recordQualityCheck(
    'child_reference_integrity', 'progress_logs,attendance_logs', 'student_id',
    orphanProgress + orphanAttendance ? 'warning' : 'passed',
    Math.max(0, progress.length - 1) + Math.max(0, attendance.length - 1),
    orphanProgress + orphanAttendance,
    JSON.stringify({ orphan_progress_logs: orphanProgress, orphan_attendance_logs: orphanAttendance })
  );
}

// ── migration record ──────────────────────────────────────────────────────────
async function recordMigration(status, details) {
  // Reuse cached rows — no extra read.
  const rows = await readRows('schema_migrations');
  const alreadyApplied = rows.slice(1).some(
    (r) => r[1] === '004_project_overview_schema_hardening' && r[3] === 'success'
  );
  if (alreadyApplied && status === 'success') return;
  await appendRows('schema_migrations', [[
    randomUUID(), '004_project_overview_schema_hardening', new Date().toISOString(), status, details,
  ]]);
}

// ── main ──────────────────────────────────────────────────────────────────────
async function migrate() {
  console.log('\n=== MIGRATION 004: Project Overview Schema Hardening ===\n');

  const allTitles = Object.keys(CANONICAL_SCHEMAS);

  // ── STEP 1: single metadata fetch + single batchGet for all header rows ──
  console.log('Fetching spreadsheet metadata and all header rows (2 API calls)…');
  await getMetadata();
  await primeRowCache(allTitles);

  // ── STEP 2: ensure every sheet exists and has the right headers ──
  // New sheets need a batchUpdate (create) + a values.update (headers).
  // Existing sheets with all headers present need 0 writes.
  // We also need the full rows for students/users/progress/attendance for the
  // quality checks — fetch those now while we still have quota headroom.
  console.log('Loading full rows for quality-check sheets…');
  await Promise.all([
    readRows('students'),
    readRows('users'),
    readRows('progress_logs'),
    readRows('attendance_logs'),
    readRows('sheet_indexes'),
    readRows('schema_constraints'),
    readRows('schema_migrations'),
  ]);

  const alignedSheets = [];
  for (const [title, headers] of Object.entries(CANONICAL_SCHEMAS)) {
    const result = await ensureSheet(title, headers);
    await applyPresentation(result.sheetId, result.headers, title);
    alignedSheets.push(title);
  }

  // ── STEP 3: students header repair (uses cache — 0 reads) ──
  const headerRepair = await repairStudentsHeaderIfSafe();

  // ── STEP 4: upsert index & constraint definitions (uses cache — 0 reads) ──
  await upsertIndexDefinitions();
  await upsertConstraintDefinitions();

  // ── STEP 5: data quality checks (uses cache — 0 reads) ──
  await runDataQualityChecks(headerRepair);

  // ── STEP 6: record migration (uses cache — 0 reads) ──
  await recordMigration(
    'success',
    `Aligned ${alignedSheets.length} sheets; students header repaired=${headerRepair.repaired}; no data rows deleted or moved.`
  );

  console.log('\n=== Migration Complete ===');
  console.log(`Aligned sheets : ${alignedSheets.join(', ')}`);
  console.log(`Header repaired: ${headerRepair.repaired ? 'yes' : 'no'}`);
  console.log('Safety         : no sheets, columns, or rows were deleted; data rows were not reordered.\n');
}

migrate().catch(async (error) => {
  console.error('\n!!! Migration failed !!!');
  console.error(error.message || error);
  try {
    await recordMigration('failed', error.message || String(error));
  } catch (_err) {
    // Preserve the original failure — don't mask it.
  }
  process.exit(1);
});
