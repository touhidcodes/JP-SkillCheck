/**
 * MIGRATION: 002_add_missing_columns_to_existing_sheets
 *
 * Purpose: Adds missing columns to existing sheets that were added in later
 * iterations but the schema wasn't backfilled.
 * Date: 2026-05-11
 *
 * This migration adds columns that are referenced in code but may not exist
 * in the actual Google Sheets:
 *
 * 1. students sheet:
 *    - risk_probability (numeric)
 *    - risk_band (string: safe|watch|concern|at_risk|critical)
 *    - project (string)
 *    - experience (string: fresher|experienced)
 *
 * 2. progress_logs sheet:
 *    - job_url (string)
 *    - mock_feedback (string)
 *    - mock_score (numeric)
 *    - mock_strengths (string)
 *    - mock_improvements (string)
 *    - mock_interview_type (string)
 *    - mock_interviewer (string)
 *
 * 3. attendance_logs sheet:
 *    - excuse_note (string)
 *
 * 4. mentor_tasks sheet:
 *    - source (string: auto|manual)
 *    - priority (string: low|medium|high|critical)
 *
 * REVERSIBILITY: This migration only ADDS columns. It never modifies or
 * deletes existing data or columns. To rollback, columns must be manually
 * removed in Google Sheets UI (there's no API to delete columns).
 */

// Load .env.local so this script works when run directly with node
const path = require('path');
require('fs').existsSync(path.resolve(__dirname, '../../.env.local')) &&
  require('fs').readFileSync(path.resolve(__dirname, '../../.env.local'), 'utf8')
    .split('\n')
    .forEach(line => {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const val = match[2].trim().replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
        if (!process.env[key]) process.env[key] = val;
      }
    });

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const GOOGLE_SERVICE_ACCOUNT = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');

const { google } = require('googleapis');
const auth = new google.auth.GoogleAuth({
  credentials: GOOGLE_SERVICE_ACCOUNT,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

const COLUMNS_TO_ADD = {
  students: [
    'risk_probability',
    'risk_band',
    'project',
    'experience'
  ],
  progress_logs: [
    'job_url',
    'mock_feedback',
    'mock_score',
    'mock_strengths',
    'mock_improvements',
    'mock_interview_type',
    'mock_interviewer'
  ],
  attendance_logs: [
    'excuse_note'
  ],
  mentor_tasks: [
    'source',
    'priority'
  ]
};

async function getExistingHeaders(sheetName) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!1:1`
  });
  return (response.data.values?.[0] || []).map(h => h.trim());
}

async function sheetExists(sheetName) {
  try {
    await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`
    });
    return true;
  } catch (err) {
    if (err.message && err.message.includes('Unable to parse range')) return false;
    if (err.code === 400) return false;
    throw err;
  }
}

async function addMissingColumns(sheetName, newColumns) {
  if (!await sheetExists(sheetName)) {
    console.log(`  ⚠ ${sheetName}: sheet not found, skipping`);
    return [];
  }
  const existing = await getExistingHeaders(sheetName);
  const existingSet = new Set(existing);
  const toAdd = newColumns.filter(col => !existingSet.has(col));

  if (toAdd.length === 0) {
    console.log(`  ○ ${sheetName}: no new columns needed`);
    return [];
  }

  // Build A1 notation that handles columns beyond Z (e.g. AA, AB…)
  function colLetter(idx) {
    let letter = '';
    idx++; // 1-based
    while (idx > 0) {
      const rem = (idx - 1) % 26;
      letter = String.fromCharCode(65 + rem) + letter;
      idx = Math.floor((idx - 1) / 26);
    }
    return letter;
  }

  const startCol = colLetter(existing.length);
  const endCol   = colLetter(existing.length + toAdd.length - 1);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!${startCol}1:${endCol}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [toAdd] }
  });

  console.log(`  ✓ ${sheetName}: added ${toAdd.join(', ')}`);
  return toAdd;
}

async function migrate() {
  console.log('\n=== MIGRATION 002: Add Missing Columns ===\n');
  console.log(`Spreadsheet: ${SPREADSHEET_ID}\n`);

  let totalAdded = 0;

  for (const [sheetName, columns] of Object.entries(COLUMNS_TO_ADD)) {
    console.log(`Checking ${sheetName}...`);
    const added = await addMissingColumns(sheetName, columns);
    totalAdded += added.length;
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`Total columns added: ${totalAdded}`);
  console.log('\nNote: Existing data in new columns will be empty/null.');
  console.log('Add sample data or run a data seeding script if needed.\n');
}

migrate().catch(err => {
  console.error('\n!!! Migration failed !!!');
  console.error(err.message || err);
  process.exit(1);
});