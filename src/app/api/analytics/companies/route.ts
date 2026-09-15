import { NextResponse } from 'next/server';
import { getAllProgressLogs } from '@/lib/sheets/progress-logs';
import { getAllStudents } from '@/lib/sheets/students';
import { requireRole } from '@/lib/auth/helpers';

export async function GET(request: Request) {
  try {
    requireRole(request.headers, ['manager']);
    const [allLogs, allStudents] = await Promise.all([
      getAllProgressLogs(),
      getAllStudents(),
    ]);

    const studentNames = new Map(allStudents.map(s => [s.id, s.name]));

    const companyMap = new Map<string, {
      company: string;
      interviewCount: number;
      offerCount: number;
      hiredCount: number;
      students: string[];
    }>();

    const offerLogs = allLogs.filter(l => l.log_type === 'Offer');
    const interviewLogs = allLogs.filter(l => l.log_type === 'Interview Call');

    for (const log of offerLogs) {
      const company = log.company_name || 'Unknown';
      if (!companyMap.has(company)) {
        companyMap.set(company, { company, interviewCount: 0, offerCount: 0, hiredCount: 0, students: [] });
      }
      const entry = companyMap.get( company)!;
      entry.offerCount++;
      entry.students.push(log.student_name || studentNames.get(log.student_id) || 'Unknown');
    }

    for (const log of interviewLogs) {
      const company = log.company_name || 'Unknown';
      if (!companyMap.has(company)) {
        companyMap.set(company, { company, interviewCount: 0, offerCount: 0, hiredCount: 0, students: [] });
      }
      companyMap.get(company)!.interviewCount++;
    }

    for (const student of allStudents) {
      if (student.hired) {
        const name = student.name;
        for (const entry of Array.from(companyMap.values())) {
          if (entry.students.includes(name)) {
            entry.hiredCount++;
            break;
          }
        }
      }
    }

    const companies = Array.from(companyMap.entries())
      .map(([, data]) => data)
      .filter(c => c.offerCount > 0 || c.interviewCount > 0)
      .sort((a, b) => b.offerCount - a.offerCount)
      .slice(0, 20);

    const topCompaniesByOffers = [...companies]
      .sort((a, b) => b.offerCount - a.offerCount)
      .slice(0, 8);

    const topCompaniesByHires = [...companies]
      .filter(c => c.hiredCount > 0)
      .sort((a, b) => b.hiredCount - a.hiredCount)
      .slice(0, 8);

    return NextResponse.json({
      data: companies,
      topCompaniesByOffers,
      topCompaniesByHires,
      total: companies.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}