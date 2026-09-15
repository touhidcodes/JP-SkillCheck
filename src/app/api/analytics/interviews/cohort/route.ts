import { NextResponse } from 'next/server';
import { getUserFromHeaders } from '@/lib/auth/helpers';
import { getAllStudents } from '@/lib/sheets/students';
import { getAllProgressLogs } from '@/lib/sheets/progress-logs';
import { parseISO, subDays, isWithinInterval } from 'date-fns';

export async function GET(request: Request) {
  try {
    const user = getUserFromHeaders(request.headers);
    if (!user || !['mentor', 'manager'].includes(user.role)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const mentorEmail = searchParams.get('mentorEmail') ?? user.email;
    const days = parseInt(searchParams.get('days') ?? '30', 10);

    const now = new Date();
    const from = subDays(now, days);

    const [allStudents, allLogs] = await Promise.all([
      getAllStudents(),
      getAllProgressLogs(),
    ]);

    const menteeIds = new Set(
      allStudents
        .filter(s => s.mentor_email === mentorEmail && !s.terminated)
        .map(s => s.id)
    );

    const menteeLogs = allLogs.filter(l => menteeIds.has(l.student_id));
    const periodLogs = menteeLogs.filter(l => {
      try { return isWithinInterval(parseISO(l.scheduled_date), { start: from, end: now }); }
      catch { return false; }
    });

    const interviews = periodLogs.filter(l => l.log_type === 'Interview Call');
    const mockInterviews = periodLogs.filter(l => l.log_type === 'Mock Interview');
    const offers = periodLogs.filter(l => l.log_type === 'Offer');

    const mockScores = menteeLogs
      .filter(l => l.log_type === 'Mock Interview')
      .map(l => (l as { mock_score?: number }).mock_score)
      .filter((s): s is number => s !== undefined && !isNaN(s));

    const mockScoreAvg = mockScores.length > 0
      ? Math.round(mockScores.reduce((a, b) => a + b, 0) / mockScores.length * 10) / 10
      : null;

    let conversions = 0;
    for (const interview of interviews) {
      if (!interview.company_name) continue;
      const interviewDate = parseISO(interview.scheduled_date);
      const subsequentOffers = offers.filter(o => {
        if (o.company_name !== interview.company_name) return false;
        try {
          const offerDate = parseISO(o.scheduled_date);
          if (offerDate <= interviewDate) return false;
          const daysDiff = Math.round((offerDate.getTime() - interviewDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysDiff <= 90;
        } catch { return false; }
      });
      if (subsequentOffers.length > 0) conversions++;
    }

    const companySet = new Set<string>();
    for (const i of interviews) {
      if (i.company_name) companySet.add(i.company_name);
    }

    const studentMetrics = Array.from(menteeIds).map(sid => {
      const sLogs = menteeLogs.filter(l => l.student_id === sid);
      const sInterviews = sLogs.filter(l => l.log_type === 'Interview Call');
      const sMocks = sLogs.filter(l => l.log_type === 'Mock Interview');
      const sOffers = sLogs.filter(l => l.log_type === 'Offer');

      const sMockScores = sMocks.map(l => (l as { mock_score?: number }).mock_score).filter((s): s is number => s !== undefined);
      const sMockAvg = sMockScores.length > 0
        ? Math.round(sMockScores.reduce((a, b) => a + b, 0) / sMockScores.length * 10) / 10
        : null;

      let sConversions = 0;
      for (const interview of sInterviews) {
        if (!interview.company_name) continue;
        const interviewDate = parseISO(interview.scheduled_date);
        const hasOffer = sOffers.some(o => {
          if (o.company_name !== interview.company_name) return false;
          try {
            const offerDate = parseISO(o.scheduled_date);
            return offerDate > interviewDate &&
              Math.round((offerDate.getTime() - interviewDate.getTime()) / (1000 * 60 * 60 * 24)) <= 90;
          } catch { return false; }
        });
        if (hasOffer) sConversions++;
      }

      return {
        student_id: sid,
        interview_count: sInterviews.length,
        mock_interview_count: sMocks.length,
        mock_score_avg: sMockAvg,
        offer_count: sOffers.length,
        real_interview_to_offer_rate: sInterviews.length > 0
          ? Math.round((sConversions / sInterviews.length) * 100)
          : null,
      };
    });

    return NextResponse.json({
      mentor_email: mentorEmail,
      period_days: days,
      cohort_interviews: interviews.length,
      cohort_mock_interviews: mockInterviews.length,
      cohort_mock_score_avg: mockScoreAvg,
      cohort_offers: offers.length,
      cohort_conversion_rate: interviews.length > 0
        ? Math.round((conversions / interviews.length) * 100)
        : null,
      unique_companies: companySet.size,
      students: studentMetrics.sort((a, b) => (b.mock_score_avg ?? 0) - (a.mock_score_avg ?? 0)),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}