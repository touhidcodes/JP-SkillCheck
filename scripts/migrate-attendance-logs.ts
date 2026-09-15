/**
 * Migration: migrate-attendance-logs
 *
 * 1. Updates the attendance_logs sheet headers to the new 6-column schema:
 *    id | student_id | date | present | logged_by | session_label
 *
 * 2. Seeds realistic dummy attendance data for all students across 6 sessions
 *    that mirror the image UI (Orientation, 22 April, 23 April, Javascript,
 *    27 April, 28 April) with a realistic mix of Present / Absent.
 *
 * Seeding logic:
 *   - Every student gets a record for every session (no gaps)
 *   - ~85% Present rate overall (realistic for a bootcamp)
 *   - A few students have 2-3 absences to trigger at-risk logic
 *   - Idempotent — skips seed if data rows already exist
 *
 * Run:
 *   npm run migrate-attendance-logs
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

const NEW_HEADERS = ['id', 'student_id', 'date', 'present', 'logged_by', 'session_label'];

// Sessions matching the image columns exactly
const SESSIONS = [
  { date: '2026-04-20', label: 'Orientation' },
  { date: '2026-04-22', label: '' },           // plain date column
  { date: '2026-04-23', label: '' },
  { date: '2026-04-24', label: 'Javascript' },
  { date: '2026-04-27', label: '' },
  { date: '2026-04-28', label: '' },
];

// Per-student attendance pattern index → which sessions they're absent from
// Index matches student row order (0-based). null = all present.
// Designed so a few students have 2-3 absences (at-risk threshold)
const ABSENCE_PATTERNS: Record<number, number[]> = {
  0:  [],                // all present
  1:  [],
  2:  [3],               // absent on Javascript
  3:  [3, 4, 5],         // 3 absences → terminated threshold
  4:  [],
  5:  [5],               // absent on 28 April
  6:  [],
  7:  [],
  8:  [3, 4],            // 2 absences → at-risk
  9:  [],
  10: [],
  11: [0],               // absent on Orientation
  12: [],
};

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

  // ── Step 1: Read students ──────────────────────────────────────────────────
  console.log('Reading students sheet...');
  const studentsRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'students',
  });

  const studentRows = (studentsRes.data.values || []) as string[][];
  const dataRows = studentRows.slice(1).filter(r => r[0]);

  if (dataRows.length === 0) {
    console.error('❌  No students found. Run setup-sheets first.');
    process.exit(1);
  }
  console.log(`✓ Found ${dataRows.length} student(s)`);

  // ── Step 2: Read current attendance_logs ──────────────────────────────────
  console.log('\nReading attendance_logs sheet...');
  const attRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'attendance_logs',
  });

  const attRows = (attRes.data.values || []) as string[][];
  const currentHeaders = attRows[0] || [];
  const existingDataRows = attRows.slice(1).filter(r => r[0]);

  console.log(`Current headers (${currentHeaders.length}): ${currentHeaders.join(', ') || '(none)'}`);
  console.log(`Existing data rows: ${existingDataRows.length}`);

  // ── Step 3: Update headers if needed ──────────────────────────────────────
  const headersMatch = NEW_HEADERS.every((h, i) => currentHeaders[i] === h);
  if (!headersMatch) {
    console.log('\nUpdating attendance_logs headers...');
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'attendance_logs!A1',
      valueInputOption: 'RAW',
      requestBody: { values: [NEW_HEADERS] },
    });
    console.log('✓ Headers updated to:', NEW_HEADERS.join(', '));
  } else {
    console.log('✓ Headers already correct');
  }

  // ── Step 4: Seed dummy data ────────────────────────────────────────────────
  if (existingDataRows.length > 0) {
    console.log(`\n⚠️  attendance_logs already has ${existingDataRows.length} row(s) — skipping seed.`);
    console.log('   Delete existing rows manually if you want to re-seed.');
    console.log('\n✅  Migration complete (headers updated, seed skipped).');
    return;
  }

  console.log(`\nSeeding attendance for ${dataRows.length} students × ${SESSIONS.length} sessions...`);

  const seedRows: string[][] = [];
  let presentCount = 0;
  let absentCount = 0;

  dataRows.forEach((studentRow, studentIdx) => {
    const studentId = studentRow[0];
    const absentSessions = ABSENCE_PATTERNS[studentIdx] ?? [];

    SESSIONS.forEach((session, sessionIdx) => {
      const present = !absentSessions.includes(sessionIdx);
      if (present) presentCount++; else absentCount++;

      seedRows.push([
        uuidv4(),
        studentId,
        session.date,
        String(present),
        'admin@example.com',
        session.label,
      ]);
    });
  });

  // Batch append all rows
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'attendance_logs',
    valueInputOption: 'RAW',
    requestBody: { values: seedRows },
  });

  const total = seedRows.length;
  const rate = Math.round((presentCount / total) * 100);

  console.log(`✓ ${total} records seeded`);
  console.log(`  Present: ${presentCount} | Absent: ${absentCount} | Rate: ${rate}%`);
  console.log('\nSessions seeded:');
  SESSIONS.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.date}${s.label ? ` (${s.label})` : ''}`);
  });

  console.log('\n✅  Migration complete!');
  console.log('   Go to Students → Attendance to see the matrix.');
}

run().catch(err => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
