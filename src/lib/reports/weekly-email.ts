/**
 * HTML email template for the weekly student report.
 *
 * Deliberately plain HTML — no external CSS frameworks, no images —
 * so it renders correctly in Gmail, Outlook, and mobile clients.
 */

import type { MentorWeeklyReport, StudentWeeklySummary } from './weekly';

// ---------------------------------------------------------------------------
// Colour helpers (inline styles only — email clients strip <style> blocks)
// ---------------------------------------------------------------------------

function stageColor(stage: StudentWeeklySummary['stage']): string {
  const map: Record<string, string> = {
    learning: '#6366f1',
    applying: '#3b82f6',
    interviewing: '#f59e0b',
    offer_pending: '#f97316',
    placed: '#10b981',
    hired: '#059669',
  };
  return map[stage] ?? '#6b7280';
}

function stageBg(stage: StudentWeeklySummary['stage']): string {
  const map: Record<string, string> = {
    learning: '#eef2ff',
    applying: '#eff6ff',
    interviewing: '#fffbeb',
    offer_pending: '#fff7ed',
    placed: '#ecfdf5',
    hired: '#d1fae5',
  };
  return map[stage] ?? '#f3f4f6';
}

function riskBadge(risk: StudentWeeklySummary['risk_status']): string {
  if (risk === 'at_risk') {
    return '<span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;">⚠ At Risk</span>';
  }
  return '<span style="background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;">✓ Safe</span>';
}

function attendanceCell(pct: number | null): string {
  if (pct === null) return '<span style="color:#9ca3af;">—</span>';
  const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#d97706' : '#dc2626';
  return `<span style="color:${color};font-weight:600;">${pct}%</span>`;
}

// ---------------------------------------------------------------------------
// Row renderer
// ---------------------------------------------------------------------------

function studentRow(s: StudentWeeklySummary, isOdd: boolean): string {
  const bg = isOdd ? '#f9fafb' : '#ffffff';
  const atRiskBg = s.risk_status === 'at_risk' ? '#fff5f5' : bg;

  return `
    <tr style="background:${atRiskBg};">
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:13px;font-weight:500;color:#111827;">
        ${s.name}
        <div style="font-size:11px;color:#6b7280;margin-top:2px;">${s.batch}</div>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">
        <span style="background:${stageBg(s.stage)};color:${stageColor(s.stage)};padding:2px 8px;border-radius:9999px;font-size:11px;font-weight:600;white-space:nowrap;">
          ${s.stage.replace('_', ' ')}
        </span>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${riskBadge(s.risk_status)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px;">
        ${s.absences_this_week > 0
          ? `<span style="color:#dc2626;font-weight:600;">${s.absences_this_week}</span>`
          : '<span style="color:#16a34a;">0</span>'}
        <div style="font-size:10px;color:#9ca3af;">${s.sessions_this_week} sessions</div>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px;">
        ${attendanceCell(s.attendance_rate_pct)}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px;font-weight:600;color:#6366f1;">
        ${s.jobs_applied_this_week}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px;font-weight:600;color:#3b82f6;">
        ${s.interviews_this_week}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px;color:#8b5cf6;">
        ${s.mock_interviews_this_week}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px;color:#6b7280;">
        ${s.tasks_this_week}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;text-align:center;font-size:13px;color:#10b981;font-weight:${s.offers_this_week > 0 ? '600' : '400'};">
        ${s.offers_this_week > 0 ? `🎉 ${s.offers_this_week}` : '0'}
      </td>
    </tr>`;
}

// ---------------------------------------------------------------------------
// Main template
// ---------------------------------------------------------------------------

