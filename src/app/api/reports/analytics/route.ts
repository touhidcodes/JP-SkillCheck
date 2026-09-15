/**
 * WHY this file exists:
 * Provides a comprehensive analytics report as a streaming Excel download.
 *
 * WHY streaming matters on Vercel free tier:
 * Vercel serverless functions have a 10-second timeout on the Hobby plan.
 * If we build the entire Excel workbook in memory before returning, and the
 * dataset is large (500+ students, 10,000+ progress logs), the function
 * may timeout before completing.
 *
 * The solution: Read data in a single efficient pass (not N per-student reads),
 * build worksheets incrementally, and use the xlsx library's write to buffer
 * which is more memory-efficient than building the full workbook object.
 *
 * Key optimizations:
 * 1. All data read in parallel with Promise.all (not sequential)
 * 2. In-memory partition to Map structures to avoid O(n²) lookups
 * 3. Sheet construction uses json_to_sheet which is O(n)
 * 4. Return as a ReadableStream/buffer — not ideal streaming but the xlsx
 *    library doesn't support true WritableStream-based streaming
 * 5. Data filtered to active students first (smaller dataset)
 */

import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requireRole } from '@/lib/auth/helpers';
import { readSheet } from '@/lib/sheets/client';
import type { StudentStage, RiskStatus } from '@/types';
import { format, differenceInDays } from 'date-fns';

// ---------------------------------------------------------------------------
// Raw row mappers (same pattern as engine.ts — centralized in one place
// for the Prisma migration)
// ---------------------------------------------------------------------------

interface Student {
  id: string; name: string; batch: string; project: string; mentor_email: string;
  student_email: string; stage: StudentStage; risk_status: RiskStatus;
  risk_reasons: string; last_activity_date: string; terminated: boolean;
  hired: boolean; created_at: string; updated_at: string;
}

interface ProgressLog {
  id: string; student_id: string; student_name: string; log_type: string;
  company_name: string; scheduled_date: string; logged_at: string;
}

function rowToStudent(row: string[]): Student {
  return {
    id: row[0] || '',
    name: row[1] || '',
    batch: row[2] || '',
    project: row[3] || '',
    mentor_email: row[4] || '',
    student_email: row[5] || '',
    stage: (row[6] || 'learning') as StudentStage,
    risk_status: (row[7] || 'safe') as RiskStatus,
    risk_reasons: row[8] || '',
    last_activity_date: row[9] || '',
    terminated: row[11] === 'true',
    hired: row[12] === 'true',
    created_at: row[14] || '',
    updated_at: row[15] || '',
  };
}

function rowToProgressLog(row: string[]): ProgressLog {
  return {
    id: row[0] || '',
    student_id: row[1] || '',
    student_name: row[2] || '',
    log_type: row[4] || 'Other',
    company_name: row[5] || '',
    scheduled_date: row[6] || '',
    logged_at: row[9] || '',
  };
}

function rowToRiskHistory(row: string[]): { student_id: string; student_name: string; mentor_email: string; reasons: string; flagged_at: string; resolved_at: string } {
  return {
    student_id: row[1] || '',
    student_name: row[2] || '',
    mentor_email: row[3] || '',
    reasons: row[4] || '',
    flagged_at: row[5] || '',
    resolved_at: row[6] || '',
  };
}

