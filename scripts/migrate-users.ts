/**
 * Migration: Seed / upsert the users sheet with the production team.
 *
 * Users sheet layout (cols A–F):
 *   A: id
 *   B: name
 *   C: email
 *   D: role          — "manager" | "mentor"
 *   E: active        — "true" | "false"
 *   F: password_hash — bcrypt hash
 *
 * Behaviour
 * ─────────
 * • If a user with the same email already exists → update name, role, active, password_hash in-place.
 * • If the user does not exist → append a new row with a fresh UUID.
 * • The script is IDEMPOTENT — safe to run multiple times.
 * • Any rows NOT in the seed list are left untouched.
 *
 * Run:
 *   npm run migrate-users
 */

import * as path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { google } from 'googleapis';
import bcrypt      from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// ─── Seed data ────────────────────────────────────────────────────────────────

const PLAIN_PASSWORD = 'Test12345';
const BCRYPT_ROUNDS  = 10;

interface SeedUser {
  name:   string;
  email:  string;
  role:   'manager' | 'mentor';
  active: boolean;
}

const SEED_USERS: SeedUser[] = [
  // Manager
  { name: 'Tarique',      email: 'tarique@programming-hero.com',  role: 'manager', active: true },
  // Mentors
  { name: 'Ismail',       email: 'ismail@programming-hero.com',   role: 'mentor',  active: true },
  { name: 'Shakil',       email: 'shakil@programming-hero.com',   role: 'mentor',  active: true },
  { name: 'Tandra',       email: 'tandra@programming-hero.com',   role: 'mentor',  active: true },
  { name: 'Nahian Suba',  email: 'nahian.suba84@gmail.com',       role: 'mentor',  active: true },
  { name: 'Mousumi',      email: 'mousumi@programming-hero.com',  role: 'mentor',  active: true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;
const SHEET          = 'users';

// Column indices (0-based) matching the sheet layout
const COL = { id: 0, name: 1, email: 2, role: 3, active: 4, password_hash: 5 } as const;

// ─── Main ─────────────────────────────────────────────────────────────────────

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

  // ── 1. Hash the shared password once ──────────────────────────────────────
  console.log(`\nHashing password (bcrypt, ${BCRYPT_ROUNDS} rounds)…`);
  const passwordHash = await bcrypt.hash(PLAIN_PASSWORD, BCRYPT_ROUNDS);
  console.log('✓ Password hashed\n');

  // ── 2. Read the current users sheet ───────────────────────────────────────
  console.log(`Reading "${SHEET}" sheet…`);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: SHEET,
  });

  const allRows: string[][] = (response.data.values ?? []) as string[][];

  // Ensure header row exists
  if (allRows.length === 0) {
    console.log('  Sheet is empty — writing header row first…');
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [['id', 'name', 'email', 'role', 'active', 'password_hash']] },
    });
    allRows.push(['id', 'name', 'email', 'role', 'active', 'password_hash']);
    console.log('  ✓ Header row written\n');
  }

  const headerRow  = allRows[0];
  const dataRows   = allRows.slice(1); // rows 2..N (0-based index 1..N-1)

  console.log(`  Found ${dataRows.length} existing user row(s)\n`);

  // ── 3. Build an email → sheet-row-index map (1-based, header = row 1) ─────
  //   Sheet row 1 = header  → allRows[0]
  //   Sheet row 2 = first data row → allRows[1]  → dataRows[0]
  const emailToSheetRow = new Map<string, number>();
  dataRows.forEach((row, i) => {
    const email = (row[COL.email] ?? '').trim().toLowerCase();
    if (email) emailToSheetRow.set(email, i + 2); // +2: 1-based + skip header
  });

  // ── 4. Process each seed user ──────────────────────────────────────────────
  const updates: Array<{ range: string; values: string[][] }> = [];
  const appends: string[][]                                    = [];

  for (const user of SEED_USERS) {
    const emailKey   = user.email.toLowerCase();
    const sheetRow   = emailToSheetRow.get(emailKey);

    if (sheetRow !== undefined) {
      // ── UPDATE existing row ──────────────────────────────────────────────
      const existingRow = allRows[sheetRow - 1]; // convert to 0-based
      const existingId  = existingRow[COL.id] || uuidv4();

      const updatedRow = [
        existingId,
        user.name,
        user.email,
        user.role,
        String(user.active),
        passwordHash,
      ];

      updates.push({
        range:  `${SHEET}!A${sheetRow}:F${sheetRow}`,
        values: [updatedRow],
      });

      console.log(`  ↻  UPDATE  [row ${sheetRow}]  ${user.email}  (${user.role})`);
    } else {
      // ── APPEND new row ───────────────────────────────────────────────────
      const newRow = [
        uuidv4(),
        user.name,
        user.email,
        user.role,
        String(user.active),
        passwordHash,
      ];

      appends.push(newRow);
      console.log(`  +  INSERT          ${user.email}  (${user.role})`);
    }
  }

  // ── 5. Flush updates (batchUpdate for efficiency) ─────────────────────────
  if (updates.length > 0) {
    console.log(`\nFlushing ${updates.length} update(s)…`);
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates,
      },
    });
    console.log('✓ Updates written');
  }

  // ── 6. Flush appends ──────────────────────────────────────────────────────
  if (appends.length > 0) {
    console.log(`\nAppending ${appends.length} new row(s)…`);
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: SHEET,
      valueInputOption: 'RAW',
      requestBody: { values: appends },
    });
    console.log('✓ New rows appended');
  }

  // ── 7. Summary ────────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════');
  console.log('  Migration complete');
  console.log('══════════════════════════════════════════');
  console.log(`  Updated : ${updates.length}`);
  console.log(`  Inserted: ${appends.length}`);
  console.log(`  Password: ${PLAIN_PASSWORD}  (all accounts)`);
  console.log('══════════════════════════════════════════\n');
  console.log('⚠️  Remind users to change their passwords after first login.\n');
}

run().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
