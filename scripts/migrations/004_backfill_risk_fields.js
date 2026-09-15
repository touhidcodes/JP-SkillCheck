/**
 * MIGRATION: 004_backfill_risk_fields_to_students
 *
 * Purpose: Ensures students sheet has risk_probability and risk_band columns
 * populated based on existing risk_status data.
 * Date: 2026-05-11
 *
 * This migration is a safety check to ensure any students with at_risk status
 * have corresponding risk_probability values and risk_band values set.
 *
 * Logic:
 * - If risk_status = 'at_risk' and risk_probability is empty, set to 0.7
 * - If risk_status = 'at_risk' and risk_band is empty, set to 'at_risk'
 * - If risk_status = 'safe' and risk_band is empty, set to 'safe'
 * - risk_probability stays as-is if already set
 *
 * REVERSIBILITY: This modifies existing data. Create a backup of the
 * students sheet before running if rollback may be needed.
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

const HEADER_MAP = {
  id: 0,
  name: 1,
  batch: 2,
  project: 3,
  mentor_email: 4,
  student_email: 5,
  stage: 6,
  risk_status: 7,
  risk_reasons: 8,
  last_activity_date: 9,
  job_focus: 10,
  terminated: 11,
  hired: 12,
  experience: 13,
  created_at: 14,
  updated_at: 15,
  risk_probability: 16,
  risk_band: 17
};

async function readStudents() {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'students'
  });
  return response.data.values || [];
}

async function updateRow(rowIndex, rowData) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `students!A${rowIndex + 2}:R${rowIndex + 2}`,
    valueInputOption: 'RAW',
    requestBody: { values: [rowData] }
  });
}

async function migrate() {
  console.log('\n=== MIGRATION 004: Backfill Risk Fields ===\n');

  const rows = await readStudents();

  if (rows.length < 2) {
    console.log('No students found, skipping.');
    return;
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  const hasRiskProbability = headers.includes('risk_probability');
  const hasRiskBand = headers.includes('risk_band');

  if (!hasRiskProbability || !hasRiskBand) {
    console.log('risk_probability or risk_band columns not found. Run 002_add_missing_columns first.');
    return;
  }

  const riskStatusIdx = headers.indexOf('risk_status');
  const riskProbabilityIdx = headers.indexOf('risk_probability');
  const riskBandIdx = headers.indexOf('risk_band');

  let updated = 0;
  const updates = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const riskStatus = row[riskStatusIdx] || '';
    let needsUpdate = false;

    if (riskStatus === 'at_risk') {
      if (!row[riskProbabilityIdx] && riskProbabilityIdx < row.length) {
        if (row.length <= riskProbabilityIdx) {
          while (row.length <= riskProbabilityIdx) row.push('');
        }
        row[riskProbabilityIdx] = '0.7';
        needsUpdate = true;
      }
      if (!row[riskBandIdx]) {
        if (row.length <= riskBandIdx) {
          while (row.length <= riskBandIdx) row.push('');
        }
        row[riskBandIdx] = 'at_risk';
        needsUpdate = true;
      }
    } else if (riskStatus === 'safe') {
      if (!row[riskBandIdx]) {
        if (row.length <= riskBandIdx) {
          while (row.length <= riskBandIdx) row.push('');
        }
        row[riskBandIdx] = 'safe';
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      updates.push({ rowIndex: i, row });
      updated++;
    }
  }

  if (updates.length === 0) {
    console.log('No rows needed updating. All risk fields are populated.');
    return;
  }

  console.log(`Found ${updates.length} rows needing updates...`);

  for (const update of updates) {
    await updateRow(update.rowIndex, update.row);
  }

  console.log(`\n=== Migration Complete ===`);
  console.log(`Updated ${updated} rows with risk fields`);
  console.log('Note: Review a sample of updated rows to confirm correctness.\n');
}

migrate().catch(err => {
  console.error('\n!!! Migration failed !!!');
  console.error(err.message || err);
  process.exit(1);
});