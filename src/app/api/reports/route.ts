/**
 * GET /api/reports
 *
 * Generates and streams an Excel (.xlsx) report.
 *
 * Query params:
 *   type    'placement_summary' | 'at_risk' | 'monthly_hired'
 *   month   YYYY-MM  (only for monthly_hired, defaults to current month)
 *   batch   string   (optional filter)
 *
 * Auth: admin or placement role only.
 */

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getAllStudents } from '@/lib/sheets/students';
import { requireRole } from '@/lib/auth/helpers';
import type { ApiError } from '@/lib/auth/helpers';
import { format } from 'date-fns';

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'status' in e;
}

function currentMonth(): string {
  return format(new Date(), 'yyyy-MM');
}

export async function GET(request: Request) {
  try {
    requireRole(request.headers, ['manager']);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') ?? 'placement_summary';
    const month = searchParams.get('month') ?? currentMonth();
    const batchFilter = searchParams.get('batch') ?? '';

    const allStudents = await getAllStudents();
    const students = batchFilter
      ? allStudents.filter(s => s.batch.toLowerCase().includes(batchFilter.toLowerCase()))
      : allStudents;

    const wb = XLSX.utils.book_new();
    let filename = `report-${type}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

    // ── Placement Summary ─────────────────────────────────────────────────
    if (type === 'placement_summary') {
      // Sheet 1: Batch overview
      const batches = Array.from(new Set(students.map(s => s.batch))).sort();
      const overviewRows = batches.map(batch => {
        const bs = students.filter(s => s.batch === batch);
        return {
          Batch: batch,
          Total: bs.length,
          Learning: bs.filter(s => s.stage === 'learning').length,
          Applying: bs.filter(s => s.stage === 'applying').length,
          Interviewing: bs.filter(s => s.stage === 'interviewing').length,
          'Offer Pending': bs.filter(s => s.stage === 'offer_pending').length,
          Placed: bs.filter(s => s.stage === 'placed').length,
          Hired: bs.filter(s => s.hired).length,
          Terminated: bs.filter(s => s.terminated).length,
          'At Risk': bs.filter(s => s.risk_status === 'at_risk' && !s.terminated).length,
        };
      });
      const ws1 = XLSX.utils.json_to_sheet(overviewRows);
      XLSX.utils.book_append_sheet(wb, ws1, 'Batch Overview');

      // Sheet 2: All students
      const studentRows = students.map(s => ({
        Name: s.name,
        Batch: s.batch,
        Project: s.project || '',
        'Mentor Email': s.mentor_email,
        Stage: s.stage,
        'Risk Status': s.risk_status,
        'Risk Reasons': s.risk_reasons,
        'Job Focus': s.job_focus,
        Experience: s.experience,
        Hired: s.hired ? 'Yes' : 'No',
        Terminated: s.terminated ? 'Yes' : 'No',
        'Last Activity': s.last_activity_date,
        'Created At': s.created_at,
      }));
      const ws2 = XLSX.utils.json_to_sheet(studentRows);
      XLSX.utils.book_append_sheet(wb, ws2, 'All Students');

      filename = `placement-summary-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    }

    // ── At-Risk Students ──────────────────────────────────────────────────
    else if (type === 'at_risk') {
      const atRisk = students.filter(s => s.risk_status === 'at_risk' && !s.terminated);
      const rows = atRisk.map(s => ({
        Name: s.name,
        Batch: s.batch,
        'Mentor Email': s.mentor_email,
        Stage: s.stage,
        'Risk Reasons': s.risk_reasons,
        'Last Activity': s.last_activity_date,
        Experience: s.experience,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'At-Risk Students');
      filename = `at-risk-students-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    }

    // ── Monthly Hired ─────────────────────────────────────────────────────
    else if (type === 'monthly_hired') {
      const hired = students.filter(s => {
        if (!s.hired) return false;
        const updated = s.updated_at?.substring(0, 7); // YYYY-MM
        return updated === month;
      });
      const rows = hired.map(s => ({
        Name: s.name,
        Batch: s.batch,
        'Mentor Email': s.mentor_email,
        'Hired Date': s.updated_at?.substring(0, 10) ?? '',
        'Job Focus': s.job_focus,
        Experience: s.experience,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, `Hired ${month}`);
      filename = `monthly-hired-${month}.xlsx`;
    } else {
      return NextResponse.json({ message: 'Invalid report type' }, { status: 400 });
    }

    // Stream the xlsx buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    const status = isApiError(e) ? e.status : 500;
    const message = isApiError(e) ? e.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}
