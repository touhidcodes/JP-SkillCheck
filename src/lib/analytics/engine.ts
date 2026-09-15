/**
 * WHY this file exists:
 * Encapsulates all analytics computation logic in a single, independently-testable
 * module. The API route handler is ONLY responsible for: auth, cache check,
 * response serialization, and error handling.
 *
 * This separation means the analytics logic can be:
 * 1. Called from the cron job to pre-compute daily_metrics
 * 2. Called from the on-demand API when cache is stale
 * 3. Unit tested without making any API calls
 *
 * Performance strategy: Read each sheet exactly once, build in-memory indexes
 * (Map objects), then compute all metrics in a single pass over the data.
 * This turns O(sheets × reads) into O(sheets) reads + O(n) in-memory work.
 */

import { readSheet } from '@/lib/sheets/client';
import type { Student, ProgressLog, PlacementStats } from '@/types';
import type { StudentStage, RiskStatus } from '@/types';
import { subDays, format, eachWeekOfInterval, endOfWeek, differenceInDays } from 'date-fns';

// ---------------------------------------------------------------------------
// Raw row mappers (same logic as in lib/sheets/, but centralized here to avoid
// circular imports. In a Prisma world, these would be unnecessary.
// ---------------------------------------------------------------------------

function rowToStudentRaw(row: string[]): Student {
  return {
    id: row[0] || '',
    name: row[1] || '',
    batch: row[2] || '',
    project: (row[3] || '') as Student['project'],
    mentor_email: row[4] || '',
    student_email: row[5] || '',
    stage: (row[6] || 'learning') as StudentStage,
    risk_status: (row[7] || 'safe') as RiskStatus,
    risk_reasons: row[8] || '',
    last_activity_date: row[9] || '',
    job_focus: (row[10] || '') as Student['job_focus'],
    terminated: row[11] === 'true',
    hired: row[12] === 'true',
    experience: (row[13] || '') as Student['experience'],
    created_at: row[14] || '',
    updated_at: row[15] || '',
  };
}

function rowToProgressLogRaw(row: string[]): ProgressLog {
  return {
    id: row[0] || '',
    student_id: row[1] || '',
    student_name: row[2] || '',
    student_email: row[3] || '',
    log_type: (row[4] || 'Other') as ProgressLog['log_type'],
    company_name: row[5] || '',
    scheduled_date: row[6] || '',
    scheduled_time: row[7] || '',
    note: row[8] || '',
    logged_at: row[9] || '',
    logged_by: row[10] || '',
    job_url: row[11] || '',
    mock_feedback: row[12] || '',
  };
}



// ---------------------------------------------------------------------------
// Computed types
// ---------------------------------------------------------------------------

export interface FunnelEntry {
  stage: string;
  label: string;
  count: number;
  dropoffPct: number;
}

export interface CohortEntry {
  batch: string;
  total: number;
  active: number;
  placed: number;
  hired: number;
  placementRate: number;
  hireRate: number;
  learning: number;
  applying: number;
  interviewing: number;
  offer_pending: number;
}

export interface MentorEntry {
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
  activityScore: number;
}

export interface CompanyEntry {
  company: string;
  interviewCount: number;
  offerCount: number;
  hiredCount: number;
  students: string[];
}

export interface TrendEntry {
  week: string;
  weekStart: string;
  placements: number;
  atRisk: number;
  activeCount: number;
  learning: number;
  applying: number;
  interviewing: number;
  offer_pending: number;
  placed: number;
  hired: number;
}

