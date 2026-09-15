/**
 * GET /api/cron/daily
 *
 * Runs every day via an external cron scheduler (Vercel Cron, GitHub Actions, etc.).
 *
 * Steps:
 *   1. Risk scan  — evaluates all students, updates risk_status, sends in-app notifications
 *   2. Risk emails — sends a formatted email to each mentor listing their at-risk students
 *   3. Absent emails — sends absence notice / show-cause to students absent today
 *   4. Weekly report — triggered automatically every Monday
 *
 * Auth: Bearer CRON_SECRET header (excluded from JWT middleware).
 *
 * Returns a JSON summary of every action taken so the cron scheduler can
 * log the result and alert on failures.
 */

import { NextResponse } from 'next/server';
import { runRiskScan }  from '@/lib/risk/engine';
import { getAllStudents } from '@/lib/sheets/students';
import { readSheet }    from '@/lib/sheets/client';
import { Resend }       from 'resend';
import { format }       from 'date-fns';
import { timingSafeCompare } from '@/lib/security/crypto';
import { sanitizeForHtml }   from '@/lib/security/sanitize';

// ---------------------------------------------------------------------------
// Email builders
// ---------------------------------------------------------------------------

/**
 * Formatted risk alert email sent to each mentor after the daily scan.
 * Lists all their at-risk students with readable reasons.
 */
