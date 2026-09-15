/**
 * Migration: Ensures the students sheet has all required columns in the correct order.
 *
 * Final layout (cols A–N):
 *   A: id
 *   B: name
 *   C: batch
 *   D: mentor_email
 *   E: stage
 *   F: risk_status
 *   G: risk_reasons
 *   H: last_activity_date
 *   I: job_focus
 *   J: terminated
 *   K: hired
 *   L: experience      ← right after hired
 *   M: created_at
 *   N: updated_at
 *
 * The script is IDEMPOTENT — safe to run multiple times.
 *
 * Run:
 *   npm run migrate-columns
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
const SHEET = 'students';

const FINAL_HEADERS = [
  'id', 'name', 'batch', 'mentor_email', 'stage',
  'risk_status', 'risk_reasons', 'last_activity_date',
  'job_focus', 'terminated', 'hired',
  'experience',
  'created_at', 'updated_at',
];

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

  console.log(`Reading "${SHEET}" sheet...`);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET,
  });

  const rows: string[][] = (response.data.values || []) as string[][];

  if (rows.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [FINAL_HEADERS] },
    });
    console.log('✅  Empty sheet — headers written.');
    return;
  }

  const currentHeaders = rows[0];
  console.log(`Current headers (${currentHeaders.length}): ${currentHeaders.join(', ')}`);

  // Check if already fully migrated (experience is at index 11, right after hired)
  if (
    currentHeaders[11] === 'experience' &&
    currentHeaders[12] === 'created_at' &&
    currentHeaders[13] === 'updated_at'
  ) {
    console.log('✅  All columns already in correct order. Nothing to do.');
    return;
  }

  const hasJobFocus = currentHeaders.includes('job_focus');
  const hasExperience = currentHeaders.includes('experience');
  // Where is experience currently sitting (if present)?
  const experienceIdx = currentHeaders.indexOf('experience');

  console.log(`hasJobFocus=${hasJobFocus}, hasExperience=${hasExperience}, experienceIdx=${experienceIdx}`);

  const newRows: string[][] = rows.map((row, i) => {
    if (i === 0) return FINAL_HEADERS;

    if (!hasJobFocus) {
      // Original 10-col sheet: id..last_activity_date, created_at, updated_at
      return [
        row[0] || '',   // id
        row[1] || '',   // name
        row[2] || '',   // batch
        row[3] || '',   // mentor_email
        row[4] || '',   // stage
        row[5] || '',   // risk_status
        row[6] || '',   // risk_reasons
        row[7] || '',   // last_activity_date
        '',             // job_focus    (new)
        'false',        // terminated   (new)
        'false',        // hired        (new)
        '',             // experience   (new — after hired)
        row[8] || '',   // created_at   (shifted to M)
        row[9] || '',   // updated_at   (shifted to N)
      ];
    }

    if (hasJobFocus && hasExperience && experienceIdx === 13) {
      // experience is currently at col N (after updated_at) — move it to col L (after hired)
      // Current: id,name,batch,mentor_email,stage,risk_status,risk_reasons,last_activity_date,
      //          job_focus,terminated,hired,created_at,updated_at,experience
      // Indices:  0  1    2     3           4     5          6           7
      //           8         9           10    11          12          13
      return [
        row[0] || '',   // id
        row[1] || '',   // name
        row[2] || '',   // batch
        row[3] || '',   // mentor_email
        row[4] || '',   // stage
        row[5] || '',   // risk_status
        row[6] || '',   // risk_reasons
        row[7] || '',   // last_activity_date
        row[8] || '',   // job_focus
        row[9] || '',   // terminated
        row[10] || '',  // hired
        row[13] || '',  // experience  (moved from N → L)
        row[11] || '',  // created_at  (shifted from L → M)
        row[12] || '',  // updated_at  (shifted from M → N)
      ];
    }

    if (hasJobFocus && !hasExperience) {
      // 13-col sheet: job_focus added but experience missing
      // Current: id..hired, created_at, updated_at (indices 0–12)
      return [
        row[0] || '',   // id
        row[1] || '',   // name
        row[2] || '',   // batch
        row[3] || '',   // mentor_email
        row[4] || '',   // stage
        row[5] || '',   // risk_status
        row[6] || '',   // risk_reasons
        row[7] || '',   // last_activity_date
        row[8] || '',   // job_focus
        row[9] || '',   // terminated
        row[10] || '',  // hired
        '',             // experience   (new — inserted at L)
        row[11] || '',  // created_at   (shifted to M)
        row[12] || '',  // updated_at   (shifted to N)
      ];
    }

    // Fallback: return as-is padded to 14 cols
    return FINAL_HEADERS.map((_, idx) => row[idx] || '');
  });

  console.log(`Writing ${newRows.length - 1} row(s) with final layout...`);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: newRows },
  });

  console.log('✅  Migration complete!');
  console.log(`   Final headers: ${FINAL_HEADERS.join(', ')}`);
}

run().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