export interface AnalyticsOverview {
  funnel: {
    entries: FunnelEntry[];
    totalInPipeline: number;
    totalPlaced: number;
    totalHired: number;
  };
  cohort: CohortEntry[];
  mentors: MentorEntry[];
  companies: CompanyEntry[];
  trends: TrendEntry[];
  weeklyAverages: {
    placementsPerWeek: number;
    atRiskPerWeek: number;
  };
  generatedAt: string; // ISO8601
  computationMs: number;
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

/**
 * Compute all analytics from raw sheet data in a single pass per metric type.
 * This is the ONLY function that touches the Sheets API for analytics.
 * Everything else is pure transformation of the already-read data.
 */
export async function computeAnalyticsOverview(): Promise<AnalyticsOverview> {
  const start = Date.now();

  // --- Read all sheets once ---
  const [studentRows, progressRows] = await Promise.all([
    readSheet('students'),
    readSheet('progress_logs'),
  ]);

  const students = studentRows.map(rowToStudentRaw).filter(s => s.id);
  const logs = progressRows.map(rowToProgressLogRaw).filter(l => l.id);

  // --- Build indexes (single-pass, O(n)) ---
  const studentMentorMap = new Map(students.map(s => [s.id, s.mentor_email]));
  const studentNameMap = new Map(students.map(s => [s.id, s.name]));
  const logsByStudent = new Map<string, ProgressLog[]>();
  for (const log of logs) {
    const list = logsByStudent.get(log.student_id) ?? [];
    list.push(log);
    logsByStudent.set(log.student_id, list);
  }

  // --- 1. Funnel ---
  const stats: PlacementStats = {
    learning: 0, applying: 0, interviewing: 0,
    offer_pending: 0, placed: 0, hired: 0,
  };
  for (const s of students) {
    if (s.stage in stats) {
      (stats as unknown as Record<string, number>)[s.stage]++;
    }
  }

  const entries: FunnelEntry[] = Object.entries(stats).map(([stage, count]) => ({
    stage,
    label: stage.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
    count,
    dropoffPct: 0, // fill below
  }));

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const prev = i === 0 ? students.length : entries[i - 1].count;
    entry.dropoffPct = prev > 0 ? Math.round(((prev - entry.count) / prev) * 100) : 0;
  }

  const totalInPipeline = stats.learning + stats.applying + stats.interviewing + stats.offer_pending + stats.placed;

  // --- 2. Cohort ---
  const batchMap = new Map<string, CohortEntry>();
  for (const s of students) {
    const batch = s.batch || 'Unknown';
    if (!batchMap.has(batch)) {
      batchMap.set(batch, {
        batch, total: 0, active: 0, placed: 0, hired: 0,
        placementRate: 0, hireRate: 0,
        learning: 0, applying: 0, interviewing: 0, offer_pending: 0,
      });
    }
    const e = batchMap.get(batch)!;
    e.total++;
    if (s.hired) { e.hired++; e.placed++; e.active++; }
    else if (s.stage === 'placed') { e.placed++; e.active++; }
    else if (!s.terminated) { e.active++; }
    if (s.stage === 'learning') e.learning++;
    if (s.stage === 'applying') e.applying++;
    if (s.stage === 'interviewing') e.interviewing++;
    if (s.stage === 'offer_pending') e.offer_pending++;
  }

  const cohort = Array.from(batchMap.values())
    .map(e => ({
      ...e,
      placementRate: e.total > 0 ? Math.round((e.placed / e.total) * 100) : 0,
      hireRate: e.total > 0 ? Math.round((e.hired / e.total) * 100) : 0,
    }))
    .sort((a, b) => a.batch.localeCompare(b.batch));

  // --- 3. Mentor scorecard ---
  const mentorMap = new Map<string, MentorEntry>();

  // First pass: student counts
  for (const s of students) {
    if (!s.mentor_email) continue;
    if (!mentorMap.has(s.mentor_email)) {
      mentorMap.set(s.mentor_email, {
        email: s.mentor_email,
        name: s.mentor_email.split('@')[0],
        totalMentees: 0, activeMentees: 0, placed: 0, hired: 0,
        atRisk: 0, interviewsThisMonth: 0, logsThisMonth: 0,
        avgDaysToPlacement: 0, activityScore: 0,
      });
    }
    const m = mentorMap.get(s.mentor_email)!;
    m.totalMentees++;
    if (!s.terminated) m.activeMentees++;
    if (s.hired) { m.hired++; m.placed++; }
    else if (s.stage === 'placed') m.placed++;
    if (s.risk_status === 'at_risk') m.atRisk++;
  }

  // Second pass: log activity
  const monthAgo = subDays(new Date(), 30);
  const placementTimes: Map<string, number[]> = new Map();

