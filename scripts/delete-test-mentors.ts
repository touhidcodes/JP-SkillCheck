/**
 * delete-test-mentors.ts
 *
 * Permanently removes mentor1, mentor2, mentor3 (and any mentorN pattern)
 * and ALL their related data from every sheet in the database.
 *
 * Sheets cleaned:
 *   users            — the mentor accounts themselves
 *   students         — students assigned to these mentors
 *   progress_logs    — logs for those students
 *   attendance_logs  — attendance for those students
 *   mentor_tasks     — tasks created by these mentors
 *   risk_history     — risk entries for those students
 *   warnings         — warnings for those students
 *   stage_history    — stage transitions for those students
 *   notifications    — notifications referencing those students
 *   analytics_events — events by/about those mentors/students
 *   daily_metrics    — (skipped — aggregate, not per-mentor)
 *
 * Run:
 *   npx tsx scripts/delete-test-mentors.ts
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
const GOOGLE_SERVICE_ACCOUNT = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}');

if (!SPREADSHEET_ID) {
  console.error('❌  GOOGLE_SPREADSHEET_ID not set');
  process.exit(1);
}

const auth = new google.auth.GoogleAuth({
  credentials: GOOGLE_SERVICE_ACCOUNT,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function readSheet(name: string): Promise<string[][]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: name,
  });
  return (res.data.values ?? []) as string[][];
}

async function getSheetId(name: string): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets?.find(s => s.properties?.title === name);
  if (!sheet?.properties?.sheetId == null) throw new Error(`Sheet "${name}" not found`);
  return sheet!.properties!.sheetId!;
}

/**
 * Delete rows by their 0-based indices (from the full sheet including header).
 * Must delete in reverse order so indices don't shift.
 */
