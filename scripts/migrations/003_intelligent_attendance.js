/**
 * MIGRATION: 003_intelligent_attendance
 *
 * Additive schema support for the intelligent attendance workflow. Existing
 * attendance rows keep their current column order; new fields are appended.
 */

const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');

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
if (!SPREADSHEET_ID) {
  console.error('GOOGLE_SPREADSHEET_ID is required');
  process.exit(1);
}

const sheets = google.sheets({
  version: 'v4',
  auth: new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  }),
});

const SHEET_SCHEMAS = {
  attendance_logs: [
    'id', 'student_id', 'date', 'present', 'logged_by', 'session_label',
    'excuse', 'excuse_note', 'created_at', 'updated_at', 'deleted_at', 'deleted_by',
    'session_id', 'mode', 'period', 'duration_minutes', 'topic_tags', 'source',
    'attendance_note', 'status_label', 'status_color', 'status_emoji', 'notified_at',
  ],
  attendance_sessions: [
    'id', 'mentor_email', 'date', 'mode', 'session_name', 'period', 'duration_minutes',
    'topic_tags', 'batch_filter', 'default_status', 'visible_statuses', 'auto_close_minutes',
    'check_in_url', 'notify_students', 'is_open', 'created_at', 'updated_at', 'closed_at', 'deleted_at',
  ],
  attendance_statuses: [
    'id', 'mentor_email', 'label', 'kind', 'color', 'emoji', 'visible_for_modes',
    'is_default', 'sort_order', 'created_at', 'updated_at', 'deleted_at',
  ],
  attendance_filter_presets: [
    'id', 'mentor_email', 'name', 'search', 'batch', 'status', 'sort_order', 'created_at', 'updated_at', 'deleted_at',
  ],
};

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
    console.log(`  + created ${title}`);
  }

  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `${title}!1:1` });
  const existingHeaders = response.data.values?.[0] || [];
  const existingSet = new Set(existingHeaders.map((header) => String(header).trim()).filter(Boolean));
  const missing = headers.filter((header) => !existingSet.has(header));
  const nextHeaders = existingHeaders.length === 0 ? headers : [...existingHeaders, ...missing];

  if (existingHeaders.length === 0 || missing.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${title}!A1:1`,
      valueInputOption: 'RAW',
      requestBody: { values: [nextHeaders] },
    });
    console.log(`  ~ ${title}: ${missing.length ? `added ${missing.join(', ')}` : 'initialized headers'}`);
  } else {
    console.log(`  = ${title}: already current`);
  }

  if (sheetId !== undefined) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        }],
      },
    });
  }
}

async function migrate() {
  console.log('\n=== MIGRATION 003: Intelligent Attendance ===\n');
  for (const [title, headers] of Object.entries(SHEET_SCHEMAS)) {
    await ensureSheet(title, headers);
  }
  console.log('\n=== Migration Complete ===\n');
}

migrate().catch((error) => {
  console.error('Migration failed:', error.message || error);
  process.exit(1);
});
