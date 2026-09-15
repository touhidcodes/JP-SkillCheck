/**
 * GET /api/manager/oversight
 *
 * Returns comprehensive mentor oversight data for managers.
 * Includes mentor activity, gaps, bottlenecks, and recommendations.
 */

import { NextResponse } from 'next/server';
import { getAllStudents } from '@/lib/sheets/students';
import { getAllProgressLogs } from '@/lib/sheets/progress-logs';
import { getAllUsers } from '@/lib/sheets/users';
import { readSheet } from '@/lib/sheets/client';
import { requireRole } from '@/lib/auth/helpers';
import type { ApiError } from '@/lib/auth/helpers';
import type { AttendanceLog, ProgressLog } from '@/types';
import { subDays, parseISO, differenceInDays } from 'date-fns';

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'status' in e;
}

function rowToAttendanceLog(row: string[]): AttendanceLog {
  return {
    id: row[0] || '',
    student_id: row[1] || '',
    date: row[2] || '',
    present: row[3] === 'true',
    logged_by: row[4] || '',
    session_label: row[5] || '',
    excuse: (row[6] || '') as import('@/types').AbsenceExcuse | '',
    excuse_note: row[7] || '',
  };
}

interface MentorOversight {
  mentor_email: string;
  mentor_name: string;
  is_active: boolean;
  total_students: number;
  active_students: number;
  hired_students: number;
  at_risk_students: number;
  terminated_students: number;
  last_activity_date: string | null;
  days_since_last_activity: number | null;
  activity_level: 'high' | 'medium' | 'low' | 'inactive';
  recent_logs_count: number;
  interviews_last_30d: number;
  tasks_last_30d: number;
  offers_last_30d: number;
  attendance_rate_avg: number;
  students_stuck_30d: number;
  students_stuck_60d: number;
  stage_distribution: Record<string, number>;
  risk_ratio: number;
  workload_score: number;
  needs_intervention: boolean;
  intervention_reasons: string[];
}

interface Bottleneck {
  type: 'stage_bottleneck' | 'mentor_bottleneck' | 'cohort_bottleneck';
  label: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  affected_count: number;
  details: Record<string, unknown>;
}

interface MentorshipGap {
  type: 'inactive_mentor' | 'high_risk_ratio' | 'no_recent_activity' | 'overloaded' | 'underutilized';
  mentor_email: string;
  mentor_name: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  recommendation: string;
}

interface InactiveGroup {
  label: string;
  type: 'project' | 'batch' | 'stage';
  inactive_count: number;
  total_count: number;
  inactive_pct: number;
  avg_days_inactive: number;
  students: { id: string; name: string; mentor_email: string; last_activity: string }[];
}

