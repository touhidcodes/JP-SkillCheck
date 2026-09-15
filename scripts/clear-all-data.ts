/**
 * clear-all-data.ts
 *
 * Clears all data rows (preserving header rows) from every sheet
 * EXCEPT the `users` sheet. User accounts are never touched.
 *
 * Run with:
 *   npx ts-node --project tsconfig.json -e "require('dotenv').config({ path: '.env.local' })" scripts/clear-all-data.ts
 *
 * Or via the npm script:
 *   npm run clear-data
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { google, sheets_v4 } from 'googleapis';

// Load .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SERVICE_ACCOUNT_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

if (!SPREADSHEET_ID) {
  console.error('❌  GOOGLE_SPREADSHEET_ID is not set in .env.local');
  process.exit(1);
}
if (!SERVICE_ACCOUNT_JSON) {
  console.error('❌  GOOGLE_SERVICE_ACCOUNT_JSON is not set in .env.local');
  process.exit(1);
}

// All sheets that should be cleared (users is intentionally excluded)
const SHEETS_TO_CLEAR = [
  'students',
  'attendance_logs',
  'progress_logs',
  'notifications',
  'risk_history',
  'mentor_tasks',
  'companies',
  'warnings',
  'stage_history',
  'audit_log',
  'analytics_events',
  'daily_metrics',
  'error_log',
  'escalations',
  'cohorts',
  'mentor_assignments',
  'company_aliases',
  'sheet_indexes',
  'schema_migrations',
  'attendance_sessions',
  'attendance_statuses',
  'attendance_filter_presets',
  'student_upload_batches',
  'report_deliveries',
  'schema_constraints',
  'data_quality_checks',
];

async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  const credentials = JSON.parse(SERVICE_ACCOUNT_JSON!);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function getSheetMetadata(
  client: sheets_v4.Sheets
): Promise<Map<string, number>> {
  const meta = await client.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID! });
  const map = new Map<string, number>();
  for (const sheet of meta.data.sheets ?? []) {
    const title = sheet.properties?.title ?? null;
    const sheetId = sheet.properties?.sheetId ?? null;
    if (title !== null && sheetId !== null) {
      map.set(title, sheetId);
    }
  }
  return map;
}

async function getRowCount(
  client: sheets_v4.Sheets,
  sheetName: string
): Promise<number> {
  const res = await client.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID!,
    range: sheetName,
  });
  return (res.data.values ?? []).length;
}

async function clearSheetData(
  client: sheets_v4.Sheets,
  sheetName: string,
  sheetId: number
): Promise<{ cleared: number }> {
  const totalRows = await getRowCount(client, sheetName);

  // Row 0 = header, rows 1+ = data. If only header (or empty), nothing to do.
  if (totalRows <= 1) {
    return { cleared: 0 };
  }

  const dataRowCount = totalRows - 1; // rows after the header

  try {
    // Preferred: delete all data rows in one batchUpdate call.
    // startIndex=1 skips the header (0-indexed), endIndex=totalRows covers all data rows.
    await client.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID!,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: 1,       // 0-indexed: row index 1 = second row (first data row)
                endIndex: totalRows, // exclusive upper bound = delete up to and including last row
              },
            },
          },
        ],
      },
    });
  } catch (err) {
    const msg = (err as Error).message ?? '';
    // Google Sheets won't let you delete ALL non-frozen rows.
    // Fall back to clearing (overwriting with empty strings) instead.
    if (msg.includes('not possible to delete all non-frozen rows')) {
      await client.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID!,
        range: `${sheetName}!2:${totalRows + 100}`, // clear well past the last row
      });
    } else {
      throw err;
    }
  }

  return { cleared: dataRowCount };
}

async function main() {
  console.log('🗑️  Starting data clear — users sheet will NOT be touched.\n');

  const client = await getSheetsClient();
  const sheetMeta = await getSheetMetadata(client);

  let totalCleared = 0;
  const skipped: string[] = [];
  const notFound: string[] = [];

  for (const sheetName of SHEETS_TO_CLEAR) {
    const sheetId = sheetMeta.get(sheetName);

    if (sheetId === undefined) {
      notFound.push(sheetName);
      console.log(`  ⚠️  ${sheetName} — sheet not found in spreadsheet, skipping`);
      continue;
    }

    try {
      const { cleared } = await clearSheetData(client, sheetName, sheetId);
      if (cleared === 0) {
        skipped.push(sheetName);
        console.log(`  ✅  ${sheetName} — already empty`);
      } else {
        totalCleared += cleared;
        console.log(`  🗑️  ${sheetName} — cleared ${cleared} row${cleared !== 1 ? 's' : ''}`);
      }
    } catch (err) {
      console.error(`  ❌  ${sheetName} — error:`, (err as Error).message);
    }

    // Small delay to avoid hitting Sheets API rate limits (300 req/min)
    await new Promise((r) => setTimeout(r, 200));
  }

  console.log('\n─────────────────────────────────────────');
  console.log(`✅  Done. ${totalCleared} total data rows removed.`);
  if (notFound.length > 0) {
    console.log(`⚠️  Sheets not found (may not exist yet): ${notFound.join(', ')}`);
  }
  console.log('🔒  users sheet was NOT modified.');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
