import { differenceInDays, subDays, format } from 'date-fns';
import type { AttendanceLog, ProgressLog, RiskLevel, RiskScore, Student } from '@/types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDate(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysSince(value?: string): number {
  const date = parseDate(value);
  if (!date) return 999;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / MS_PER_DAY));
}

function levelFromScore(score: number): RiskLevel {
  if (score > 50) return 'high';
  if (score > 25) return 'medium';
  return 'safe';
}

function actionForFactor(factor: string): string {
  if (factor.startsWith('Attendance')) return 'Schedule check-in call · Send attendance reminder';
  if (factor.startsWith('Stage')) return 'Review job applications · Update CV';
  if (factor.startsWith('No interviews') || factor.startsWith('Interview')) return 'Mock interview session recommended';
  if (factor.startsWith('No mentor')) return 'Reach out immediately';
  if (factor.startsWith('Inactive')) return 'Schedule follow-up and update activity plan';
  if (factor.startsWith('Assignment')) return 'Review blockers and assign recovery plan';
  return 'Review student profile and create follow-up task';
}

export function calculateRiskScore(
  student: Student,
  attendance: AttendanceLog[] = [],
  progressLogs: ProgressLog[] = [],
  now = new Date()
): RiskScore {
  const relevantAttendance = attendance.filter((log) => log.student_id === student.id);
  const relevantProgress = progressLogs.filter((log) => log.student_id === student.id);

  const presentCount = relevantAttendance.filter((log) => log.present || log.status_label?.toLowerCase() === 'present').length;
  const attendanceRate = relevantAttendance.length ? (presentCount / relevantAttendance.length) * 100 : 100;
  let attendanceScore = 0;
  if (attendanceRate < 60) attendanceScore = 25;
  else if (attendanceRate < 75) attendanceScore = 15;
  else if (attendanceRate < 90) attendanceScore = 8;

  const inactiveDays = daysSince(student.last_activity_date || student.updated_at || student.created_at);
  let inactivityScore = 0;
  if (inactiveDays > 30) inactivityScore = 20;
  else if (inactiveDays > 14) inactivityScore = 12;
  else if (inactiveDays > 7) inactivityScore = 5;

  const stageAgeDays = daysSince(student.updated_at || student.created_at);
  let stageScore = 0;
  if (stageAgeDays > 60) stageScore = 20;
  else if (stageAgeDays > 30) stageScore = 10;
  else if (stageAgeDays > 14) stageScore = 5;

  const interviewLogs = relevantProgress.filter((log) => log.log_type === 'Interview Call' || log.log_type === 'Mock Interview');
  const applicationStageDays = ['applying', 'interviewing'].includes(student.stage) ? stageAgeDays : 0;
  const interviewCount = student.interview_count ?? interviewLogs.length;
  let interviewScore = 0;
  if (student.stage === 'applying' && applicationStageDays > 30 && interviewCount === 0) {
    interviewScore = 15;
  } else {
    const rejectionNotes = interviewLogs.filter((log) => /reject|failed|not selected/i.test(log.note || '')).length;
    if (interviewLogs.length >= 3 && rejectionNotes / interviewLogs.length > 0.7) interviewScore = 10;
  }

  const assignment = student.assignment_completion_pct ?? 100;
  let assignmentScore = 0;
  if (assignment < 50) assignmentScore = 10;
  else if (assignment < 75) assignmentScore = 5;

  const noteDates = relevantProgress
    .filter((log) => log.note)
    .map((log) => parseDate(log.logged_at || log.scheduled_date))
    .filter((date): date is Date => Boolean(date))
    .sort((a, b) => b.getTime() - a.getTime());
  const lastContact = noteDates[0] ?? parseDate(student.updated_at) ?? parseDate(student.last_activity_date);
  const contactGap = lastContact ? differenceInDays(now, lastContact) : 999;
  let communicationScore = 0;
  if (contactGap > 21) communicationScore = 10;
  else if (contactGap > 14) communicationScore = 5;

  const factors = {
    attendance: attendanceScore,
    inactivity: inactivityScore,
    stage_stagnation: stageScore,
    interview_progress: interviewScore,
    assignment_completion: assignmentScore,
    communication_gap: communicationScore,
  };

  const score = Math.min(100, Object.values(factors).reduce((sum, value) => sum + value, 0));
  const top = Object.entries(factors).sort((a, b) => b[1] - a[1])[0];
  let topFactor = 'Healthy activity';
  if (top?.[1]) {
    const key = top[0];
    if (key === 'attendance') topFactor = `Attendance ${Math.round(attendanceRate)}%`;
    if (key === 'inactivity') topFactor = `Inactive ${inactiveDays} days`;
    if (key === 'stage_stagnation') topFactor = `Stage stuck ${stageAgeDays} days`;
    if (key === 'interview_progress') topFactor = interviewCount === 0 ? `No interviews in ${applicationStageDays} days` : 'Interview fail rate high';
    if (key === 'assignment_completion') topFactor = `Assignment ${Math.round(assignment)}%`;
    if (key === 'communication_gap') topFactor = `No mentor contact ${contactGap} days`;
  }

  const overrideActive = student.risk_override_level &&
    student.risk_override_expires_at &&
    parseDate(student.risk_override_expires_at) &&
    parseDate(student.risk_override_expires_at)!.getTime() > now.getTime();

  const calculatedLevel = levelFromScore(score);
  return {
    student_id: student.id,
    score,
    level: overrideActive ? (student.risk_override_level as RiskLevel) : calculatedLevel,
    top_factor: topFactor,
    recommended_action: actionForFactor(topFactor),
    factors,
    calculated_at: now.toISOString(),
    manual_override: overrideActive
      ? {
          level: student.risk_override_level as RiskLevel,
          note: student.risk_override_note || '',
          expires_at: student.risk_override_expires_at || '',
        }
      : undefined,
  };
}

export function buildRiskTrend(students: Student[], attendance: AttendanceLog[], progressLogs: ProgressLog[]) {
  return Array.from({ length: 8 }).map((_, index) => {
    const weekDate = subDays(new Date(), (7 - index) * 7);
    const counts = { week: format(weekDate, 'MMM d'), safe: 0, medium: 0, high: 0 };
    for (const student of students) {
      const score = calculateRiskScore(student, attendance, progressLogs, weekDate);
      counts[score.level] += 1;
    }
    return counts;
  });
}
