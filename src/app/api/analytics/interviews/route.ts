/**
 * WHY (company + student + time window) linking is correct for conversion rate:
 * The progress_logs schema has no offer_id field linking an interview directly to an offer.
 * The only linkage between an Interview Call and an Offer entry is:
 *   - Same student_id (confirmed)
 *   - Same company_name (the student interviewed AND received an offer at the same company)
 *   - The Offer must come AFTER the Interview Call chronologically
 *   - A reasonable time window prevents false positives (a student who interviewed at Google
 *     2 years ago and recently received a Google offer from a different process shouldn't count)
 *
 * The 90-day window is based on typical hiring cycle length. After 90 days without an offer
 * following an interview, it's reasonable to assume that interview did not result in an offer.
 * A wider window risks false positives; a narrower window risks missing legitimate conversions.
 *
 * IMPORTANT CAVEAT: This is a probabilistic linkage, not a guaranteed one. The student could
 * have interviewed at Google, received a Google offer from a different company, or the offer
 * could be from a later interview at the same company that wasn't logged. The mentor should
 * always verify with the student before citing this as a definitive conversion rate.
 */

import { NextResponse } from 'next/server';
import { getUserFromHeaders } from '@/lib/auth/helpers';
import { getAllProgressLogs } from '@/lib/sheets/progress-logs';
import { parseISO, subDays, isWithinInterval } from 'date-fns';

export async function GET(request: Request) {
  try {
    const user = getUserFromHeaders(request.headers);
    if (!user || !['mentor', 'manager'].includes(user.role)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    if (!studentId) {
      return NextResponse.json({ message: 'studentId query param is required' }, { status: 400 });
    }

    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);

    const allLogs = await getAllProgressLogs();
    const studentLogs = allLogs.filter(l => l.student_id === studentId);

    const interviews = studentLogs.filter(l => l.log_type === 'Interview Call');
    const mockInterviews = studentLogs.filter(l => l.log_type === 'Mock Interview');
    const offers = studentLogs.filter(l => l.log_type === 'Offer');

    const recentInterviews = interviews.filter(l => {
      try { return isWithinInterval(parseISO(l.scheduled_date), { start: thirtyDaysAgo, end: now }); }
      catch { return false; }
    });

    const mockScores = mockInterviews
      .map(l => (l as { mock_score?: number }).mock_score)
      .filter((s): s is number => s !== undefined && !isNaN(s));

    const mockScoreAvg = mockScores.length > 0
      ? Math.round(mockScores.reduce((a, b) => a + b, 0) / mockScores.length * 10) / 10
      : null;

    const halfLength = Math.floor(mockScores.length / 2);
    let mockScoreTrend: 'improving' | 'stable' | 'declining' | 'insufficient_data' = 'insufficient_data';
    if (mockScores.length >= 4) {
      const firstHalf = mockScores.slice(0, halfLength);
      const secondHalf = mockScores.slice(halfLength);
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
      const diff = secondAvg - firstAvg;
      if (diff >= 1) mockScoreTrend = 'improving';
      else if (diff <= -1) mockScoreTrend = 'declining';
      else mockScoreTrend = 'stable';
    }

    const companySet = new Set<string>();
    for (const i of interviews) {
      if (i.company_name) companySet.add(i.company_name);
    }
    const companyReach = companySet.size;

    // Interview → Offer conversion via (company + student + time window)
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

    const realInterviewToOfferRate = interviews.length > 0
      ? Math.round((conversions / interviews.length) * 100)
      : null;

    // Interview frequency (per week trend)
    const weeks: number[] = [];
    for (let w = 0; w < 8; w++) {
      const weekStart = subDays(now, (w + 1) * 7);
      const weekEnd = subDays(now, w * 7);
      const count = interviews.filter(l => {
        try {
          const d = parseISO(l.scheduled_date);
          return d >= weekStart && d < weekEnd;
        } catch { return false; }
      }).length;
      weeks.push(count);
    }

    const [w0, w1, w2, w3, w4, w5, w6, w7] = weeks;
    const recentAvg = (w0 + w1 + w2 + w3) / 4;
    const olderAvg = (w4 + w5 + w6 + w7) / 4;
    const frequencyTrend = olderAvg > 0
      ? (recentAvg - olderAvg) / olderAvg
      : recentAvg > 0 ? 1 : 0;

    const TREND_LABELS: Record<string, string> = {
      improving: '↗ Increasing',
      declining: '↘ Decreasing',
      stable: '→ Stable',
      insufficient_data: '— Insufficient data',
    };

    return NextResponse.json({
      student_id: studentId,
      total_interviews: interviews.length,
      interviews_last_30d: recentInterviews.length,
      mock_interview_count: mockInterviews.length,
      mock_score_avg: mockScoreAvg,
      mock_score_trend: mockScoreTrend,
      mock_score_trend_label: TREND_LABELS[mockScoreTrend] ?? mockScoreTrend,
      real_interview_to_offer_rate: realInterviewToOfferRate,
      real_interview_to_offer_count: conversions,
      company_reach: companyReach,
      interview_frequency_trend: Math.round(frequencyTrend * 100),
      interview_frequency_trend_label: frequencyTrend > 0.1 ? 'improving' : frequencyTrend < -0.1 ? 'declining' : 'stable',
      weekly_counts: weeks.reverse(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}