/**
 * Migration: migrate-progress-logs
 *
 * 1. Updates the progress_logs sheet headers to the new schema:
 *    id | student_id | student_name | student_email | log_type | company_name |
 *    scheduled_date | scheduled_time | note | logged_at | logged_by
 *
 * 2. Seeds 10 dummy progress log entries using real student IDs from the students sheet.
 *
 * The script is IDEMPOTENT — safe to run multiple times (won't duplicate seeds if
 * the sheet already has data rows beyond the header).
 *
 * Run:
 *   npm run migrate-progress-logs
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { google } from 'googleapis';
import { v4 as uuidv4 } from 'uuid';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

const NEW_HEADERS = [
  'id', 'student_id', 'student_name', 'student_email',
  'log_type', 'company_name', 'scheduled_date', 'scheduled_time',
  'note', 'logged_at', 'logged_by',
];

// Dummy log templates — student_id / student_name / student_email filled in at runtime
const LOG_TEMPLATES = [
  { log_type: 'Interview Call', company_name: 'SM Technology',         scheduled_date: '2026-04-21', scheduled_time: '10:30:00 AM', note: 'Technical round 1' },
  { log_type: 'Interview Call', company_name: 'SM Technology',         scheduled_date: '2026-04-21', scheduled_time: '10:30:00 AM', note: 'Technical round 1' },
  { log_type: 'Interview Call', company_name: 'SM Technology',         scheduled_date: '2026-04-21', scheduled_time: '11:00:00 AM', note: 'HR round' },
  { log_type: 'Interview Call', company_name: 'webQ',                  scheduled_date: '2026-04-23', scheduled_time: '10:20:00 PM', note: 'Initial screening' },
  { log_type: 'Interview Call', company_name: 'Phitron',               scheduled_date: '2026-04-22', scheduled_time: '04:00:00 PM', note: 'Problem solving round' },
  { log_type: 'Job Task',       company_name: 'TripBooking AI',        scheduled_date: '2026-04-22', scheduled_time: '06:50:00 PM', note: 'Build a REST API task' },
  { log_type: 'Interview Call', company_name: 'Mirsaige PMC',          scheduled_date: '2026-04-23', scheduled_time: '02:00:00 PM', note: 'Final interview' },
  { log_type: 'Interview Call', company_name: 'Smart IT Consultancy',  scheduled_date: '2026-05-02', scheduled_time: '11:00:00 AM', note: 'Technical assessment' },
  { log_type: 'Interview Call', company_name: 'Smart IT Consultancy',  scheduled_date: '2026-05-02', scheduled_time: '11:00:00 AM', note: 'Technical assessment' },
  { log_type: 'Offer',          company_name: 'Brain Station 23',      scheduled_date: '2026-04-28', scheduled_time: '12:00:00 PM', note: 'Offer letter received' },
];

// Timestamps that mirror the image — same-minute entries get green highlight in UI
const LOGGED_AT_TIMES = [
  '2026-04-20T22:24:12.000Z',
  '2026-04-20T22:24:12.000Z', // same minute → green group
  '2026-04-20T22:25:12.000Z',
  '2026-04-21T10:24:12.000Z',
  '2026-04-21T12:20:19.000Z',
  '2026-04-22T19:29:30.000Z',
  '2026-04-22T23:45:45.000Z',
  '2026-04-27T18:11:04.000Z',
  '2026-04-27T18:11:04.000Z', // same minute → green group
  '2026-04-28T12:40:00.000Z',
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

  // ── Step 1: Read students to get real IDs ──────────────────────────────────
  console.log('Reading students sheet...');
  const studentsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'students',
  });

  const studentRows = (studentsRes.data.values || []) as string[][];
  const dataRows = studentRows.slice(1).filter(r => r[0]); // skip header, skip empty

  if (dataRows.length === 0) {
    console.error('❌  No students found. Run setup-sheets and add students first.');
    process.exit(1);
  }

  console.log(`✓ Found ${dataRows.length} student(s)`);

  // ── Step 2: Read current progress_logs sheet ───────────────────────────────
  console.log('\nReading progress_logs sheet...');
  const logsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'progress_logs',
  });

  const logRows = (logsRes.data.values || []) as string[][];
  const currentHeaders = logRows[0] || [];
  const existingDataRows = logRows.slice(1).filter(r => r[0]);

  console.log(`Current headers: ${currentHeaders.join(', ') || '(none)'}`);
  console.log(`Existing data rows: ${existingDataRows.length}`);

  // ── Step 3: Update headers ─────────────────────────────────────────────────
  const headersMatch = NEW_HEADERS.every((h, i) => currentHeaders[i] === h);
  if (!headersMatch) {
    console.log('\nUpdating progress_logs headers...');
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'progress_logs!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [NEW_HEADERS] },
    });
    console.log('✓ Headers updated');
  } else {
    console.log('✓ Headers already correct');
  }

  // ── Step 4: Seed dummy data only if sheet is empty ─────────────────────────
  if (existingDataRows.length > 0) {
    console.log(`\n⚠️  progress_logs already has ${existingDataRows.length} row(s) — skipping seed to avoid duplicates.`);
    console.log('   Delete existing rows manually if you want to re-seed.');
    console.log('\n✅  Migration complete (headers updated, seed skipped).');
    return;
  }

  console.log('\nSeeding 10 dummy progress log entries...');

  const seedRows: string[][] = LOG_TEMPLATES.map((tpl, i) => {
    // Round-robin across available students
    const student = dataRows[i % dataRows.length];
    const studentId    = student[0] || '';
    const studentName  = student[1] || 'Unknown';
    const studentEmail = student[3] || ''; // mentor_email used as contact email

    return [
      uuidv4(),
      studentId,
      studentName,
      studentEmail,
      tpl.log_type,
      tpl.company_name,
      tpl.scheduled_date,
      tpl.scheduled_time,
      tpl.note,
      LOGGED_AT_TIMES[i],
      'admin@example.com',
    ];
  });

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'progress_logs',
    valueInputOption: 'RAW',
    requestBody: { values: seedRows },
  });

  console.log('✓ 10 dummy rows seeded\n');
  console.log('Sample entries:');
  seedRows.forEach((row, i) => {
    console.log(`  ${i + 1}. [${row[4]}] ${row[1]} → ${row[5]} on ${row[6]}`);
  });

  console.log('\n✅  Migration complete!');
  console.log('   Run "npm run dev" and click Details on any student to see the Progress Logs tab.');
}

run().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
