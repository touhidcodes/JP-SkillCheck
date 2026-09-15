/**
 * MIGRATION: 003_backfill_stage_history_from_students_sheet
 *
 * Purpose: Populates the stage_history sheet from existing student stage data.
 * Date: 2026-05-11
 *
 * PROBLEM: stage_history is a new sheet, but students have existing stage values
 * in the students sheet. We need to create historical stage transition records
 * based on the student's current stage and their created_at timestamp.
 *
 * APPROACH:
 * - For each student, create a single stage_history entry showing they started
 *   in their current stage on their created_at date (approximation)
 * - Future stage transitions will be logged as they happen via the API
 *
 * LIMITATIONS:
 * - We don't know the actual history of stage changes before this migration
 * - We use current stage + created_at as a rough approximation
 * - Triggered_by will be 'migration' for all backfilled entries
 *
 * REVERSIBILITY: This migration is destructive in the sense that it creates
 * NEW rows. To rollback, you would need to delete the backfilled rows from
 * stage_history (those with triggered_by='migration').
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

const VALID_STAGES = ['learning', 'applying', 'interviewing', 'offer_pending', 'placed', 'hired'];

async function readSheet(title) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: title
  });
  return response.data.values || [];
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function migrate() {
  console.log('\n=== MIGRATION 003: Backfill Stage History ===\n');

  console.log('[1/2] Reading students sheet...');
  const studentRows = await readSheet('students');

  if (studentRows.length < 2) {
    console.log('No students found, skipping backfill.');
    return;
  }

  const headers = studentRows[0];
  const studentData = studentRows.slice(1);

  console.log(`Found ${studentData.length} students`);

  const stageHistoryRows = await readSheet('stage_history');
  const existingStudentIds = new Set();

  if (stageHistoryRows.length > 1) {
    const historyData = stageHistoryRows.slice(1);
    historyData.forEach(row => {
      if (row[1]) existingStudentIds.add(row[1]);
    });
    console.log(`Stage history already has ${existingStudentIds.size} entries, skipping those.`);
  }

  const newEntries = [];

  for (const row of studentData) {
    const studentId = row[0];
    if (!studentId || existingStudentIds.has(studentId)) continue;

    const currentStage = row[6] || 'learning';
    const createdAt = row[14] || new Date().toISOString();

    if (!VALID_STAGES.includes(currentStage)) continue;

    newEntries.push([
      uuidv4(),
      studentId,
      '',
      currentStage,
      createdAt,
      'migration',
      'Backfilled from students sheet on migration'
    ]);
  }

  if (newEntries.length === 0) {
    console.log('No new stage history entries to create.');
    return;
  }

  console.log(`[2/2] Creating ${newEntries.length} stage_history entries...`);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'stage_history!A:A',
    valueInputOption: 'RAW',
    requestBody: { values: newEntries }
  });

  console.log(`\n=== Migration Complete ===`);
  console.log(`Created ${newEntries.length} stage_history entries`);
  console.log('Note: These entries approximate historical state and may not be accurate.');
  console.log('Future stage changes will be logged with accurate triggered_by values.\n');
}

migrate().catch(err => {
  console.error('\n!!! Migration failed !!!');
  console.error(err.message || err);
  process.exit(1);
});