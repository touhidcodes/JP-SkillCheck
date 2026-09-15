/**
 * VERIFICATION SCRIPT: 001_initial_schema_setup
 *
 * Verifies that the migration created all required sheets and columns.
 * Run this AFTER migration to confirm data integrity.
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

const { google } = require('googleapis');
const auth = new google.auth.GoogleAuth({
  credentials: GOOGLE_SERVICE_ACCOUNT,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const sheets = google.sheets({ version: 'v4', auth });

async function readSheetRange(title) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${title}!1:1`
  });
  return response.data.values?.[0] || [];
}

async function countRows(title) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: title
  });
  return (response.data.values || []).length - 1;
}

const SHEETS = {
  warnings: ['id', 'student_id', 'student_name', 'mentor_email', 'severity', 'reason', 'evidence_notes', 'status', 'created_at', 'created_by', 'resolved_at', 'resolved_by', 'resolution_notes'],
  stage_history: ['id', 'student_id', 'from_stage', 'to_stage', 'transitioned_at', 'triggered_by', 'note'],
  escalations: ['id', 'student_id', 'channel', 'message_id', 'raised_at', 'mentor_email', 'acknowledged_at', 'escalated_at', 'resolved_at', 'status', 'severity', 'description'],
  companies: ['id', 'canonical_name', 'industry', 'size_range', 'location', 'contact_name', 'contact_email', 'hiring_status', 'notes', 'added_at', 'added_by'],
  discord_events: ['id', 'message_id', 'user_id', 'username', 'channel_id', 'event_type', 'student_id', 'posted_at', 'payload'],
  analytics_events: ['id', 'event_type', 'actor_email', 'actor_role', 'student_id', 'student_name', 'created_at', 'payload'],
  audit_log: ['id', 'actor_id', 'actor_email', 'actor_role', 'action', 'target_type', 'target_id', 'metadata_json', 'ip_address', 'user_agent', 'created_at'],
  error_log: ['id', 'route', 'error_message', 'stack_trace', 'user_id', 'created_at'],
  daily_metrics: ['date', 'total_students', 'active_students', 'at_risk_count', 'placed_count', 'hired_count', 'total_interviews', 'total_applications', 'avg_attendance_rate', 'mentors_active', 'computed_at'],
  discord_students_map: ['id', 'discord_user_id', 'student_id', 'student_name', 'email', 'created_at']
};

async function verify() {
  console.log('\n=== VERIFICATION: 001_initial_schema_setup ===\n');
  console.log(`Spreadsheet: ${SPREADSHEET_ID}\n`);

  let passed = 0;
  let failed = 0;

  for (const [sheetName, expectedHeaders] of Object.entries(SHEETS)) {
    try {
      const actualHeaders = await readSheetRange(sheetName);
      const missing = expectedHeaders.filter(h => !actualHeaders.includes(h));

      if (missing.length === 0) {
        const rowCount = await countRows(sheetName);
        console.log(`  ✓ ${sheetName}: OK (${rowCount} data rows)`);
        passed++;
      } else {
        console.log(`  ✗ ${sheetName}: Missing columns: ${missing.join(', ')}`);
        failed++;
      }
    } catch (error) {
      console.log(`  ✗ ${sheetName}: Sheet not found or error reading (${error.message})`);
      failed++;
    }
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);

  if (failed > 0) {
    console.log('Some checks failed. Review the output above and re-run migration if needed.');
    process.exit(1);
  } else {
    console.log('All checks passed! Migration verified successfully.');
  }
}

verify().catch(err => {
  console.error('Verification script error:', err.message || err);
  process.exit(1);
});
