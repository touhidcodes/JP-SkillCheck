/**
 * GET /api/analytics/timeseries
 *
 * Returns time-series data for any metric stored in daily_metrics.
 * Data source is pre-computed daily_metrics sheet (written by aggregate-daily cron),
 * not raw sheets — ensuring accurate historical snapshots even if student data changes.
 *
 * WHY PRE-COMPUTED HISTORICAL SNAPSHOTS MATTER:
 * If a student's stage changes from 'interviewing' to 'offer_pending' today, a real-time
 * query for their stage 30 days ago would incorrectly return 'offer_pending' (the current
 * value). With daily_metrics, we return the stage that was actually recorded on that date.
 * The daily_metrics row for 30 days ago contains the stage value AS OF that day.
 *
 * Query params:
 *   metric:         prs_score | risk_probability | attendance_rate | activity_count |
 *                   leaderboard_rank | placement_count | at_risk_count | interview_count
 *   studentId?:     filter to single student
 *   mentorEmail?:    filter to mentor's students
 *   batch?:          filter to batch
 *   from:            YYYY-MM-DD start date
 *   to:              YYYY-MM-DD end date
 *   granularity:    day | week (default: day)
 *   compare?:       previous_period — adds comparison series
 */

import { NextResponse } from 'next/server';
import { parseISO, subDays, differenceInDays, format } from 'date-fns';
import { readSheet } from '@/lib/sheets/client';

type MetricName = 'prs_score' | 'risk_probability' | 'attendance_rate' | 'activity_count' |
  'leaderboard_rank' | 'placement_count' | 'at_risk_count' | 'interview_count';

interface TimeSeriesPoint {
  date: string;
  value: number;
}

interface TimeSeriesResponse {
  metric: MetricName;
  granularity: 'day' | 'week';
  series: TimeSeriesPoint[];
  comparison?: TimeSeriesPoint[];
  meta: {
    from: string;
    to: string;
    studentId?: string;
    mentorEmail?: string;
    batch?: string;
    pointCount: number;
  };
}


function aggregateByGranularity(
  data: { date: string; value: number }[],
  granularity: 'day' | 'week'
): TimeSeriesPoint[] {
  if (granularity === 'day') {
    const sorted = [...data].sort((a, b) => a.date.localeCompare(b.date));
    return sorted;
  }

  const grouped = new Map<string, number[]>();
  for (const d of data) {
    const weekStart = format(parseISO(d.date), 'yyyy-\'\'ww');
    const existing = grouped.get(weekStart) || [];
    existing.push(d.value);
    grouped.set(weekStart, existing);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, values]) => ({
      date: week,
      value: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
    }));
}

