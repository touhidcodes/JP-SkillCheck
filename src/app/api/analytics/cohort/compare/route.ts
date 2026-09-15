/**
 * GET /api/analytics/cohort/compare?dim=batch&a=batch-1&b=batch-2&from=X&to=Y
 *
 * WHY COHORT COMPARISON IS THE MOST VALUABLE STRATEGIC TOOL:
 * Individual student analytics tell you what happened to one student.
 * Cohort comparison tells you what's working and what's broken in your PROGRAM.
 * If Batch A (new curriculum) has 40% higher placement rate than Batch B (old curriculum),
 * that's an actionable insight that benefits ALL future students.
 * Without cohort comparison, you're optimizing blind — guessing what drives outcomes
 * rather than measuring it systematically.
 */

import { NextResponse } from 'next/server';
import { readSheet } from '@/lib/sheets/client';

interface CohortMetrics {
  dimension: string;
  value: string;
  totalStudents: number;
  activeStudents: number;
  placedStudents: number;
  hiredStudents: number;
  placementRate: number;
  hireRate: number;
  avgPrsScore: number;
  atRiskRate: number;
  interviewVolumePerStudent: number;
  avgDaysToPlacement: number;
}

interface ComparisonResult {
  a: CohortMetrics;
  b: CohortMetrics;
  comparison: {
    metric: string;
    aValue: number;
    bValue: number;
    delta: number;
    deltaPercent: number;
  }[];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dim = searchParams.get('dim');
  const a = searchParams.get('a');
  const b = searchParams.get('b');

  const VALID_DIMS = ['batch', 'project', 'mentor_email', 'experience'];
  if (!dim || !VALID_DIMS.includes(dim)) {
    return NextResponse.json({ message: `dim must be one of: ${VALID_DIMS.join(', ')}` }, { status: 400 });
  }
  if (!a || !b) {
    return NextResponse.json({ message: 'a and b (two dimension values to compare) are required' }, { status: 400 });
  }

  const colIndex = dim === 'batch' ? 2 : dim === 'project' ? 3 : dim === 'mentor_email' ? 4 : 13;

  const [studentRows, progressLogRows, metricRows] = await Promise.all([
    readSheet('students'),
    readSheet('progress_logs'),
    readSheet('daily_metrics'),
  ]);

  function computeCohortMetrics(dimensionValue: string): CohortMetrics {
    const students = studentRows.filter(r => r[colIndex] === dimensionValue && !r[0]);
    const activeStudents = students.filter(r => r[11] !== 'true' && r[12] !== 'true');
    const placedStudents = students.filter(r => r[12] === 'true');
    const hiredStudents = students.filter(r => r[12] === 'true');
    const totalStudents = students.length;

    const placementRate = totalStudents > 0 ? Math.round((placedStudents.length / totalStudents) * 100) : 0;
    const hireRate = totalStudents > 0 ? Math.round((hiredStudents.length / totalStudents) * 100) : 0;

    const studentIds = new Set(students.map(r => r[0]));
    const recentMetrics = metricRows.filter(r => r[1] && studentIds.has(r[1]));
    const avgPrsScore = recentMetrics.length > 0
      ? Math.round(recentMetrics.reduce((sum, r) => sum + (parseFloat(r[4]) || 0), 0) / recentMetrics.length)
      : 0;

    const atRiskStudents = recentMetrics.filter(r => r[10] === 'at_risk' || r[10] === 'critical');
    const atRiskRate = totalStudents > 0 ? Math.round((atRiskStudents.length / totalStudents) * 100) : 0;

    const cohortLogs = progressLogRows.filter(r => r[1] && studentIds.has(r[1]));
    const interviews = cohortLogs.filter(r => r[4] === 'Interview Call');
    const interviewVolumePerStudent = totalStudents > 0
      ? Math.round((interviews.length / totalStudents) * 10) / 10
      : 0;

    const avgDaysToPlacement = 0;

    return {
      dimension: dim!,
      value: dimensionValue,
      totalStudents,
      activeStudents: activeStudents.length,
      placedStudents: placedStudents.length,
      hiredStudents: hiredStudents.length,
      placementRate,
      hireRate,
      avgPrsScore,
      atRiskRate,
      interviewVolumePerStudent,
      avgDaysToPlacement,
    };
  }

  const aMetrics = computeCohortMetrics(a);
  const bMetrics = computeCohortMetrics(b);

  const comparison: ComparisonResult['comparison'] = [
    {
      metric: 'placementRate',
      aValue: aMetrics.placementRate,
      bValue: bMetrics.placementRate,
      delta: aMetrics.placementRate - bMetrics.placementRate,
      deltaPercent: bMetrics.placementRate > 0
        ? Math.round(((aMetrics.placementRate - bMetrics.placementRate) / bMetrics.placementRate) * 100)
        : 0,
    },
    {
      metric: 'hireRate',
      aValue: aMetrics.hireRate,
      bValue: bMetrics.hireRate,
      delta: aMetrics.hireRate - bMetrics.hireRate,
      deltaPercent: bMetrics.hireRate > 0
        ? Math.round(((aMetrics.hireRate - bMetrics.hireRate) / bMetrics.hireRate) * 100)
        : 0,
    },
    {
      metric: 'avgPrsScore',
      aValue: aMetrics.avgPrsScore,
      bValue: bMetrics.avgPrsScore,
      delta: aMetrics.avgPrsScore - bMetrics.avgPrsScore,
      deltaPercent: bMetrics.avgPrsScore > 0
        ? Math.round(((aMetrics.avgPrsScore - bMetrics.avgPrsScore) / bMetrics.avgPrsScore) * 100)
        : 0,
    },
    {
      metric: 'atRiskRate',
      aValue: aMetrics.atRiskRate,
      bValue: bMetrics.atRiskRate,
      delta: aMetrics.atRiskRate - bMetrics.atRiskRate,
      deltaPercent: bMetrics.atRiskRate > 0
        ? Math.round(((aMetrics.atRiskRate - bMetrics.atRiskRate) / bMetrics.atRiskRate) * 100)
        : 0,
    },
    {
      metric: 'interviewVolumePerStudent',
      aValue: aMetrics.interviewVolumePerStudent,
      bValue: bMetrics.interviewVolumePerStudent,
      delta: aMetrics.interviewVolumePerStudent - bMetrics.interviewVolumePerStudent,
      deltaPercent: bMetrics.interviewVolumePerStudent > 0
        ? Math.round(((aMetrics.interviewVolumePerStudent - bMetrics.interviewVolumePerStudent) / bMetrics.interviewVolumePerStudent) * 100)
        : 0,
    },
  ];

  return NextResponse.json({ a: aMetrics, b: bMetrics, comparison });
}