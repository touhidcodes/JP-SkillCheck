import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isNotificationType } from '@/lib/sheets/notifications';
import { evaluateStudentRisk, daysSince } from '@/lib/risk/engine';
import type { Student, AttendanceLog, ProgressLog } from '@/types';

// Mock dependecies
vi.mock('@/lib/sheets/client', () => ({
  readSheet: vi.fn(),
  appendRow: vi.fn(),
  updateRow: vi.fn(),
}));

vi.mock('@/lib/sheets/students', () => ({
  getAllStudents: vi.fn(),
  updateStudent: vi.fn(),
}));

vi.mock('@/lib/sheets/risk-history', () => ({
  appendRiskHistoryEntry: vi.fn(),
  resolveRiskHistoryEntry: vi.fn(),
}));

vi.mock('@/lib/sheets/notifications', () => ({
  createNotification: vi.fn(),
  isNotificationType: (type: string) => [
    'risk_alert',
    'risk_resolved',
    'task_due',
    'stage_changed',
    'mentor_update_reminder',
    'attendance_alert',
    'action_required',
    'system_message',
    'mentor_at_risk',
    'mentor_needs_support',
    'mentor_kpi_achieved',
    'mentor_kpi_failed',
    'mentor_kpi_behind',
    'student_inactivity',
    'student_attendance_drop',
    'student_progress_decline',
  ].includes(type),
}));

vi.mock('@/lib/sheets/users', () => ({
  getAllUsers: vi.fn(),
}));

vi.mock('@/lib/security/webhook', () => ({
  sendRiskAlertWebhook: vi.fn(),
  sendRiskResolvedWebhook: vi.fn(),
}));

describe('Notification Type Safety & Schemas', () => {
  it('identifies valid notification types correctly', () => {
    expect(isNotificationType('mentor_at_risk')).toBe(true);
    expect(isNotificationType('student_inactivity')).toBe(true);
    expect(isNotificationType('student_progress_decline')).toBe(true);
    expect(isNotificationType('mentor_kpi_achieved')).toBe(true);
    expect(isNotificationType('invalid_type')).toBe(false);
  });
});

describe('Student Inactivity & Attendance Risk Triggers', () => {
  const baseStudent: Student = {
    id: 'student-1',
    name: 'Alice Johnson',
    batch: 'Cohort 8',
    project: 'Endgame',
    mentor_email: 'mentor@example.com',
    stage: 'learning',
    risk_status: 'safe',
    risk_reasons: '',
    last_activity_date: new Date().toISOString(),
    job_focus: 'remote',
    terminated: false,
    hired: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    experience: 'fresher',
  };

  it('detects unexcused consecutive absences risk', () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const attendance: AttendanceLog[] = [
      { id: '1', student_id: 'student-1', date: today.toISOString(), present: false, logged_by: 'mentor@example.com', excuse: '' },
      { id: '2', student_id: 'student-1', date: yesterday.toISOString(), present: false, logged_by: 'mentor@example.com', excuse: '' },
    ];
    const risk = evaluateStudentRisk(baseStudent, attendance, []);
    expect(risk.is_at_risk).toBe(true);
    expect(risk.reasons).toContain('absent_2_consecutive_days');
  });

  it('ignores consecutive absences if they are excused', () => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const attendance: AttendanceLog[] = [
      { id: '1', student_id: 'student-1', date: today.toISOString(), present: false, logged_by: 'mentor@example.com', excuse: 'sick' },
      { id: '2', student_id: 'student-1', date: yesterday.toISOString(), present: false, logged_by: 'mentor@example.com', excuse: '' },
    ];
    const risk = evaluateStudentRisk(baseStudent, attendance, []);
    expect(risk.is_at_risk).toBe(false);
  });

  it('detects long inactivity when no progress logs exist and created_at is old', () => {
    const oldStudent = {
      ...baseStudent,
      created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    };
    const risk = evaluateStudentRisk(oldStudent, [], []);
    expect(risk.is_at_risk).toBe(true);
    expect(risk.reasons).toContain('no_progress_update_7_days');
  });

  it('detects long inactivity from last progress log date', () => {
    const progress: ProgressLog[] = [
      {
        id: '1',
        student_id: 'student-1',
        student_name: 'Alice Johnson',
        student_email: 'alice@student.com',
        log_type: 'Other',
        company_name: '',
        scheduled_date: '',
        scheduled_time: '',
        note: 'Doing okay',
        logged_at: new Date(Date.now() - 9 * 86400000).toISOString(),
        logged_by: 'mentor@example.com',
      }
    ];
    const risk = evaluateStudentRisk(baseStudent, [], progress);
    expect(risk.is_at_risk).toBe(true);
    expect(risk.reasons).toContain('no_progress_update_7_days');
  });
});
