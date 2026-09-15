/**
 * Migration: Add `project` column to the students sheet.
 *
 * The old schema had 14 columns (no project field).
 * The new schema has 15 columns with `project` at index 3.
 *
 * This script rewrites every student row to the new 15-column format,
 * inserting an empty string for the project field.
 *
 * Run once:
 *   npm run migrate-add-project
 *
 * Safe to run multiple times — it detects rows already in the new schema
 * (where col 3 is NOT an email address) and skips them.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { google } from 'googleapis';

const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID!;

async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function migrate() {
  const client = await getSheetsClient();

  // Read all rows including header
  const response = await client.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'students',
  });

  const rows = response.data.values || [];
  if (rows.length === 0) {
    console.log('No rows found in students sheet.');
    return;
  }

  const header = rows[0];
  const dataRows = rows.slice(1);

  console.log(`Found ${dataRows.length} student rows.`);

  let migrated = 0;
  let skipped = 0;

  const newRows: string[][] = [header.length >= 15
    ? header as string[]
    : ['id', 'name', 'batch', 'project', 'mentor_email', 'stage',
       'risk_status', 'risk_reasons', 'last_activity_date',
       'job_focus', 'terminated', 'hired', 'experience',
       'created_at', 'updated_at']
  ];

  for (const row of dataRows) {
    // Detect old schema: col 3 contains an email (mentor_email was at col 3)
    const isOldSchema = row.length < 15 && row[3]?.includes('@');

    if (isOldSchema) {
      // Insert empty project at col 3, shifting everything right
      const newRow = [
        row[0] || '',  // id
        row[1] || '',  // name
        row[2] || '',  // batch
        '',            // project (new — empty)
        row[3] || '',  // mentor_email (was col 3, now col 4)
        row[4] || '',  // stage
        row[5] || '',  // risk_status
        row[6] || '',  // risk_reasons
        row[7] || '',  // last_activity_date
        row[8] || '',  // job_focus
        row[9] || '',  // terminated
        row[10] || '', // hired
        row[11] || '', // experience
        row[12] || '', // created_at
        row[13] || '', // updated_at
      ];
      newRows.push(newRow);
      migrated++;
    } else {
      // Already new schema or empty row — keep as-is, pad to 15 cols
      const padded = [...row];
      while (padded.length < 15) padded.push('');
      newRows.push(padded);
      skipped++;
    }
  }

  // Write all rows back
  await client.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'students!A1',
    valueInputOption: 'RAW',
    requestBody: { values: newRows },
  });

  console.log(`✅ Migration complete: ${migrated} rows migrated, ${skipped} rows already up-to-date.`);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
