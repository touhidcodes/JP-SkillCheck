/**
 * WHY this file exists:
 * Manages structured warnings issued to students. Warnings are a formal
 * intermediate step between informal Discord messages and full termination.
 *
 * A structured warning system is critical for BOTH operations and legal
 * defensibility because:
 *
 * 1. FORMAL RECORD: When a student's performance declines, the first formal
 *    intervention should be a written warning. This creates an immutable
 *    timestamped record that the program took reasonable steps to address
 *    the issue before termination.
 *
 * 2. LEGAL DEFENSIBILITY: If a terminated student challenges their termination,
 *    having a documented warning trail (warning issued → student acknowledged
 *    → issue not resolved → termination) demonstrates procedurally fair
 *    process. Without warnings, termination appears arbitrary.
 *
 * 3. ESCALATION TRACKING: Each warning has a severity level (yellow/orange/red)
 *    and an age. Red warnings that remain open for >48 hours escalate to the
 *    manager automatically. This prevents issues from being ignored.
 *
 * 4. DATA-DRIVEN INTERVENTION: The severity scores enable identifying students
 *    heading toward exit before they actually exit. A pattern of escalating
 *    warnings precedes most involuntary terminations.
 *
 * 5. NO DUAL-ENTRY: Ad-hoc Discord messages about student issues disappear into
 *    chat history and are unqueryable. Structured warnings are queryable,
 *    filterable, and reportable.
 */

import { readSheet, appendRow, updateRow, findRowIndex } from './client';

export type WarningSeverity = 'yellow' | 'orange' | 'red';
export type WarningStatus = 'open' | 'resolved';

export interface Warning {
  id: string;
  student_id: string;
  student_name: string;
  mentor_email: string;
  severity: WarningSeverity;
  reason: string;
  evidence_notes: string;
  status: WarningStatus;
  created_at: string;
  created_by: string;
  resolved_at: string;
  resolved_by: string;
  resolution_notes: string;
}

function rowToWarning(row: string[]): Warning {
  return {
    id: row[0] || '',
    student_id: row[1] || '',
    student_name: row[2] || '',
    mentor_email: row[3] || '',
    severity: (row[4] || 'yellow') as WarningSeverity,
    reason: row[5] || '',
    evidence_notes: row[6] || '',
    status: (row[7] || 'open') as WarningStatus,
    created_at: row[8] || '',
    created_by: row[9] || '',
    resolved_at: row[10] || '',
    resolved_by: row[11] || '',
    resolution_notes: row[12] || '',
  };
}

function warningToRow(w: Warning): string[] {
  return [
    w.id, w.student_id, w.student_name, w.mentor_email, w.severity,
    w.reason, w.evidence_notes, w.status, w.created_at, w.created_by,
    w.resolved_at || '', w.resolved_by || '', w.resolution_notes || '',
  ];
}

export async function getWarnings(filters: {
  studentId?: string;
  mentorEmail?: string;
  status?: WarningStatus;
  severity?: WarningSeverity;
}): Promise<Warning[]> {
  const rows = await readSheet('warnings');
  return rows
    .map(rowToWarning)
    .filter(w => {
      if (filters.studentId && w.student_id !== filters.studentId) return false;
      if (filters.mentorEmail && w.mentor_email !== filters.mentorEmail) return false;
      if (filters.status && w.status !== filters.status) return false;
      if (filters.severity && w.severity !== filters.severity) return false;
      return true;
    })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function createWarning(data: Omit<Warning, 'id' | 'created_at' | 'resolved_at' | 'resolved_by' | 'resolution_notes'>): Promise<Warning> {
  const warning: Warning = {
    ...data,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    resolved_at: '',
    resolved_by: '',
    resolution_notes: '',
  };
  await appendRow('warnings', warningToRow(warning));
  return warning;
}

export async function resolveWarning(
  id: string,
  resolvedBy: string,
  resolutionNotes: string
): Promise<Warning | null> {
  const rowIndex = await findRowIndex('warnings', 0, id);
  if (rowIndex === -1) return null;

  const rows = await readSheet('warnings');
  const existing = rowToWarning(rows[rowIndex - 2]);
  const updated: Warning = {
    ...existing,
    status: 'resolved',
    resolved_at: new Date().toISOString(),
    resolved_by: resolvedBy,
    resolution_notes: resolutionNotes,
  };

  await updateRow('warnings', rowIndex, warningToRow(updated));
  return updated;
}

export async function escalateWarning(id: string): Promise<Warning | null> {
  const rowIndex = await findRowIndex('warnings', 0, id);
  if (rowIndex === -1) return null;

  const rows = await readSheet('warnings');
  const existing = rowToWarning(rows[rowIndex - 2]);
  if (existing.status === 'resolved') return existing;

  const severityOrder: WarningSeverity[] = ['yellow', 'orange', 'red'];
  const currentIdx = severityOrder.indexOf(existing.severity);
  const nextSeverity = severityOrder[Math.min(currentIdx + 1, severityOrder.length - 1)];

  const updated: Warning = {
    ...existing,
    severity: nextSeverity,
  };
  await updateRow('warnings', rowIndex, warningToRow(updated));
  return updated;
}