export async function GET(request: Request) {
  try {
    requireRole(request.headers, ['manager']);
    const { searchParams } = new URL(request.url);
    const periodDays = parseInt(searchParams.get('days') ?? '30', 10);

    const [allStudents, allProgressLogs, attendanceRows, allUsers] = await Promise.all([
      getAllStudents(),
      getAllProgressLogs(),
      readSheet('attendance_logs'),
      getAllUsers(),
      readSheet('mentor_tasks'),
    ]);

    const mentorNameMap = new Map<string, string>();
    // Only include active, real mentor accounts (excludes test/demo accounts like mentor1, mentor2, etc.)
    const activeMentorEmails = new Set<string>();
    const testAccountPattern = /^mentor\d+(@|$)/i;
    for (const u of allUsers) {
      if (u.role === 'mentor' && u.active && !testAccountPattern.test(u.name.trim()) && !testAccountPattern.test(u.email)) {
        mentorNameMap.set(u.email, u.name);
        activeMentorEmails.add(u.email);
      }
    }

    const allAttendance: AttendanceLog[] = attendanceRows
      .map(rowToAttendanceLog)
      .filter(l => l.id);

    const now = new Date();
    const thirtyDaysAgo = subDays(now, 30);
    const periodStart = subDays(now, periodDays);

    // Index data
    const logsByStudent = new Map<string, ProgressLog[]>();
    for (const log of allProgressLogs) {
      const arr = logsByStudent.get(log.student_id) ?? [];
      arr.push(log);
      logsByStudent.set(log.student_id, arr);
    }

    const attendanceByStudent = new Map<string, AttendanceLog[]>();
    for (const log of allAttendance) {
      const arr = attendanceByStudent.get(log.student_id) ?? [];
      arr.push(log);
      attendanceByStudent.set(log.student_id, arr);
    }

    // Group students by mentor — only for active, registered mentors
    const studentsByMentor = new Map<string, typeof allStudents>();
    for (const s of allStudents) {
      if (!activeMentorEmails.has(s.mentor_email)) continue;
      const arr = studentsByMentor.get(s.mentor_email) ?? [];
      arr.push(s);
      studentsByMentor.set(s.mentor_email, arr);
    }

    // ── Build mentor oversight data ──────────────────────────────────────
    const mentorOversight: MentorOversight[] = [];

    for (const [email, students] of Array.from(studentsByMentor.entries())) {
      const mentorName = mentorNameMap.get(email) || email.split('@')[0];
      const studentIds = new Set(students.map((s: import('@/types').Student) => s.id));

      const activeStudents = students.filter((s: import('@/types').Student) => !s.terminated && !s.hired);
      const hiredStudents = students.filter((s: import('@/types').Student) => s.hired);
      const atRiskStudents = students.filter((s: import('@/types').Student) => s.risk_status === 'at_risk' && !s.terminated);
      const terminatedStudents = students.filter((s: import('@/types').Student) => s.terminated);

      // Recent activity from progress logs
      const mentorLogs = allProgressLogs.filter(l => studentIds.has(l.student_id));
      const recentLogs = mentorLogs.filter(l => {
        if (!l.scheduled_date) return false;
        try {
          return parseISO(l.scheduled_date.substring(0, 10)) >= periodStart;
        } catch { return false; }
      });

      const interviewsLast30d = mentorLogs.filter(l => {
        if (l.log_type !== 'Interview Call' || !l.scheduled_date) return false;
        try { return parseISO(l.scheduled_date.substring(0, 10)) >= thirtyDaysAgo; } catch { return false; }
      }).length;

      const tasksLast30d = mentorLogs.filter(l => {
        if (l.log_type !== 'Job Task' || !l.scheduled_date) return false;
        try { return parseISO(l.scheduled_date.substring(0, 10)) >= thirtyDaysAgo; } catch { return false; }
      }).length;

      const offersLast30d = mentorLogs.filter(l => {
        if (l.log_type !== 'Offer' || !l.scheduled_date) return false;
        try { return parseISO(l.scheduled_date.substring(0, 10)) >= thirtyDaysAgo; } catch { return false; }
      }).length;

      // Last activity date across all students
      let lastActivityDate: string | null = null;
      let maxDaysSinceActivity: number | null = null;
      for (const s of students) {
        if (s.last_activity_date) {
          try {
            const days = differenceInDays(now, parseISO(s.last_activity_date.substring(0, 10)));
            if (maxDaysSinceActivity === null || days > maxDaysSinceActivity) {
              maxDaysSinceActivity = days;
              lastActivityDate = s.last_activity_date;
            }
          } catch { /* skip */ }
        }
      }

      // Attendance rate
      let totalAttRate = 0;
      let studentsWithAtt = 0;
      for (const s of activeStudents) {
        const attLogs = (attendanceByStudent.get(s.id) ?? []).filter(l => {
          try { return parseISO(l.date.substring(0, 10)) >= periodStart; } catch { return false; }
        });
        if (attLogs.length > 0) {
          totalAttRate += (attLogs.filter(l => l.present).length / attLogs.length) * 100;
          studentsWithAtt++;
        }
      }
      const avgAttendanceRate = studentsWithAtt > 0 ? Math.round(totalAttRate / studentsWithAtt) : 0;

      // Students stuck (no activity in 30/60 days)
      const stuck30d = activeStudents.filter((s: import('@/types').Student) => {
        if (!s.last_activity_date) return true;
        try {
          return differenceInDays(now, parseISO(s.last_activity_date.substring(0, 10))) >= 30;
        } catch { return false; }
      }).length;

      const stuck60d = activeStudents.filter((s: import('@/types').Student) => {
        if (!s.last_activity_date) return true;
        try {
          return differenceInDays(now, parseISO(s.last_activity_date.substring(0, 10))) >= 60;
        } catch { return false; }
      }).length;

      // Stage distribution
      const stageDist: Record<string, number> = {};
      for (const s of students) {
        stageDist[s.stage] = (stageDist[s.stage] || 0) + 1;
      }

      // Risk ratio
      const riskRatio = activeStudents.length > 0
        ? Math.round((atRiskStudents.length / activeStudents.length) * 100)
        : 0;

      // Workload score (0-100, higher = more burdened)
      const workloadScore = Math.min(100, Math.round(
        (activeStudents.length / 15) * 40 +
        (riskRatio / 100) * 30 +
        (stuck30d / Math.max(1, activeStudents.length)) * 30
      ));

      // Activity level
      let activityLevel: 'high' | 'medium' | 'low' | 'inactive';
      if (recentLogs.length >= 10) activityLevel = 'high';
      else if (recentLogs.length >= 4) activityLevel = 'medium';
      else if (recentLogs.length >= 1) activityLevel = 'low';
      else activityLevel = 'inactive';

      // Needs intervention?
      const interventionReasons: string[] = [];
      if (riskRatio > 40) interventionReasons.push(`${riskRatio}% students at risk`);
      if (stuck60d > 0) interventionReasons.push(`${stuck60d} students inactive 60+ days`);
      if (activityLevel === 'inactive' && activeStudents.length > 0) interventionReasons.push('No mentor activity this period');
      if (avgAttendanceRate > 0 && avgAttendanceRate < 50) interventionReasons.push(`Low attendance (${avgAttendanceRate}%)`);
      if (activeStudents.length > 12) interventionReasons.push(`Overloaded (${activeStudents.length} active students)`);

      mentorOversight.push({
        mentor_email: email,
        mentor_name: mentorName,
        is_active: activityLevel !== 'inactive',
        total_students: students.length,
        active_students: activeStudents.length,
        hired_students: hiredStudents.length,
        at_risk_students: atRiskStudents.length,
        terminated_students: terminatedStudents.length,
        last_activity_date: lastActivityDate,
        days_since_last_activity: maxDaysSinceActivity,
        activity_level: activityLevel,
        recent_logs_count: recentLogs.length,
        interviews_last_30d: interviewsLast30d,
        tasks_last_30d: tasksLast30d,
        offers_last_30d: offersLast30d,
        attendance_rate_avg: avgAttendanceRate,
        students_stuck_30d: stuck30d,
        students_stuck_60d: stuck60d,
        stage_distribution: stageDist,
        risk_ratio: riskRatio,
        workload_score: workloadScore,
        needs_intervention: interventionReasons.length > 0,
        intervention_reasons: interventionReasons,
      });
    }

    // Sort by workload score (highest first)
    mentorOversight.sort((a, b) => b.workload_score - a.workload_score);

    // ── Identify bottlenecks ─────────────────────────────────────────────
    const bottlenecks: Bottleneck[] = [];

    // Stage bottlenecks: stages where students are stuck
    const stageStuckCounts: Record<string, number> = {};
    for (const s of allStudents) {
      if (s.terminated || s.hired) continue;
      if (!s.last_activity_date) {
        stageStuckCounts[s.stage] = (stageStuckCounts[s.stage] || 0) + 1;
        continue;
      }
      try {
        const days = differenceInDays(now, parseISO(s.last_activity_date.substring(0, 10)));
        if (days >= 30) {
          stageStuckCounts[s.stage] = (stageStuckCounts[s.stage] || 0) + 1;
        }
      } catch { /* skip */ }
    }

    for (const [stage, count] of Object.entries(stageStuckCounts)) {
      if (count >= 3) {
        bottlenecks.push({
          type: 'stage_bottleneck',
          label: `${stage.replace('_', ' ')} bottleneck`,
          description: `${count} students inactive 30+ days in ${stage} stage`,
          severity: count >= 5 ? 'high' : 'medium',
          affected_count: count,
          details: { stage, count },
        });
      }
    }

    // Mentor bottlenecks: mentors with high risk ratios
    for (const m of mentorOversight) {
      if (m.risk_ratio > 30 && m.active_students >= 3) {
        bottlenecks.push({
          type: 'mentor_bottleneck',
          label: `${m.mentor_name} — high risk ratio`,
          description: `${m.risk_ratio}% of ${m.active_students} active students at risk`,
          severity: m.risk_ratio > 50 ? 'high' : 'medium',
          affected_count: m.at_risk_students,
          details: { mentor_email: m.mentor_email, risk_ratio: m.risk_ratio },
        });
      }
    }

    // ── Identify mentorship gaps ─────────────────────────────────────────
    const gaps: MentorshipGap[] = [];

    for (const m of mentorOversight) {
      if (m.activity_level === 'inactive' && m.active_students > 0) {
        gaps.push({
          type: 'inactive_mentor',
          mentor_email: m.mentor_email,
          mentor_name: m.mentor_name,
          description: `No activity in last ${periodDays} days with ${m.active_students} active students`,
          severity: m.active_students > 5 ? 'high' : 'medium',
          recommendation: m.active_students > 5
            ? 'Reassign some students to active mentors'
            : 'Schedule check-in with mentor',
        });
      }

      if (m.risk_ratio > 40) {
        gaps.push({
          type: 'high_risk_ratio',
          mentor_email: m.mentor_email,
          mentor_name: m.mentor_name,
          description: `${m.risk_ratio}% of students at risk`,
          severity: m.risk_ratio > 60 ? 'high' : 'medium',
          recommendation: 'Provide additional support or redistribute students',
        });
      }

      if (m.active_students > 12) {
        gaps.push({
          type: 'overloaded',
          mentor_email: m.mentor_email,
          mentor_name: m.mentor_name,
          description: `Managing ${m.active_students} active students`,
          severity: m.active_students > 15 ? 'high' : 'medium',
          recommendation: 'Reassign 3-5 students to underutilized mentors',
        });
      }

      if (m.active_students <= 2 && m.activity_level === 'low') {
        gaps.push({
          type: 'underutilized',
          mentor_email: m.mentor_email,
          mentor_name: m.mentor_name,
          description: `Only ${m.active_students} active students with low activity`,
          severity: 'low',
          recommendation: 'Consider assigning more students or consolidating mentorship',
        });
      }
    }

    // Sort gaps by severity
    const severityOrder = { high: 0, medium: 1, low: 2 };
    gaps.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // ── Identify inactive student groups ─────────────────────────────────
    const inactiveGroups: InactiveGroup[] = [];

    // By project
    const projectMap = new Map<string, typeof allStudents>();
    for (const s of allStudents) {
      if (s.terminated || s.hired) continue;
      const project = s.project || 'Unassigned';
      const arr = projectMap.get(project) ?? [];
      arr.push(s);
      projectMap.set(project, arr);
    }

    for (const [project, students] of Array.from(projectMap.entries())) {
      const inactive = students.filter((s: import('@/types').Student) => {
        if (!s.last_activity_date) return true;
        try {
          return differenceInDays(now, parseISO(s.last_activity_date.substring(0, 10))) >= 30;
        } catch { return true; }
      });

      if (inactive.length >= 3) {
        const avgDaysInactive = inactive.reduce((sum: number, s: import('@/types').Student) => {
          if (!s.last_activity_date) return sum + 60;
          try { return sum + differenceInDays(now, parseISO(s.last_activity_date.substring(0, 10))); } catch { return sum + 30; }
        }, 0) / inactive.length;

        inactiveGroups.push({
          label: project,
          type: 'project',
          inactive_count: inactive.length,
          total_count: students.length,
          inactive_pct: Math.round((inactive.length / students.length) * 100),
          avg_days_inactive: Math.round(avgDaysInactive),
          students: inactive.slice(0, 10).map((s: import('@/types').Student) => ({
            id: s.id,
            name: s.name,
            mentor_email: s.mentor_email,
            last_activity: s.last_activity_date || 'Never',
          })),
        });
      }
    }

    // By batch
    const batchMap = new Map<string, typeof allStudents>();
    for (const s of allStudents) {
      if (s.terminated || s.hired) continue;
      const batch = s.batch || 'Unknown';
      const arr = batchMap.get(batch) ?? [];
      arr.push(s);
      batchMap.set(batch, arr);
    }

    for (const [batch, students] of Array.from(batchMap.entries())) {
      const inactive = students.filter((s: import('@/types').Student) => {
        if (!s.last_activity_date) return true;
        try {
          return differenceInDays(now, parseISO(s.last_activity_date.substring(0, 10))) >= 30;
        } catch { return true; }
      });

      if (inactive.length >= 3) {
        const avgDaysInactive = inactive.reduce((sum: number, s: import('@/types').Student) => {
          if (!s.last_activity_date) return sum + 60;
          try { return sum + differenceInDays(now, parseISO(s.last_activity_date.substring(0, 10))); } catch { return sum + 30; }
        }, 0) / inactive.length;

        inactiveGroups.push({
          label: batch,
          type: 'batch',
          inactive_count: inactive.length,
          total_count: students.length,
          inactive_pct: Math.round((inactive.length / students.length) * 100),
          avg_days_inactive: Math.round(avgDaysInactive),
          students: inactive.slice(0, 10).map((s: import('@/types').Student) => ({
            id: s.id,
            name: s.name,
            mentor_email: s.mentor_email,
            last_activity: s.last_activity_date || 'Never',
          })),
        });
      }
    }

    inactiveGroups.sort((a, b) => b.inactive_count - a.inactive_count);

    return NextResponse.json({
      mentor_oversight: mentorOversight,
      bottlenecks,
      gaps,
      inactive_groups: inactiveGroups,
      summary: {
        total_mentors: mentorOversight.length,
        active_mentors: mentorOversight.filter(m => m.is_active).length,
        inactive_mentors: mentorOversight.filter(m => !m.is_active).length,
        total_bottlenecks: bottlenecks.length,
        high_severity_bottlenecks: bottlenecks.filter(b => b.severity === 'high').length,
        total_gaps: gaps.length,
        high_severity_gaps: gaps.filter(g => g.severity === 'high').length,
        inactive_groups_count: inactiveGroups.length,
        total_inactive_students: new Set(inactiveGroups.flatMap(g => g.students.map(s => s.id))).size,
      },
    });
  } catch (e) {
    const status = isApiError(e) ? e.status : 500;
    const message = isApiError(e) ? e.message : 'Internal server error';
    return NextResponse.json({ message }, { status });
  }
}