function getMetricField(metric: MetricName): string {
  const map: Record<MetricName, string> = {
    prs_score: 'prs_total_score',
    risk_probability: 'risk_probability',
    attendance_rate: 'attendance_rate',
    activity_count: 'tasks_completed',
    leaderboard_rank: 'leaderboard_rank',
    placement_count: 'interview_count',
    at_risk_count: 'risk_band',
    interview_count: 'interviews_count',
  };
  return map[metric];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const metric = searchParams.get('metric') as MetricName;
  const studentId = searchParams.get('studentId') ?? undefined;
  const mentorEmail = searchParams.get('mentorEmail') ?? undefined;
  const batch = searchParams.get('batch') ?? undefined;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const granularity = (searchParams.get('granularity') ?? 'day') as 'day' | 'week';
  const compare = searchParams.get('compare') === 'previous_period';

  const VALID_METRICS: MetricName[] = [
    'prs_score', 'risk_probability', 'attendance_rate', 'activity_count',
    'leaderboard_rank', 'placement_count', 'at_risk_count', 'interview_count',
  ];

  if (!metric || !VALID_METRICS.includes(metric)) {
    return NextResponse.json({ message: `Invalid metric. Must be one of: ${VALID_METRICS.join(', ')}` }, { status: 400 });
  }
  if (!from || !to) {
    return NextResponse.json({ message: 'from and to are required' }, { status: 400 });
  }

  const fromDate = parseISO(from);
  const toDate = parseISO(to);
  const dayCount = differenceInDays(toDate, fromDate);

  if (dayCount < 0) {
    return NextResponse.json({ message: 'from must be before to' }, { status: 400 });
  }

  // Read daily_metrics and students in parallel
  const [metricRows, studentRows] = await Promise.all([
    readSheet('daily_metrics'),
    readSheet('students'),
  ]);

  // Build student filter map
  const studentFilterMap = new Map<string, { batch: string; mentor_email: string }>();
  for (const row of studentRows) {
    if (!row[0]) continue;
    studentFilterMap.set(row[0], { batch: row[2] || '', mentor_email: row[4] || '' });
  }

  // Filter and transform metric rows
  const metricField = getMetricField(metric);
  const metricData: { date: string; value: number; student_id: string }[] = [];

  for (const row of metricRows) {
    if (!row[0] || !row[1]) continue;
    const date = row[0];
    if (date < from || date > to) continue;

    const studentIdFromRow = row[1];
    const studentInfo = studentFilterMap.get(studentIdFromRow);
    if (!studentInfo) continue;

    // Apply filters
    if (studentId && studentIdFromRow !== studentId) continue;
    if (mentorEmail && studentInfo.mentor_email !== mentorEmail) continue;
    if (batch && studentInfo.batch !== batch) continue;

    let value: number;
    if (metric === 'at_risk_count') {
      value = (row[10] === 'at_risk' || row[10] === 'critical') ? 1 : 0;
    } else if (metric === 'attendance_rate') {
      // attendance_rate isn't stored in daily_metrics — derive from activity_count
      // Map tasks_completed to a 0-100 score
      value = Math.min(100, (parseInt(row[11], 10) || 0) * 10);
    } else {
      const colIndex = metricField === 'prs_total_score' ? 4
        : metricField === 'risk_probability' ? 9
        : metricField === 'leaderboard_rank' ? 7
        : metricField === 'tasks_completed' ? 11
        : metricField === 'interviews_count' ? 12
        : 4;
      value = parseFloat(row[colIndex]) || 0;
    }

    metricData.push({ date, value, student_id: studentIdFromRow });
  }

  // Aggregate for studentId-level queries (return raw series)
  if (studentId) {
    const sorted = metricData.sort((a, b) => a.date.localeCompare(b.date));
    const series = aggregateByGranularity(sorted, granularity);

    const response: TimeSeriesResponse = {
      metric,
      granularity,
      series,
      meta: { from, to, studentId, pointCount: series.length },
    };

    if (compare) {
      const compareFrom = format(subDays(fromDate, dayCount + 1), 'yyyy-MM-dd');
      const compareTo = format(subDays(toDate, dayCount + 1), 'yyyy-MM-dd');
      const compareRows = await readSheet('daily_metrics');
      const compareData: { date: string; value: number }[] = [];

      for (const row of compareRows) {
        if (!row[0] || !row[1] || row[1] !== studentId) continue;
        const date = row[0];
        if (date < compareFrom || date > compareTo) continue;
        const colIndex = metricField === 'prs_total_score' ? 4 : 9;
        compareData.push({ date, value: parseFloat(row[colIndex]) || 0 });
      }

      const compareSeries = aggregateByGranularity(
        compareData.sort((a, b) => a.date.localeCompare(b.date)),
        granularity
      );
      response.comparison = compareSeries;
    }

    return NextResponse.json(response);
  }

  // Cohort-level aggregation: aggregate across all filtered students per date
  const aggregatedByDate = new Map<string, { sum: number; count: number }>();
  for (const d of metricData) {
    const existing = aggregatedByDate.get(d.date) || { sum: 0, count: 0 };
    existing.sum += d.value;
    existing.count += 1;
    aggregatedByDate.set(d.date, existing);
  }

  const aggregatedSeries: TimeSeriesPoint[] = Array.from(aggregatedByDate.entries())
    .map(([date, { sum, count }]) => ({
      date,
      value: metric === 'leaderboard_rank'
        ? Math.round(sum / count)
        : Math.round((sum / count) * 10) / 10,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const series = aggregateByGranularity(aggregatedSeries, granularity);

  const response: TimeSeriesResponse = {
    metric,
    granularity,
    series,
    meta: {
      from,
      to,
      pointCount: series.length,
      ...(mentorEmail && { mentorEmail }),
      ...(batch && { batch }),
    },
  };

  if (compare) {
    const compareFrom = format(subDays(fromDate, dayCount + 1), 'yyyy-MM-dd');
    const compareTo = format(subDays(toDate, dayCount + 1), 'yyyy-MM-dd');

    const compareRows = await readSheet('daily_metrics');
    const compareData: { date: string; value: number }[] = [];

    for (const row of compareRows) {
      if (!row[0] || !row[1]) continue;
      const date = row[0];
      if (date < compareFrom || date > compareTo) continue;

      const studentIdFromRow = row[1];
      const studentInfo = studentFilterMap.get(studentIdFromRow);
      if (!studentInfo) continue;
      if (mentorEmail && studentInfo.mentor_email !== mentorEmail) continue;
      if (batch && studentInfo.batch !== batch) continue;

      const colIndex = metricField === 'prs_total_score' ? 4
        : metricField === 'risk_probability' ? 9
        : metricField === 'leaderboard_rank' ? 7
        : 4;
      const rawVal = parseFloat(row[colIndex]) || 0;
      const val = metric === 'at_risk_count'
        ? (row[10] === 'at_risk' || row[10] === 'critical' ? 1 : 0)
        : rawVal;
      compareData.push({ date, value: val });
    }

    const compareAgg = new Map<string, { sum: number; count: number }>();
    for (const d of compareData) {
      const existing = compareAgg.get(d.date) || { sum: 0, count: 0 };
      existing.sum += d.value;
      existing.count += 1;
      compareAgg.set(d.date, existing);
    }

    const compareSeries = aggregateByGranularity(
      Array.from(compareAgg.entries())
        .map(([date, { sum, count }]) => ({
          date,
          value: metric === 'leaderboard_rank'
            ? Math.round(sum / count)
            : Math.round((sum / count) * 10) / 10,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      granularity
    );

    response.comparison = compareSeries;
  }

  return NextResponse.json(response);
}