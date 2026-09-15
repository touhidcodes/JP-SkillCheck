/**
 * GET /api/cron/weekly
 *
 * Sends each mentor a weekly summary email covering the last 7 days:
 *   - Per-student: absences, attendance %, interview count, task count, offers
 *   - Mentor totals: active, at-risk, hired, total interviews, total absences
 *
 * Auth: Bearer CRON_SECRET (same pattern as /api/cron/daily).
 * Excluded from JWT middleware via the isCronRoute check in middleware.ts.
 *
 * Trigger options:
 *   1. Direct cron schedule (e.g. Vercel cron, GitHub Actions) — call this endpoint
 *   2. Automatically on Mondays via /api/cron/daily (see daily/route.ts)
 */

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { buildWeeklyReports } from '@/lib/reports/weekly';
import { buildWeeklyEmailHtml, buildWeeklyEmailSubject } from '@/lib/reports/weekly-email';
import { timingSafeCompare } from '@/lib/security/crypto';

export const dynamic = 'force-dynamic';
// Allow up to 60 s on Vercel (Pro) / 300 s on Enterprise.
export const maxDuration = 60;

export async function GET(request: Request) {
  // --- Auth ---
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;
  if (!authHeader || !timingSafeCompare(authHeader, expectedAuth)) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { reports, week_start, week_end } = await buildWeeklyReports();

    if (reports.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No mentors found — nothing to send',
        week_start,
        week_end,
        emails_sent: 0,
      });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json({
        success: false,
        message: 'RESEND_API_KEY not configured — cannot send emails',
        week_start,
        week_end,
        emails_sent: 0,
      });
    }

    const resend = new Resend(resendApiKey);
    const emailFrom = process.env.EMAIL_FROM || 'Placement Dashboard <onboarding@resend.dev>';
    let emailsSent = 0;
    const failures: string[] = [];

    for (const report of reports) {
      try {
        await resend.emails.send({
          from: emailFrom,
          to: report.mentor_email,
          subject: buildWeeklyEmailSubject(report),
          html: buildWeeklyEmailHtml(report),
        });
        emailsSent++;
      } catch (err) {
        // Log and continue — one mentor's failure shouldn't stop the rest
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[Weekly Cron] Failed to send to ${report.mentor_email}:`, msg);
        failures.push(report.mentor_email);
      }
    }

    return NextResponse.json({
      success: true,
      week_start,
      week_end,
      mentors_found: reports.length,
      emails_sent: emailsSent,
      failures: failures.length > 0 ? failures : undefined,
      students_processed: reports.reduce((n, r) => n + r.students.length, 0),
    });
  } catch (error) {
    console.error('[Weekly Cron] Fatal error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
