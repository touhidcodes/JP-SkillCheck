/**
 * GET /api/health
 *
 * Public health check endpoint for Vercel monitoring / UptimeRobot.
 *
 * WHY /api/health MUST BE PUBLIC (NO AUTH):
 * ==========================================
 * 1. Monitoring tools (UptimeRobot, Pingdom) make unauthenticated GET requests
 * 2. If /api/health requires auth, monitoring can't detect actual API failures
 * 3. The purpose is to verify the application is running — auth is the
 *    responsibility of the monitored endpoints themselves
 *
 * WHAT /api/health SHOULD NOT EXPOSE:
 * ==================================
 * - Version numbers (information leakage for attackers)
 * - Stack traces (debug info)
 * - Internal data counts (user count, student count —侦察)
 * - Detailed error messages
 * - Commit hashes, branch names
 *
 * This endpoint intentionally returns minimal status info to aid monitoring
 * without aiding attackers in reconnaissance.
 */

import { NextResponse } from 'next/server';
import { readSheet } from '@/lib/sheets/client';

const START_TIME = Date.now();

export async function GET() {
  const uptimeMs = Date.now() - START_TIME;

  let sheetsReachable = false;
  let lastCronRun = 'unknown';

  try {
    const meta = await readSheet('students');
    sheetsReachable = meta.length > 0 || true;
  } catch {
    sheetsReachable = false;
  }

  try {
    const cronRows = await readSheet('cron_log');
    if (cronRows.length > 1) {
      const lastRow = cronRows[cronRows.length - 1];
      lastCronRun = lastRow[cronRows[0].length - 1] || 'unknown';
    }
  } catch {
    lastCronRun = 'unknown';
  }

  const isHealthy = sheetsReachable;

  return NextResponse.json({
    status: isHealthy ? 'ok' : 'degraded',
    sheets_reachable: sheetsReachable,
    last_cron_run: lastCronRun,
    uptime_seconds: Math.floor(uptimeMs / 1000),
  }, {
    status: isHealthy ? 200 : 503,
  });
}