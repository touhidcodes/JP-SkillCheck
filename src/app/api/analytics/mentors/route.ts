import { NextResponse } from 'next/server';
import { getAllStudents } from '@/lib/sheets/students';
import { getAllProgressLogs } from '@/lib/sheets/progress-logs';
import { requireRole } from '@/lib/auth/helpers';
import { differenceInDays, subDays } from 'date-fns';

export async function GET(request: Request) {
  try {
    requireRole(request.headers, ['manager']);
    const [allStudents, allLogs] = await Promise.all([
      getAllStudents(),
      getAllProgressLogs(),
    ]);

    const mentorMap = new Map<string, {
      email: string;
      name: string;
      totalMentees: number;
      activeMentees: number;
      placed: number;
      hired: number;
      atRisk: number;
      interviewsThisMonth: number;
      logsThisMonth: number;
      avgDaysToPlacement: number;
      totalActivityDays: number;
      placementTimes: number[];
    }>();

    for (const student of allStudents) {
      const mentor = student.mentor_email;
      if (!mentor) continue;

      if (!mentorMap.has(mentor)) {
        mentorMap.set(mentor, {
          email: mentor,
          name: mentor.split('@')[0],
          totalMentees: 0, activeMentees: 0, placed: 0, hired: 0,
          atRisk: 0, interviewsThisMonth: 0, logsThisMonth: 0,
          avgDaysToPlacement: 0, totalActivityDays: 0, placementTimes: [],
        });
      }
      const m = mentorMap.get(mentor)!;
      m.totalMentees++;
      if (!student.terminated) m.activeMentees++;
      if (student.hired) { m.hired++; m.placed++; }
      else if (student.stage === 'placed') m.placed++;
      if (student.risk_status === 'at_risk') m.atRisk++;
    }

    const monthAgo = subDays(new Date(), 30);
    for (const log of allLogs) {
      const mentor = allStudents.find(s => s.id === log.student_id)?.mentor_email;
      if (!mentor) continue;
      const m = mentorMap.get(mentor);
      if (!m) continue;

      try {
        const logDate = new Date(log.logged_at);
        if (logDate >= monthAgo) {
          m.logsThisMonth++;
          if (log.log_type === 'Interview Call' || log.log_type === 'Mock Interview') {
            m.interviewsThisMonth++;
          }
        }
      } catch { /* skip bad dates */ }

      if (log.log_type === 'Offer') {
        const student = allStudents.find(s => s.id === log.student_id);
        if (student?.hired && student?.created_at) {
          try {
            const days = differenceInDays(new Date(log.logged_at), new Date(student.created_at));
            m.placementTimes.push(days);
          } catch { /* skip */ }
        }
      }
    }

    for (const m of Array.from(mentorMap.values())) {
      if (m.placementTimes.length > 0) {
        m.avgDaysToPlacement = Math.round(
          m.placementTimes.reduce((a, b) => a + b, 0) / m.placementTimes.length
        );
      }
      const activeMenteesWithActivity = allStudents.filter(
        s => s.mentor_email === m.email && !s.terminated && s.last_activity_date
      );
      const totalDays = activeMenteesWithActivity.reduce((sum, s) => {
        try {
          return sum + Math.max(0, differenceInDays(new Date(), new Date(s.last_activity_date)));
        } catch { return sum; }
      }, 0);
      m.totalActivityDays = totalDays;
    }

    const scorecard = Array.from(mentorMap.values()).map(m => ({
      email: m.email,
      name: m.name,
      totalMentees: m.totalMentees,
      activeMentees: m.activeMentees,
      placed: m.placed,
      hired: m.hired,
      atRisk: m.atRisk,
      interviewsThisMonth: m.interviewsThisMonth,
      logsThisMonth: m.logsThisMonth,
      avgDaysToPlacement: m.avgDaysToPlacement,
      activityScore: m.activeMentees > 0
        ? Math.max(0, 100 - Math.round(m.totalActivityDays / m.activeMentees))
        : 0,
    }));

    scorecard.sort((a, b) => b.placed - a.placed);

    return NextResponse.json({ data: scorecard, total: scorecard.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}