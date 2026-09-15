/**
 * WHY this file exists:
 * Company-level analytics requires combining data from progress_logs
 * (which has company_name references) with the companies sheet
 * (which has company metadata). This gives us: pipeline by company,
 * hire conversion rate, and time-to-offer analytics.
 */

import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth/helpers';
import { readSheet } from '@/lib/sheets/client';

export async function GET(request: Request) {
  try {
    requireRole(request.headers, ['manager']);

    const [companyRows, logRows, studentRows] = await Promise.all([
      (async () => {
        try { return await readSheet('companies'); } catch { return [] as string[][]; }
      })(),
      (async () => {
        try { return await readSheet('progress_logs'); } catch { return [] as string[][]; }
      })(),
      (async () => {
        try { return await readSheet('students'); } catch { return [] as string[][]; }
      })(),
    ]);

    const companies = companyRows.map((row) => ({
      id: row[0] || '',
      canonical_name: row[1] || '',
      industry: row[2] || 'other',
      hiring_status: row[7] || 'prospect',
    }));

    const logs = logRows.map((row) => ({
      id: row[0] || '',
      student_id: row[1] || '',
      student_name: row[2] || '',
      log_type: row[4] || 'Other',
      company_name: row[5] || '',
      scheduled_date: row[6] || '',
      logged_at: row[9] || '',
    }));

    const students = studentRows.map((row) => ({
      id: row[0] || '',
      name: row[1] || '',
      hired: row[12] === 'true',
    }));

    const studentNameMap = new Map(students.map(s => [s.id, s.name]));

    // Build company stats
    const companyStats = new Map<string, {
      company: string;
      industry: string;
      hiring_status: string;
      interviewCount: number;
      offerCount: number;
      hiredCount: number;
      students: string[];
      avgTimeToOffer: number;
    }>();

    for (const company of companies) {
      companyStats.set(company.canonical_name, {
        company: company.canonical_name,
        industry: company.industry,
        hiring_status: company.hiring_status,
        interviewCount: 0,
        offerCount: 0,
        hiredCount: 0,
        students: [],
        avgTimeToOffer: 0,
      });
    }

    const offerTimes: Map<string, number[]> = new Map();

    for (const log of logs) {
      const company = log.company_name;
      if (!company) continue;

      if (!companyStats.has(company)) {
        // Auto-create entry for companies not in the companies sheet
        companyStats.set(company, {
          company,
          industry: 'unknown',
          hiring_status: 'unknown',
          interviewCount: 0,
          offerCount: 0,
          hiredCount: 0,
          students: [],
          avgTimeToOffer: 0,
        });
      }

      const stats = companyStats.get(company)!;

      if (log.log_type === 'Interview Call') {
        stats.interviewCount++;
        const name = log.student_name || studentNameMap.get(log.student_id) || 'Unknown';
        if (!stats.students.includes(name)) stats.students.push(name);
      }

      if (log.log_type === 'Offer') {
        stats.offerCount++;
        // Track time to offer (from first application)
        const offerDate = new Date(log.logged_at).getTime();
        const studentLogs = logs.filter(
          l => l.student_id === log.student_id && l.company_name === company
        );
        const firstApp = studentLogs
          .filter(l => l.log_type === 'Job Applied')
          .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())[0];
        if (firstApp) {
          const appDate = new Date(firstApp.logged_at).getTime();
          const days = Math.round((offerDate - appDate) / (1000 * 60 * 60 * 24));
          const times = offerTimes.get(company) ?? [];
          times.push(days);
          offerTimes.set(company, times);
        }
      }
    }

    // Count hires
    for (const student of students) {
      if (!student.hired) continue;
      const statsArray = Array.from(companyStats.values());
      for (const stats of statsArray) {
        if (stats.students.includes(student.name)) {
          stats.hiredCount++;
        }
      }
    }

    // Compute avg time to offer
    const offerTimesArray = Array.from(offerTimes.entries());
    for (const [company, times] of offerTimesArray) {
      const stats = companyStats.get(company);
      if (stats && times.length > 0) {
        stats.avgTimeToOffer = Math.round(
          times.reduce((a: number, b: number) => a + b, 0) / times.length
        );
      }
    }

    const data = Array.from(companyStats.values())
      .filter(c => c.interviewCount > 0 || c.offerCount > 0)
      .sort((a, b) => b.offerCount - a.offerCount);

    const summary = {
      total_companies: data.length,
      active_companies: data.filter(c => c.hiring_status === 'active').length,
      total_interviews: data.reduce((s, c) => s + c.interviewCount, 0),
      total_offers: data.reduce((s, c) => s + c.offerCount, 0),
      total_hires: data.reduce((s, c) => s + c.hiredCount, 0),
      conversion_rate: 0 as number,
    };

    const interviewToOffer = summary.total_interviews;
    if (interviewToOffer > 0) {
      summary.conversion_rate = Math.round((summary.total_offers / interviewToOffer) * 100);
    }

    return NextResponse.json({
      data,
      summary,
      total: data.length,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}