async function deleteRows(sheetName: string, rowIndices: number[]): Promise<void> {
  if (rowIndices.length === 0) return;
  const sheetId = await getSheetId(sheetName);
  // Sort descending so we delete from bottom up
  const sorted = [...rowIndices].sort((a, b) => b - a);
  const requests = sorted.map(idx => ({
    deleteDimension: {
      range: {
        sheetId,
        dimension: 'ROWS',
        startIndex: idx,
        endIndex: idx + 1,
      },
    },
  }));
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🗑️  Delete Test Mentors — Deep Clean\n');
  console.log(`Spreadsheet: ${SPREADSHEET_ID}\n`);

  // ── Step 1: Find test mentor emails from users sheet ──────────────────────
  console.log('📋 Step 1: Scanning users sheet for test mentor accounts…');
  const usersRows = await readSheet('users');
  const header = usersRows[0] ?? [];
  const dataRows = usersRows.slice(1);

  // Pattern: name is exactly "mentorN" (case-insensitive)
  // OR email matches mentorN@... pattern
  const TEST_NAME_PATTERN = /^mentor\d+$/i;
  const TEST_EMAIL_PATTERN = /^mentor\d+@/i;

  const testMentorEmails = new Set<string>();
  const testMentorUserRowIndices: number[] = []; // 0-based full-sheet indices (row 0 = header)

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const name = (row[1] ?? '').trim();
    const email = (row[2] ?? '').trim();
    const role = (row[3] ?? '').trim();
    if (role === 'mentor' && (TEST_NAME_PATTERN.test(name) || TEST_EMAIL_PATTERN.test(email))) {
      testMentorEmails.add(email);
      testMentorUserRowIndices.push(i + 1); // +1 because row 0 is header
      console.log(`  Found test mentor: ${name} <${email}>`);
    }
  }

  // Also add emails that match the pattern even if not in users sheet
  // (orphaned students whose mentor was already deleted from users)
  const TEST_ORPHAN_EMAILS = [
    'mentor1@programming-hero.com',
    'mentor2@programming-hero.com',
    'mentor3@programming-hero.com',
  ];
  for (const email of TEST_ORPHAN_EMAILS) {
    if (!testMentorEmails.has(email)) {
      testMentorEmails.add(email);
      console.log(`  Found orphaned test mentor email: ${email} (not in users sheet)`);
    }
  }

  if (testMentorEmails.size === 0) {
    console.log('  ✅ No test mentor accounts found. Nothing to delete.');
    return;
  }

  // Avoid `[...]` spread over Set (TS config can reject iteration without es2015/downlevelIteration)
  const testMentorEmailsList = Array.from(testMentorEmails).join(', ');
  console.log(`\n  → ${testMentorEmails.size} test mentor(s) to remove: ${testMentorEmailsList}\n`);

  // ── Step 2: Find all student IDs belonging to these mentors ───────────────
  console.log('📋 Step 2: Finding students assigned to test mentors…');
  const studentsRows = await readSheet('students');
  const studentData = studentsRows.slice(1);

  const testStudentIds = new Set<string>();
  const testStudentRowIndices: number[] = [];

  for (let i = 0; i < studentData.length; i++) {
    const row = studentData[i];
    // mentor_email is col 4 in new schema, col 3 in old schema
    const mentorEmail = row.length >= 16 ? row[4] ?? '' : row.length === 15 ? row[4] ?? '' : row[3] ?? '';
    const studentId = row[0] ?? '';
    if (testMentorEmails.has(mentorEmail)) {
      testStudentIds.add(studentId);
      testStudentRowIndices.push(i + 1); // +1 for header
    }
  }

  console.log(`  → ${testStudentIds.size} student(s) to remove`);

  // ── Step 3: Clean each related sheet ─────────────────────────────────────

  // Helper: delete rows where a specific column matches a set of values
  async function cleanSheet(
    sheetName: string,
    colIndex: number,
    matchSet: Set<string>,
    label: string
  ): Promise<number> {
    let rows: string[][];
    try {
      rows = await readSheet(sheetName);
    } catch {
      console.log(`  ⚠️  Sheet "${sheetName}" not found — skipping`);
      return 0;
    }
    const data = rows.slice(1);
    const toDelete: number[] = [];
    for (let i = 0; i < data.length; i++) {
      const val = (data[i][colIndex] ?? '').trim();
      if (matchSet.has(val)) {
        toDelete.push(i + 1); // +1 for header
      }
    }
    if (toDelete.length > 0) {
      await deleteRows(sheetName, toDelete);
      console.log(`  ✅ ${sheetName}: removed ${toDelete.length} ${label}`);
    } else {
      console.log(`  ○  ${sheetName}: nothing to remove`);
    }
    return toDelete.length;
  }

  console.log('\n📋 Step 3: Cleaning related sheets…\n');

  // progress_logs — col 1 = student_id (UUID match), also col 10 = logged_by (mentor email)
  // Handle both UUID-based and old integer-based student IDs
  {
    let rows: string[][];
    try {
      rows = await readSheet('progress_logs');
    } catch {
      rows = [];
      console.log('  ⚠️  Sheet "progress_logs" not found — skipping');
    }
    if (rows.length > 0) {
      const toDelete: number[] = [];
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const studentId = (r[1] ?? '').trim();
        const studentEmail = (r[3] ?? '').trim(); // old schema: student_email at col 3
        const loggedBy = (r[10] ?? '').trim();
        if (testStudentIds.has(studentId) || testMentorEmails.has(loggedBy) || testMentorEmails.has(studentEmail)) {
          toDelete.push(i + 1); // +1 for header
        }
      }
      if (toDelete.length > 0) {
        await deleteRows('progress_logs', toDelete);
        console.log(`  ✅ progress_logs: removed ${toDelete.length} progress log(s)`);
      } else {
        console.log('  ○  progress_logs: nothing to remove');
      }
    }
  }

  // attendance_logs — col 1 = student_id
  await cleanSheet('attendance_logs', 1, testStudentIds, 'attendance log(s)');

  // mentor_tasks — col 1 = mentor_email
  await cleanSheet('mentor_tasks', 1, testMentorEmails, 'mentor task(s)');

  // risk_history — col 1 = student_id
  await cleanSheet('risk_history', 1, testStudentIds, 'risk history entry/entries');

  // warnings — col 1 = student_id
  await cleanSheet('warnings', 1, testStudentIds, 'warning(s)');

  // stage_history — col 1 = student_id
  await cleanSheet('stage_history', 1, testStudentIds, 'stage history entry/entries');

  // notifications — col 3 = student_id
  await cleanSheet('notifications', 3, testStudentIds, 'notification(s)');

  // analytics_events — col 4 = student_id
  await cleanSheet('analytics_events', 4, testStudentIds, 'analytics event(s)');

  // ── Step 4: Delete students ───────────────────────────────────────────────
  console.log('\n📋 Step 4: Deleting student records…');
  if (testStudentRowIndices.length > 0) {
    await deleteRows('students', testStudentRowIndices);
    console.log(`  ✅ students: removed ${testStudentRowIndices.length} student(s)`);
  } else {
    console.log('  ○  students: nothing to remove');
  }

  // ── Step 5: Delete the mentor user accounts ───────────────────────────────
  console.log('\n📋 Step 5: Deleting test mentor user accounts…');
  if (testMentorUserRowIndices.length > 0) {
    await deleteRows('users', testMentorUserRowIndices);
    console.log(`  ✅ users: removed ${testMentorUserRowIndices.length} mentor account(s)`);
  } else {
    console.log('  ○  users: nothing to remove');
  }

  console.log('\n✅  Deep clean complete. All test mentor data has been permanently removed.\n');
}

main().catch(err => {
  console.error('\n❌  Script failed:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});

