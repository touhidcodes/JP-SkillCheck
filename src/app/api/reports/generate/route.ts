/**
 * POST /api/reports/generate
 *
 * WHY PUSH (automated delivery) IS MORE EFFECTIVE THAN PULL (on-demand):
 * On-demand reports require a manager to remember to log in, navigate to reports,
 * select parameters, and download. In practice, busy managers rarely do this.
 * Automated push delivery (email every Monday 8 AM) means managers receive
 * actionable intelligence without needing to remember to ask for it.
 * The weekly digest becomes part of their workflow rather than an optional exercise.
 *
 * Body: { report_type, params, format: 'xlsx'|'csv' }
 *
 * Report types:
 *   weekly_program   — KPI summary, at-risk list, placements, interviews, top performers
 *   mentor_performance — full scorecard for a mentor over selected period
 *   student_detail    — full history for a specific student
 *   cohort_completion — stage distribution, placement rates, timeline for a batch
 *   company_hiring    — all offers, companies, roles, salary ranges
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { format, subDays } from 'date-fns';
import {
  generateWeeklyProgramReport,
  generateMentorPerformanceReport,
  generateStudentDetailReport,
  generateCohortCompletionReport,
  generateCompanyHiringReport,
} from '@/lib/reports/generators';

const ReportSchema = z.object({
  report_type: z.enum([
    'weekly_program',
    'mentor_performance',
    'student_detail',
    'cohort_completion',
    'company_hiring',
  ]),
  params: z.record(z.string(), z.unknown()).default({}),
  format: z.enum(['xlsx', 'csv']).default('xlsx'),
});

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = ReportSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ message: 'Validation failed', errors: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { report_type, params, format: outputFormat } = parsed.data;
  const now = new Date();
  const to = format(now, 'yyyy-MM-dd');
  const from = format(subDays(now, 7), 'yyyy-MM-dd');

  try {
    let buffer: Buffer;
    let filename: string;

    switch (report_type) {
      case 'weekly_program': {
        buffer = await generateWeeklyProgramReport(from, to);
        filename = `weekly-report-${to}.${outputFormat}`;
        break;
      }
      case 'mentor_performance': {
        const mentorEmail = params.mentorEmail as string;
        if (!mentorEmail) return NextResponse.json({ message: 'mentorEmail required in params' }, { status: 400 });
        buffer = await generateMentorPerformanceReport(mentorEmail, from, to);
        filename = `mentor-performance-${mentorEmail.split('@')[0]}-${to}.${outputFormat}`;
        break;
      }
      case 'student_detail': {
        const studentId = params.studentId as string;
        if (!studentId) return NextResponse.json({ message: 'studentId required in params' }, { status: 400 });
        buffer = await generateStudentDetailReport(studentId);
        filename = `student-detail-${studentId}-${to}.${outputFormat}`;
        break;
      }
      case 'cohort_completion': {
        const batch = params.batch as string;
        if (!batch) return NextResponse.json({ message: 'batch required in params' }, { status: 400 });
        buffer = await generateCohortCompletionReport(batch);
        filename = `cohort-completion-${batch}-${to}.${outputFormat}`;
        break;
      }
      case 'company_hiring': {
        buffer = await generateCompanyHiringReport();
        filename = `company-hiring-report-${to}.${outputFormat}`;
        break;
      }
      default:
        return NextResponse.json({ message: 'Unknown report type' }, { status: 400 });
    }

    const contentType = outputFormat === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error(`[Reports] Failed to generate ${report_type}:`, err);
    return NextResponse.json({ message: 'Report generation failed' }, { status: 500 });
  }
}