function buildRiskAlertEmailHtml(
  mentorEmail: string,
  students: { name: string; reasons: string; probability: number }[],
  date: string
): string {
  const rows = students.map(s => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:500;color:#111827;">
        ${sanitizeForHtml(s.name)}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;">
        ${sanitizeForHtml(s.reasons || 'No specific reason recorded')}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;text-align:center;">
        <span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;">
          ${Math.round(s.probability * 100)}%
        </span>
      </td>
    </tr>`).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <tr>
          <td style="background:#dc2626;border-radius:12px 12px 0 0;padding:24px 32px;">
            <p style="margin:0;font-size:11px;font-weight:600;color:#fecaca;letter-spacing:0.08em;text-transform:uppercase;">
              Placement Dashboard — Daily Risk Alert
            </p>
            <h1 style="margin:6px 0 0;font-size:20px;font-weight:700;color:#ffffff;">
              ⚠️ ${students.length} Student${students.length !== 1 ? 's' : ''} Need${students.length === 1 ? 's' : ''} Attention
            </h1>
            <p style="margin:6px 0 0;font-size:13px;color:#fecaca;">${date}</p>
          </td>
        </tr>

        <tr>
          <td style="background:#ffffff;padding:28px 32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;">

            <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">
              The following students have been flagged as <strong>at risk</strong> by the daily scan.
              Please review each student and take action before the next session.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;">Student</th>
                  <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;">Risk Reasons</th>
                  <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;">Risk %</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>

            <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
              Placement Dashboard · Daily Risk Scan · ${date}
            </p>

          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Absence notice sent directly to the student (or their mentor if no student email).
 * First absence: extra task assigned.
 * Repeat absences (2+): show cause notice added.
 */
function buildAbsentEmailHtml(studentName: string, date: string, totalAbsences: number): string {
  const isRepeat = totalAbsences >= 2;
  const safeName = sanitizeForHtml(studentName);
  const ordinal  = totalAbsences === 2 ? '2nd' : totalAbsences === 3 ? '3rd' : `${totalAbsences}th`;

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <tr>
          <td style="background:${isRepeat ? '#dc2626' : '#f59e0b'};border-radius:12px 12px 0 0;padding:24px 32px;">
            <p style="margin:0;font-size:11px;font-weight:600;color:${isRepeat ? '#fecaca' : '#fef3c7'};letter-spacing:0.08em;text-transform:uppercase;">
              Placement Dashboard — Attendance Notice
            </p>
            <h1 style="margin:6px 0 0;font-size:20px;font-weight:700;color:#ffffff;">
              ${isRepeat ? 'Show Cause Notice' : 'Absence Notice + Extra Task'}
            </h1>
          </td>
        </tr>

        <tr>
          <td style="background:#ffffff;padding:28px 32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;">

            <p style="margin:0 0 16px;font-size:15px;color:#111827;">
              Dear <strong>${safeName}</strong>,
            </p>

            <p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.6;">
              You were marked <strong>absent</strong> from today's session on <strong>${date}</strong>.
              ${totalAbsences > 1 ? `This is your <strong>${ordinal} absence</strong>.` : ''}
            </p>

            ${isRepeat ? `
            <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
              <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#dc2626;">📌 Show Cause Notice</p>
              <p style="margin:0;font-size:13px;color:#374151;line-height:1.6;">
                You are required to submit a written explanation for your repeated absences within
                <strong>24 hours</strong>. Please reply to this email or contact your mentor directly.
                Failure to respond may result in further action as per the bootcamp policy.
              </p>
            </div>` : ''}

            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin-bottom:20px;">
              <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#1d4ed8;">📚 Extra Task (Due Tomorrow)</p>
              <p style="margin:0 0 12px;font-size:13px;color:#374151;line-height:1.6;">
                To make up for today's missed session, please complete the following by tomorrow:
              </p>
              <ol style="margin:0;padding-left:20px;font-size:13px;color:#374151;line-height:1.8;">
                <li>Review today's session material and write a 200-word summary</li>
                <li>Apply to at least <strong>2 jobs</strong> and log them in the dashboard</li>
                <li>Update your LinkedIn profile with any recent projects or skills</li>
              </ol>
            </div>

            <p style="margin:0 0 8px;font-size:13px;color:#6b7280;line-height:1.6;">
              If you had a valid reason for today's absence (exam, illness, emergency), please
              inform your mentor immediately so it can be recorded as excused.
            </p>

            <p style="margin:16px 0 0;font-size:13px;color:#374151;">
              Best regards,<br/>
              <strong>Placement Team</strong>
            </p>

          </td>
        </tr>

        <tr>
          <td style="padding:16px 0;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              Placement Dashboard — Automated Attendance Notice · ${date}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Cron handler
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic';
// Allow up to 60 s on Vercel (Pro) / 300 s on Enterprise.
// Hobby plan is capped at 60 s — set to 60 to be safe.
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const authHeader  = request.headers.get('authorization');
    const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

    if (!authHeader || !timingSafeCompare(authHeader, expectedAuth)) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.warn('[Daily Cron] RESEND_API_KEY not set — skipping email notifications');
    }
    const resend = resendApiKey ? new Resend(resendApiKey) : null;
    const emailFrom = process.env.EMAIL_FROM || 'Placement Dashboard <onboarding@resend.dev>';
    const today  = format(new Date(), 'yyyy-MM-dd');

    // ── Step 1: Risk scan ───────────────────────────────────────────────────
    // runRiskScan reads all sheets internally — do NOT re-read students after this
    const riskResult = await runRiskScan();

    // ── Step 2: Risk alert emails to mentors ────────────────────────────────
    // Re-read students once to get current at-risk list with reasons + probability
    const allStudents    = await getAllStudents();
    const atRiskStudents = allStudents.filter(s => s.risk_status === 'at_risk' && !s.terminated && !s.hired);

    // Group at-risk students by mentor
    const mentorGroups = new Map<string, { name: string; reasons: string; probability: number }[]>();
    for (const student of atRiskStudents) {
      const list = mentorGroups.get(student.mentor_email) ?? [];
      list.push({
        name:        student.name,
        reasons:     student.risk_reasons,
        probability: student.risk_probability ?? 0,
      });
      mentorGroups.set(student.mentor_email, list);
    }

    let riskEmailsSent = 0;
    const riskEmailFailures: string[] = [];

    for (const [mentorEmail, students] of Array.from(mentorGroups.entries())) {
      if (!resend) {
        console.warn(`[Daily Cron] Skipping risk email to ${mentorEmail} — no Resend client`);
        continue;
      }
      try {
        await resend.emails.send({
          from:    emailFrom,
          to:      mentorEmail,
          subject: `⚠️ Daily Risk Alert — ${students.length} Student${students.length !== 1 ? 's' : ''} Need Attention (${today})`,
          html:    buildRiskAlertEmailHtml(mentorEmail, students, today),
        });
        riskEmailsSent++;
      } catch (err) {
        console.error(`[Daily Cron] Failed to send risk alert to ${mentorEmail}:`, err);
        riskEmailFailures.push(mentorEmail);
      }
    }

    // ── Step 3: Absent student emails ───────────────────────────────────────
    const attendanceRows = await readSheet('attendance_logs');

    // Collect student IDs absent today (unexcused only)
    const todayAbsentIds = new Set<string>();
    for (const row of attendanceRows) {
      const studentId = row[1] || '';
      const date      = row[2] || '';
      const present   = row[3] === 'true';
      const excuse    = row[6] || '';
      if (date === today && !present && !excuse && studentId) {
        todayAbsentIds.add(studentId);
      }
    }

    // Count total unexcused absences per student (for show-cause threshold)
    const totalAbsencesByStudent = new Map<string, number>();
    for (const row of attendanceRows) {
      const studentId = row[1] || '';
      const present   = row[3] === 'true';
      const excuse    = row[6] || '';
      if (!present && !excuse && studentId) {
        totalAbsencesByStudent.set(studentId, (totalAbsencesByStudent.get(studentId) ?? 0) + 1);
      }
    }

    // Build a lookup map from the already-fetched students list
    const studentById = new Map(allStudents.map(s => [s.id, s]));

    let absentEmailsSent = 0;
    const absentEmailFailures: string[] = [];

    for (const studentId of Array.from(todayAbsentIds)) {
      const student = studentById.get(studentId);
      if (!student || student.terminated || student.hired) continue;

      const recipientEmail = student.student_email || student.mentor_email;
      const totalAbsences  = totalAbsencesByStudent.get(studentId) ?? 1;

      const subject = totalAbsences >= 2
        ? `⚠️ Show Cause Notice — ${student.name} (${totalAbsences} absences)`
        : `📋 Absence Notice + Extra Task — ${student.name}`;

      try {
        if (!resend) {
          console.warn(`[Daily Cron] Skipping absent email for ${student.name} — no Resend client`);
          continue;
        }
        await resend.emails.send({
          from:    emailFrom,
          to:      recipientEmail,
          // CC mentor when email goes directly to student
          ...(student.student_email ? { cc: student.mentor_email } : {}),
          subject,
          html:    buildAbsentEmailHtml(student.name, today, totalAbsences),
        });
        absentEmailsSent++;
      } catch (err) {
        console.error(`[Daily Cron] Failed to send absent email for ${student.name} (${recipientEmail}):`, err);
        absentEmailFailures.push(student.name);
      }
    }

    // ── Step 4: Weekly report — Mondays only ────────────────────────────────
    let weeklyResult: Record<string, unknown> | null = null;
    const isMonday = new Date().getDay() === 1;

    if (isMonday) {
      try {
        const appUrl   = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const weeklyRes = await fetch(`${appUrl}/api/cron/weekly`, {
          headers: { authorization: expectedAuth },
        });
        weeklyResult = await weeklyRes.json() as Record<string, unknown>;
      } catch (err) {
        console.error('[Daily Cron] Failed to trigger weekly report:', err);
        weeklyResult = { error: 'Weekly report trigger failed' };
      }
    }

    // ── Response ────────────────────────────────────────────────────────────
    return NextResponse.json({
      success: true,
      date:    today,
      risk_scan: {
        updated:            riskResult.updated,
        newly_at_risk:      riskResult.newly_at_risk,
        newly_resolved:     riskResult.newly_resolved,
        band_updated:       riskResult.band_updated.length,
        skipped_terminated: riskResult.skipped_terminated,
      },
      risk_emails: {
        sent:     riskEmailsSent,
        failures: riskEmailFailures.length > 0 ? riskEmailFailures : undefined,
      },
      absent_emails: {
        students_absent_today: todayAbsentIds.size,
        sent:                  absentEmailsSent,
        failures:              absentEmailFailures.length > 0 ? absentEmailFailures : undefined,
      },
      ...(isMonday && { weekly_report: weeklyResult }),
    });

  } catch (error) {
    console.error('[Daily Cron] Fatal error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
