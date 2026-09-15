import { NextResponse } from 'next/server';
import { getAllStudents } from '@/lib/sheets/students';
import { getAllProgressLogs } from '@/lib/sheets/progress-logs';
import { requireRole } from '@/lib/auth/helpers';
import { format, subDays, eachWeekOfInterval, endOfWeek } from 'date-fns';

export async function GET(request: Request) {
  try {
    requireRole(request.headers, ['manager']);
    const [allStudents, allLogs] = await Promise.all([
      getAllStudents(),
      getAllProgressLogs(),
    ]);

    const now = new Date();
    const eightWeeksAgo = subDays(now, 56);

    const weeks = eachWeekOfInterval(
      { start: eightWeeksAgo, end: now },
      { weekStartsOn: 1 }
    );

    const placementTrend = weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

      const newPlacements = allLogs.filter(log => {
        if (log.log_type !== 'Offer') return false;
        try {
          const d = log.logged_at;
          return d >= weekStartStr && d <= weekEndStr;
        } catch { return false; }
      }).length;

      const atRiskCount = allStudents.filter(s => {
        if (s.terminated) return false;
        try {
          const lastActivity = s.last_activity_date;
          if (!lastActivity) return false;
          return lastActivity <= weekEndStr;
        } catch { return false; }
      }).length;

      return {
        week: format(weekStart, 'MMM d'),
        weekStart: weekStartStr,
        placements: newPlacements,
        atRisk: atRiskCount,
        activeCount: allStudents.filter(s => !s.terminated).length,
      };
    });

    const stageDistribution = weeks.map(weekStart => {
      const counts = { learning: 0, applying: 0, interviewing: 0, offer_pending: 0, placed: 0, hired: 0 };
      for (const s of allStudents) {
        if (s.terminated) continue;
        if (s.stage in counts) counts[s.stage as keyof typeof counts]++;
      }
      return {
        week: format(weekStart, 'MMM d'),
        ...counts,
      };
    });

    return NextResponse.json({
      data: placementTrend,
      stageDistribution,
      weeklyAverages: {
        placementsPerWeek: weeks.length > 0
          ? Math.round(placementTrend.reduce((s, w) => s + w.placements, 0) / weeks.length)
          : 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ message }, { status: 500 });
  }
}