  for (const log of logs) {
    const mentor = studentMentorMap.get(log.student_id);
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
      const student = students.find(s => s.id === log.student_id);
      if (student?.hired && student?.created_at) {
        try {
          const days = differenceInDays(new Date(log.logged_at), new Date(student.created_at));
          const times = placementTimes.get(mentor) ?? [];
          times.push(days);
          placementTimes.set(mentor, times);
        } catch { /* skip */ }
      }
    }
  }

  // Third pass: averages
  for (const m of Array.from(mentorMap.values())) {
    const times = placementTimes.get(m.email) ?? [];
    if (times.length > 0) {
      m.avgDaysToPlacement = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    }
    const activeWithActivity = students.filter(
      s => s.mentor_email === m.email && !s.terminated && s.last_activity_date
    );
    const totalDays = activeWithActivity.reduce((sum, s) => {
      try {
        return sum + Math.max(0, differenceInDays(new Date(), new Date(s.last_activity_date)));
      } catch { return sum; }
    }, 0);
    m.activityScore = m.activeMentees > 0
      ? Math.max(0, 100 - Math.round(totalDays / m.activeMentees))
      : 0;
  }

  const mentors = Array.from(mentorMap.values()).sort((a, b) => b.placed - a.placed);

  // --- 4. Companies ---
  const companyMap = new Map<string, CompanyEntry>();
  const offerLogs = logs.filter(l => l.log_type === 'Offer');
  const interviewLogs = logs.filter(l => l.log_type === 'Interview Call');

  for (const log of offerLogs) {
    const company = log.company_name || 'Unknown';
    if (!companyMap.has(company)) {
      companyMap.set(company, { company, interviewCount: 0, offerCount: 0, hiredCount: 0, students: [] });
    }
    const e = companyMap.get(company)!;
    e.offerCount++;
    const name = log.student_name || studentNameMap.get(log.student_id) || 'Unknown';
    if (!e.students.includes(name)) e.students.push(name);
  }

  for (const log of interviewLogs) {
    const company = log.company_name || 'Unknown';
    if (!companyMap.has(company)) {
      companyMap.set(company, { company, interviewCount: 0, offerCount: 0, hiredCount: 0, students: [] });
    }
    companyMap.get(company)!.interviewCount++;
  }

  for (const student of students) {
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

  const companies = Array.from(companyMap.values())
    .filter(c => c.offerCount > 0 || c.interviewCount > 0)
    .sort((a, b) => b.interviewCount - a.interviewCount)
    .slice(0, 20);

  // --- 5. Trends (8-week) ---
  const now = new Date();
  const eightWeeksAgo = subDays(now, 56);
  const weeks = eachWeekOfInterval({ start: eightWeeksAgo, end: now }, { weekStartsOn: 1 });

  const activeStudents = students.filter(s => !s.terminated);

  const trends: TrendEntry[] = weeks.map(weekStart => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd');

    const newPlacements = offerLogs.filter(log => {
      try {
        const d = log.logged_at;
        return d >= weekStartStr && d <= weekEndStr;
      } catch { return false; }
    }).length;

    const atRiskCount = activeStudents.filter(s => {
      try {
        const last = s.last_activity_date;
        if (!last) return false;
        return last <= weekEndStr;
      } catch { return false; }
    }).length;

    const counts = { learning: 0, applying: 0, interviewing: 0, offer_pending: 0, placed: 0, hired: 0 };
    for (const s of activeStudents) {
      if (s.stage in counts) counts[s.stage as keyof typeof counts]++;
    }

    return {
      week: format(weekStart, 'MMM d'),
      weekStart: weekStartStr,
      placements: newPlacements,
      atRisk: atRiskCount,
      activeCount: activeStudents.length,
      ...counts,
    };
  });

  const totalPlacements = trends.reduce((s, w) => s + w.placements, 0);
  const totalAtRisk = trends.reduce((s, w) => s + w.atRisk, 0);

  return {
    funnel: {
      entries,
      totalInPipeline,
      totalPlaced: stats.placed + stats.hired,
      totalHired: stats.hired,
    },
    cohort,
    mentors,
    companies,
    trends,
    weeklyAverages: {
      placementsPerWeek: weeks.length > 0 ? Math.round(totalPlacements / weeks.length) : 0,
      atRiskPerWeek: weeks.length > 0 ? Math.round(totalAtRisk / weeks.length) : 0,
    },
    generatedAt: new Date().toISOString(),
    computationMs: Date.now() - start,
  };
}