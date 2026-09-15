/**
 * MIGRATION: 001_initial_schema_setup
 *
 * Purpose: Creates all foundational sheets for the L2 Placement Hub
 * Date: 2026-05-11
 *
 * This migration creates the following sheets:
 * 1. warnings         - Structured student warning system
 * 2. stage_history   - Immutable event log of stage transitions
 * 3. escalations     - Discord issue/emergency escalations with SLA tracking
 * 4. companies       - Canonical company entity for analytics
 * 5. discord_events  - Append-only log of all Discord events
 * 6. analytics_events - Mentor activity event log
 * 7. audit_log       - Security audit trail (append-only, never delete)
 * 8. error_log        - Application error tracking
 * 9. daily_metrics    - Pre-computed daily snapshot metrics
 * 10. discord_students_map - Discord user ID to student ID mapping
 *
 * Sheets that should ALREADY EXIST (from previous iterations):
 * - students         - Core student records
 * - progress_logs    - Activity tracking
 * - attendance_logs  - Daily attendance
 * - notifications    - In-app notifications
 * - mentor_tasks      - Task assignments
 * - users            - Authentication
 * - risk_history     - Risk scoring history
 * - cron_log          - Cron job execution history
 *
 * REVERSIBILITY: This migration is forward-only. New sheets with headers are
 * created. Existing data is not modified. To rollback, sheets must be deleted
 * manually (Google Sheets API doesn't support DROP TABLE equivalent).
 *
 * IMPORTANT: Run this with a service account that has Editor permission on the
 * spreadsheet. All new sheets will be created at the end of the spreadsheet.
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

const sheets = (() => {
  const { google } = require('googleapis');
  const auth = new google.auth.GoogleAuth({
    credentials: GOOGLE_SERVICE_ACCOUNT,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
})();

async function sheetExists(title) {
  try {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    return meta.data.sheets?.some(s => s.properties.title === title) || false;
  } catch { return false; }
}

async function createSheet(title, headers) {
  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          addSheet: {
            properties: { title }
          }
        }]
      }
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${title}!A1:1`,
      valueInputOption: 'RAW',
      requestBody: { values: [headers] }
    });

    console.log(`  ✓ Created sheet: ${title}`);
    return true;
  } catch (error) {
    if (error.message?.includes('already exists')) {
      console.log(`  ○ Sheet already exists: ${title}`);
      return false;
    }
    throw error;
  }
}

async function ensureColumn(sheetTitle, headerRow, newColumns) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetTitle}!1:1`
  });

  const existingHeaders = response.data.values?.[0] || [];
  const existingSet = new Set(existingHeaders.map(h => h.trim()));

  const headersToAdd = newColumns.filter(col => !existingSet.has(col));
  if (headersToAdd.length === 0) {
    console.log(`    No new columns needed in ${sheetTitle}`);
    return;
  }

  const allHeaders = [...existingHeaders, ...headersToAdd];
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetTitle}!A1:1`,
    valueInputOption: 'RAW',
    requestBody: { values: [allHeaders] }
  });

  console.log(`    Added columns to ${sheetTitle}: ${headersToAdd.join(', ')}`);
}

async function migrate() {
  console.log('\n=== MIGRATION 001: Initial Schema Setup ===\n');
  console.log(`Spreadsheet: ${SPREADSHEET_ID}\n`);

  const CREATED = [];
  const SKIPPED = [];

  // ── 1. WARNINGS ──────────────────────────────────────────────────────────
  console.log('[1/10] Creating warnings sheet...');
  if (!await sheetExists('warnings')) {
    await createSheet('warnings', [
      'id', 'student_id', 'student_name', 'mentor_email', 'severity',
      'reason', 'evidence_notes', 'status', 'created_at', 'created_by',
      'resolved_at', 'resolved_by', 'resolution_notes'
    ]);
    CREATED.push('warnings');
  } else {
    await ensureColumn('warnings', 1, ['resolved_at', 'resolved_by', 'resolution_notes']);
    SKIPPED.push('warnings');
  }

  // ── 2. STAGE_HISTORY ─────────────────────────────────────────────────────
  console.log('[2/10] Creating stage_history sheet...');
  if (!await sheetExists('stage_history')) {
    await createSheet('stage_history', [
      'id', 'student_id', 'from_stage', 'to_stage',
      'transitioned_at', 'triggered_by', 'note'
    ]);
    CREATED.push('stage_history');
  } else {
    SKIPPED.push('stage_history');
  }

  // ── 3. ESCALATIONS ───────────────────────────────────────────────────────
  console.log('[3/10] Creating escalations sheet...');
  if (!await sheetExists('escalations')) {
    await createSheet('escalations', [
      'id', 'student_id', 'channel', 'message_id', 'raised_at',
      'mentor_email', 'acknowledged_at', 'escalated_at', 'resolved_at',
      'status', 'severity', 'description'
    ]);
    CREATED.push('escalations');
  } else {
    await ensureColumn('escalations', 1, ['description']);
    SKIPPED.push('escalations');
  }

  // ── 4. COMPANIES ─────────────────────────────────────────────────────────
  console.log('[4/10] Creating companies sheet...');
  if (!await sheetExists('companies')) {
    await createSheet('companies', [
      'id', 'canonical_name', 'industry', 'size_range', 'location',
      'contact_name', 'contact_email', 'hiring_status', 'notes',
      'added_at', 'added_by'
    ]);
    CREATED.push('companies');
  } else {
    SKIPPED.push('companies');
  }

  // ── 5. DISCORD_EVENTS ─────────────────────────────────────────────────────
  console.log('[5/10] Creating discord_events sheet...');
  if (!await sheetExists('discord_events')) {
    await createSheet('discord_events', [
      'id', 'message_id', 'user_id', 'username', 'channel_id',
      'event_type', 'student_id', 'posted_at', 'payload'
    ]);
    CREATED.push('discord_events');
  } else {
    SKIPPED.push('discord_events');
  }

  // ── 6. ANALYTICS_EVENTS ──────────────────────────────────────────────────
  console.log('[6/10] Creating analytics_events sheet...');
  if (!await sheetExists('analytics_events')) {
    await createSheet('analytics_events', [
      'id', 'event_type', 'actor_email', 'actor_role',
      'student_id', 'student_name', 'created_at', 'payload'
    ]);
    CREATED.push('analytics_events');
  } else {
    SKIPPED.push('analytics_events');
  }

  // ── 7. AUDIT_LOG ─────────────────────────────────────────────────────────
  console.log('[7/10] Creating audit_log sheet...');
  if (!await sheetExists('audit_log')) {
    await createSheet('audit_log', [
      'id', 'actor_id', 'actor_email', 'actor_role', 'action',
      'target_type', 'target_id', 'metadata_json', 'ip_address',
      'user_agent', 'created_at'
    ]);
    CREATED.push('audit_log');
  } else {
    SKIPPED.push('audit_log');
  }

  // ── 8. ERROR_LOG ─────────────────────────────────────────────────────────
  console.log('[8/10] Creating error_log sheet...');
  if (!await sheetExists('error_log')) {
    await createSheet('error_log', [
      'id', 'route', 'error_message', 'stack_trace', 'user_id', 'created_at'
    ]);
    CREATED.push('error_log');
  } else {
    SKIPPED.push('error_log');
  }

  // ── 9. DAILY_METRICS ─────────────────────────────────────────────────────
  console.log('[9/10] Creating daily_metrics sheet...');
  if (!await sheetExists('daily_metrics')) {
    await createSheet('daily_metrics', [
      'date', 'total_students', 'active_students', 'at_risk_count',
      'placed_count', 'hired_count', 'total_interviews', 'total_applications',
      'avg_attendance_rate', 'mentors_active', 'computed_at'
    ]);
    CREATED.push('daily_metrics');
  } else {
    SKIPPED.push('daily_metrics');
  }

  // ── 10. DISCORD_STUDENTS_MAP ─────────────────────────────────────────────
  console.log('[10/10] Creating discord_students_map sheet...');
  if (!await sheetExists('discord_students_map')) {
    await createSheet('discord_students_map', [
      'id', 'discord_user_id', 'student_id', 'student_name', 'email', 'created_at'
    ]);
    CREATED.push('discord_students_map');
  } else {
    SKIPPED.push('discord_students_map');
  }

  console.log('\n=== Migration Complete ===\n');
  console.log(`Created: ${CREATED.join(', ') || 'none'}`);
  console.log(`Skipped (already exist): ${SKIPPED.join(', ') || 'none'}`);
  console.log('\nNext steps:');
  console.log('1. Verify all sheets have correct headers by reading row 1 of each');
  console.log('2. Run: node scripts/verify-migration.js');
  console.log('3. Add any sample data if needed\n');
}

migrate().catch(err => {
  console.error('\n!!! Migration failed !!!');
  console.error(err.message || err);
  process.exit(1);
});