export function buildWeeklyEmailHtml(report: MentorWeeklyReport): string {
  const { week_start, week_end, students, totals } = report;

  // Sort: at-risk first, then by name
  const sorted = [...students].sort((a, b) => {
    if (a.risk_status === 'at_risk' && b.risk_status !== 'at_risk') return -1;
    if (b.risk_status === 'at_risk' && a.risk_status !== 'at_risk') return 1;
    return a.name.localeCompare(b.name);
  });

  const rows = sorted.map((s, i) => studentRow(s, i % 2 === 1)).join('');

  const atRiskNames = sorted
    .filter(s => s.risk_status === 'at_risk')
    .map(s => `<li style="margin-bottom:4px;"><strong>${s.name}</strong>${s.risk_reasons ? ` — ${s.risk_reasons}` : ''}</li>`)
    .join('');

  const atRiskSection = atRiskNames
    ? `
      <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#dc2626;">⚠️ Students Needing Immediate Attention (${totals.at_risk})</p>
        <ul style="margin:0;padding-left:20px;font-size:13px;color:#374151;">${atRiskNames}</ul>
      </div>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#4f46e5;border-radius:12px 12px 0 0;padding:28px 32px;">
            <p style="margin:0;font-size:11px;font-weight:600;color:#c7d2fe;letter-spacing:0.08em;text-transform:uppercase;">Placement Dashboard</p>
            <h1 style="margin:6px 0 4px;font-size:22px;font-weight:700;color:#ffffff;">📊 Weekly Student Report</h1>
            <p style="margin:0;font-size:13px;color:#c7d2fe;">${week_start} → ${week_end}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:28px 32px;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;">

            <!-- Summary stats -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                ${[
                  { label: 'Total Students', value: totals.students, color: '#4f46e5' },
                  { label: 'Active', value: totals.active, color: '#3b82f6' },
                  { label: 'At Risk', value: totals.at_risk, color: '#dc2626' },
                  { label: 'Jobs Applied', value: totals.total_jobs_applied, color: '#6366f1' },
                  { label: 'Interviews', value: totals.total_interviews, color: '#f59e0b' },
                  { label: 'Mock Interviews', value: totals.total_mock_interviews, color: '#8b5cf6' },
                  { label: 'Absences', value: totals.total_absences, color: '#ef4444' },
                  { label: 'Offers', value: totals.total_offers, color: '#10b981' },
                ].map(stat => `
                  <td style="text-align:center;padding:12px 8px;background:#f9fafb;border-radius:8px;margin:0 4px;" width="12%">
                    <div style="font-size:20px;font-weight:700;color:${stat.color};">${stat.value}</div>
                    <div style="font-size:10px;color:#6b7280;margin-top:2px;font-weight:500;">${stat.label}</div>
                  </td>`).join('<td width="1%"></td>')}
              </tr>
            </table>

            <!-- At-risk callout -->
            ${atRiskSection}

            <!-- Student table -->
            <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#111827;">Student Breakdown</p>
            <div style="overflow-x:auto;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;font-size:12px;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;white-space:nowrap;">Student</th>
                    <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;">Stage</th>
                    <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;">Risk</th>
                    <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;">Absences</th>
                    <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;">Attend %</th>
                    <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;color:#6366f1;border-bottom:1px solid #e5e7eb;">Applied</th>
                    <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;">Interviews</th>
                    <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;color:#8b5cf6;border-bottom:1px solid #e5e7eb;">Mock</th>
                    <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;">Tasks</th>
                    <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;color:#6b7280;border-bottom:1px solid #e5e7eb;">Offers</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>

            <!-- Footer note -->
            <p style="margin:20px 0 0;font-size:12px;color:#9ca3af;text-align:center;">
              This report covers ${week_start} to ${week_end} · Generated automatically by Placement Dashboard
            </p>

          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildWeeklyEmailSubject(report: MentorWeeklyReport): string {
  const { week_start, week_end, totals } = report;
  const parts: string[] = [`${totals.students} students`];
  if (totals.at_risk > 0) parts.push(`${totals.at_risk} at risk ⚠️`);
  if (totals.total_jobs_applied > 0) parts.push(`${totals.total_jobs_applied} applied`);
  if (totals.total_interviews > 0) parts.push(`${totals.total_interviews} interviews`);
  return `📊 Weekly Report (${week_start} → ${week_end}) — ${parts.join(' · ')}`;
}
