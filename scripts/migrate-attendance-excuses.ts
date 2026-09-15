/**
 * Migration: migrate-attendance-excuses
 *
 * Updates the attendance_logs sheet to the Phase 4 8-column schema:
 *   id | student_id | date | present | logged_by | session_label | excuse | excuse_note
 *
 * Safe to re-run — only updates the header row if columns are missing.
 * Data rows are preserved as-is (existing records have empty excuse fields).
 *
 * Run:
 *   npm run migrate-attendance-excuses
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

const REQUIRED_HEADERS = ['id', 'student_id', 'date', 'present', 'logged_by', 'session_label', 'excuse', 'excuse_note'];

async function run() {
  if (!SPREADSHEET_ID) {
    console.error('❌  GOOGLE_SPREADSHEET_ID not set in .env.local');
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('Reading attendance_logs sheet...');
  const attRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'attendance_logs',
  });

  const rows = (attRes.data.values || []) as string[][];
  if (rows.length === 0) {
    console.error('❌  attendance_logs sheet is empty — run setup-sheets first');
    process.exit(1);
  }

  const headers = rows[0] || [];
  console.log(`Current headers (${headers.length}): ${headers.join(', ') || '(none)'}`);

  // Check if all required columns already exist
  const hasAllCols = REQUIRED_HEADERS.every((h, i) => headers[i] === h);

  if (hasAllCols) {
    console.log('✓ Headers already match Phase 4 schema — nothing to do');
    console.log('  Columns: ' + REQUIRED_HEADERS.join(' | '));
    console.log('\n✅  Migration complete (no changes needed)');
    return;
  }

  // Determine how many new columns to add
  // If headers end at col 5 (session_label), we need to add cols 6 (excuse) and 7 (excuse_note)
  const currentCount = headers.length;
  const neededCount = REQUIRED_HEADERS.length;

  if (currentCount > neededCount) {
    console.warn(`⚠️  Sheet has ${currentCount} columns (more than expected). Header will be truncated to ${neededCount}.`);
  }

  const newHeaders = REQUIRED_HEADERS.slice(0, Math.max(currentCount, neededCount));

  // If current headers are fewer, pad with new column names
  for (let i = currentCount; i < neededCount; i++) {
    newHeaders[i] = REQUIRED_HEADERS[i];
  }

  console.log(`\nUpdating header row to Phase 4 schema...`);
  console.log(`  New columns: ${newHeaders.slice(currentCount).join(', ')}`);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'attendance_logs!A1:Z1',
    valueInputOption: 'RAW',
    requestBody: { values: [newHeaders] },
  });

  console.log('✓ Headers updated to: ' + newHeaders.join(' | '));

  const dataRows = rows.slice(1);
  if (dataRows.length > 0) {
    console.log(`\n⚠️  ${dataRows.length} existing data row(s) preserved (excuse/excuse_note columns are empty for old records)`);
    console.log('   They will automatically receive empty excuse fields when next updated via API.');
  }

  console.log('\n✅  Migration complete!');
  console.log('   Existing records need their excuse fields filled via the dashboard UI.');
}

run().catch(err => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});