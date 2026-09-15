/**
 * Migration: migrate-normalize-stages
 *
 * Scans every row in the `students` sheet and rewrites any invalid `stage`
 * value to the closest valid StudentStage so the dashboard counts are correct.
 *
 * Valid stages: learning | applying | interviewing | offer_pending | placed | hired
 *
 * Legacy → valid mapping applied:
 *   beginner     → learning
 *   intermediate → applying
 *   advanced     → interviewing
 *   bogliner     → learning   (typo seen in sheet)
 *   boginner     → learning   (typo variant)
 *   (anything else unknown) → learning
 *
 * The script is IDEMPOTENT — safe to run multiple times.
 * It only writes rows that actually need a change.
 *
 * Run:
 *   npm run migrate-normalize-stages
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
const STAGE_COL_INDEX = 4; // 0-based — column E

const VALID_STAGES = new Set([
  'learning', 'applying', 'interviewing', 'offer_pending', 'placed', 'hired',
]);

const STAGE_MAP: Record<string, string> = {
  beginner:       'learning',
  intermediate:   'applying',
  advanced:       'interviewing',
  bogliner:       'learning',
  boginner:       'learning',
  learn:          'learning',
  apply:          'applying',
  applied:        'applying',
  interview:      'interviewing',
  interviewed:    'interviewing',
  offer:          'offer_pending',
  'offer pending':'offer_pending',
  place:          'placed',
  hire:           'hired',
};

function normalizeStage(raw: string): string {
  const s = (raw || '').toLowerCase().trim();
  if (VALID_STAGES.has(s)) return s;
  if (STAGE_MAP[s]) return STAGE_MAP[s];
  if (s.startsWith('learn'))     return 'learning';
  if (s.startsWith('apply') || s.startsWith('appli')) return 'applying';
  if (s.startsWith('interview')) return 'interviewing';
  if (s.startsWith('offer'))     return 'offer_pending';
  if (s.startsWith('place'))     return 'placed';
  if (s.startsWith('hire'))      return 'hired';
  return 'learning';
}

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
  if (rows.length <= 1) {
    console.log('⚠️  No data rows found. Nothing to migrate.');
    return;
  }

  const header = rows[0];
  const stageColIdx = header.indexOf('stage');
  const effectiveIdx = stageColIdx !== -1 ? stageColIdx : STAGE_COL_INDEX;

  console.log(`Stage column is at index ${effectiveIdx} (col ${String.fromCharCode(65 + effectiveIdx)})\n`);

  const updates: { range: string; value: string; from: string }[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const raw = row[effectiveIdx] || '';
    const normalized = normalizeStage(raw);

    if (raw !== normalized) {
      // Sheet row is 1-based, +1 for header row
      const sheetRow = i + 1;
      const colLetter = String.fromCharCode(65 + effectiveIdx);
      updates.push({
        range: `${SHEET}!${colLetter}${sheetRow}`,
        value: normalized,
        from: raw,
      });
    }
  }

  if (updates.length === 0) {
    console.log('✅  All stage values are already valid. Nothing to update.');
    return;
  }

  console.log(`Found ${updates.length} row(s) with invalid stage values:\n`);
  updates.forEach(u => console.log(`  ${u.range}: "${u.from}" → "${u.value}"`));
  console.log('');

  // Batch update all cells at once
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: updates.map(u => ({
        range: u.range,
        values: [[u.value]],
      })),
    },
  });

  console.log(`✅  Migration complete — ${updates.length} stage value(s) normalized.`);
  console.log('\nRestart your dev server and refresh the dashboard to see correct counts.');
}

run().catch((err) => {
  console.error('❌  Migration failed:', err);
  process.exit(1);
});