export async function GET(request: Request) {
  try {
    requireRole(request.headers, ['manager']);
    const filename = `analytics-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`;

    // Parallel read of all sheets in one pass
    const [studentRows, progressRows, riskRows] = await Promise.all([
      readSheet('students'),
      readSheet('progress_logs'),
      readSheet('risk_history'),
    ]);

    const students = studentRows.map(rowToStudent).filter(s => s.id);
    const logs = progressRows.map(rowToProgressLog).filter(l => l.id);
    const riskHistory = riskRows.map(rowToRiskHistory).filter(r => r.student_id);

    // Build index maps (single pass, O(n))
    const logsByStudent = new Map<string, ProgressLog[]>();
    for (const log of logs) {
      const list = logsByStudent.get(log.student_id) ?? [];
      list.push(log);
      logsByStudent.set(log.student_id, list);
    }

    const mentorStudents = new Map<string, Student[]>();
    for (const s of students) {
      if (!s.mentor_email) continue;
      const list = mentorStudents.get(s.mentor_email) ?? [];
      list.push(s);
      mentorStudents.set(s.mentor_email, list);
    }

    const active = students.filter(s => !s.terminated);

    const wb = XLSX.utils.book_new();

    // ── Sheet 1: Overview ──────────────────────────────────────────────────
    const stageCounts = { learning: 0, applying: 0, interviewing: 0, offer_pending: 0, placed: 0, hired: 0 };
    for (const s of active) {
      if (s.stage in stageCounts) (stageCounts as unknown as Record<string, number>)[s.stage]++;
    }

    const overviewRows = [
      { Metric: 'Total Students', Value: students.length },
      { Metric: 'Active Students', Value: active.length },
      { Metric: 'Terminated', Value: students.filter(s => s.terminated).length },
      { Metric: 'Hired', Value: students.filter(s => s.hired).length },
      { Metric: 'At Risk', Value: active.filter(s => s.risk_status === 'at_risk').length },
      { Metric: 'In Learning', Value: stageCounts.learning },
      { Metric: 'In Applying', Value: stageCounts.applying },
      { Metric: 'Interviewing', Value: stageCounts.interviewing },
      { Metric: 'Offer Pending', Value: stageCounts.offer_pending },
      { Metric: 'Placed (not yet hired)', Value: stageCounts.placed },
      { Metric: 'Total Mentors', Value: mentorStudents.size },
      { Metric: 'Report Generated', Value: format(new Date(), 'yyyy-MM-dd HH:mm') },
    ];
    const ws1 = XLSX.utils.json_to_sheet(overviewRows);
    XLSX.utils.book_append_sheet(wb, ws1, 'Overview');

    // ── Sheet 2: Student Detail ───────────────────────────────────────────
    const studentDetailRows = active.map(s => {
      const sLogs = logsByStudent.get(s.id) ?? [];
      const interviewCount = sLogs.filter(l => l.log_type === 'Interview Call').length;
      const offerCount = sLogs.filter(l => l.log_type === 'Offer').length;
      return {
        Name: s.name,
        Batch: s.batch,
        Project: s.project,
        Mentor: s.mentor_email,
        Stage: s.stage,
        'Risk Status': s.risk_status,
        'Last Activity': s.last_activity_date || 'Never',
        'Days Inactive': s.last_activity_date
          ? differenceInDays(new Date(), new Date(s.last_activity_date))
          : 'N/A',
        Interviews: interviewCount,
        Offers: offerCount,
        Hired: s.hired ? 'Yes' : 'No',
        Created: s.created_at?.substring(0, 10) ?? '',
      };
    });
    const ws2 = XLSX.utils.json_to_sheet(studentDetailRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Student Detail');

    // ── Sheet 3: Mentor Performance ─────────────────────────────────────
    const mentorRows: Record<string, {
      mentor_email: string; total_students: number; active: number;
      placed: number; hired: number; at_risk: number; interview_count: number;
    }> = {};

    for (const s of students) {
      if (!s.mentor_email) continue;
      if (!mentorRows[s.mentor_email]) {
        mentorRows[s.mentor_email] = {
          mentor_email: s.mentor_email, total_students: 0, active: 0,
          placed: 0, hired: 0, at_risk: 0, interview_count: 0,
        };
      }
      const m = mentorRows[s.mentor_email];
      m.total_students++;
      if (!s.terminated) m.active++;
      if (s.hired) { m.hired++; m.placed++; }
      else if (s.stage === 'placed') m.placed++;
      if (s.risk_status === 'at_risk') m.at_risk++;
    }

    for (const sLogs of Array.from(logsByStudent.values())) {
      for (const log of sLogs) {
        const student = students.find(st => st.id === log.student_id);
        if (!student?.mentor_email) continue;
        if (!mentorRows[student.mentor_email]) continue;
        if (log.log_type === 'Interview Call') mentorRows[student.mentor_email].interview_count++;
      }
    }

    const mentorSheetRows = Object.values(mentorRows).map(m => ({
      Mentor: m.mentor_email.split('@')[0],
      Email: m.mentor_email,
      'Total Students': m.total_students,
      Active: m.active,
      Placed: m.placed,
      Hired: m.hired,
      'At Risk': m.at_risk,
      'Total Interviews': m.interview_count,
      'Placement Rate': m.total_students > 0 ? `${Math.round((m.placed / m.total_students) * 100)}%` : 'N/A',
    })).sort((a, b) => (b.Placed as number) - (a.Placed as number));

    const ws3 = XLSX.utils.json_to_sheet(mentorSheetRows);
    XLSX.utils.book_append_sheet(wb, ws3, 'Mentor Performance');

    // ── Sheet 4: Company Pipeline ───────────────────────────────────────
    const companyMap = new Map<string, { company: string; interviews: number; offers: number; hired: number; students: string[] }>();

    for (const log of logs) {
      if (!log.company_name) continue;
      if (!companyMap.has(log.company_name)) {
        companyMap.set(log.company_name, { company: log.company_name, interviews: 0, offers: 0, hired: 0, students: [] });
      }
      const c = companyMap.get(log.company_name)!;
      if (log.log_type === 'Interview Call') c.interviews++;
      if (log.log_type === 'Offer') c.offers++;
      if (!c.students.includes(log.student_name)) c.students.push(log.student_name);
    }

    for (const student of students) {
      if (!student.hired) continue;
      const companyArray = Array.from(companyMap.values());
      for (const c of companyArray) {
        if (c.students.includes(student.name)) c.hired++;
      }
    }

    const companyRows = Array.from(companyMap.values())
      .filter(c => c.interviews > 0 || c.offers > 0)
      .map(c => ({
        Company: c.company,
        Interviews: c.interviews,
        Offers: c.offers,
        Hired: c.hired,
        'Offer Rate': c.interviews > 0 ? `${Math.round((c.offers / c.interviews) * 100)}%` : 'N/A',
      }))
      .sort((a, b) => b.Hired - a.Hired);

    const ws4 = XLSX.utils.json_to_sheet(companyRows);
    XLSX.utils.book_append_sheet(wb, ws4, 'Company Pipeline');

    // ── Sheet 5: Risk History ─────────────────────────────────────────────
    const riskRows2 = riskHistory.map(r => ({
      'Student Name': r.student_name,
      'Mentor': r.mentor_email,
      'Risk Reasons': r.reasons,
      'Flagged At': r.flagged_at ? r.flagged_at.substring(0, 10) : '',
      'Resolved At': r.resolved_at ? r.resolved_at.substring(0, 10) : 'Still At Risk',
      'Resolution Status': r.resolved_at ? 'Resolved' : 'Open',
    }));
    const ws5 = XLSX.utils.json_to_sheet(riskRows2);
    XLSX.utils.book_append_sheet(wb, ws5, 'Risk History');

    // ── Generate and stream ───────────────────────────────────────────────
    // write() to buffer is synchronous — for very large datasets, consider
    // using a WritableStream in Node 18+ with XLSX.write() to Node.js stream
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'Transfer-Encoding': 'chunked',
      },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}