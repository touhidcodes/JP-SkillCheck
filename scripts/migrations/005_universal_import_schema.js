/**
 * MIGRATION: 005_universal_import_schema
 *
 * Adds student profile fields needed by the universal Excel import flow.
 * This migration is additive and idempotent. It never deletes or reorders
 * existing data.
 */

const path = require('path');
const fs = require('fs');
const { google } = require('googleapis');
const { randomUUID } = require('crypto');

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

const STUDENT_COLUMNS = [
  'phone',
  'photo_url',
  'join_date',
  'hired_company_name',
  'hired_date',
  'terminated_reason',
  'terminated_date',
  'assignment_completion_pct',
  'follow_up_date',
  'interview_count',
  'notes',
  'risk_override_level',
  'risk_override_note',
  'risk_override_expires_at',
];

async function readRows(title) {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: title });
  return response.data.values || [];
}

async function appendRows(title, rows) {
  if (!rows.length) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: title,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
}

async function recordMigration(status, details) {
  const rows = await readRows('schema_migrations');
  const alreadyApplied = rows.slice(1).some((row) => row[1] === '005_universal_import_schema' && row[3] === 'success');
  if (alreadyApplied && status === 'success') return;
  await appendRows('schema_migrations', [[randomUUID(), '005_universal_import_schema', new Date().toISOString(), status, details]]);
}

async function migrate() {
  console.log('\n=== MIGRATION 005: Universal Import Schema ===\n');
  const rows = await readRows('students!1:1');
  const headers = rows[0] || [];
  const existing = new Set(headers);
  const missing = STUDENT_COLUMNS.filter((column) => !existing.has(column));

  if (missing.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'students!A1:1',
      valueInputOption: 'RAW',
      requestBody: { values: [[...headers, ...missing]] },
    });
    console.log(`  + students: added ${missing.join(', ')}`);
  } else {
    console.log('  = students: import columns already present');
  }

  await recordMigration('success', `Added ${missing.length} universal import student columns.`);
  console.log('\n=== Migration Complete ===\n');
}

migrate().catch(async (error) => {
  console.error('\n!!! Migration failed !!!');
  console.error(error.message || error);
  try {
    await recordMigration('failed', error.message || String(error));
  } catch (_) {}
  process.exit(1);
});
