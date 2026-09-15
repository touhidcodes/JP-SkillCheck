/**
 * Risk History Sheet
 *
 * Every time a student transitions to at_risk, a record is appended here.
 * This allows tracking "frequently at-risk" students for priority support.
 *
 * Sheet columns (risk_history):
 *   0: id
 *   1: student_id
 *   2: student_name
 *   3: mentor_email
 *   4: reasons          — comma-separated risk reasons
 *   5: flagged_at       — ISO timestamp when student became at_risk
 *   6: resolved_at      — ISO timestamp when resolved (empty if still at_risk)
 */

import { readSheet, appendRow, updateRow } from './client';
import { v4 as uuidv4 } from 'uuid';

export interface RiskHistoryEntry {
  id: string;
  student_id: string;
  student_name: string;
  mentor_email: string;
  reasons: string;
  flagged_at: string;
  resolved_at: string;
  risk_probability?: number;
  risk_band?: string;
}

function rowToEntry(row: string[]): RiskHistoryEntry {
  return {
    id: row[0] || '',
    student_id: row[1] || '',
    student_name: row[2] || '',
    mentor_email: row[3] || '',
    reasons: row[4] || '',
    flagged_at: row[5] || '',
    resolved_at: row[6] || '',
    risk_probability: row[7] ? parseFloat(row[7]) : undefined,
    risk_band: row[8] || undefined,
  };
}

export async function appendRiskHistoryEntry(
  studentId: string,
  studentName: string,
  mentorEmail: string,
  reasons: string,
  riskProbability?: number,
  riskBand?: string
): Promise<RiskHistoryEntry> {
  const entry: RiskHistoryEntry = {
    id: uuidv4(),
    student_id: studentId,
    student_name: studentName,
    mentor_email: mentorEmail,
    reasons,
    flagged_at: new Date().toISOString(),
    resolved_at: '',
    risk_probability: riskProbability,
    risk_band: riskBand,
  };
  await appendRow('risk_history', [
    entry.id,
    entry.student_id,
    entry.student_name,
    entry.mentor_email,
    entry.reasons,
    entry.flagged_at,
    entry.resolved_at,
    entry.risk_probability ?? '',
    entry.risk_band ?? '',
  ]);
  return entry;
}

export async function resolveRiskHistoryEntry(studentId: string): Promise<void> {
  const rows = await readSheet('risk_history');
  // Find the most recent unresolved entry for this student
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    if (row[1] === studentId && !row[6]) {
      const sheetRow = i + 2; // +1 header, +1 1-based
      await updateRow('risk_history', sheetRow, [
        row[0], row[1], row[2], row[3], row[4], row[5],
        new Date().toISOString(),
      ]);
      break;
    }
  }
}

export async function getRiskHistoryByStudent(studentId: string): Promise<RiskHistoryEntry[]> {
  const rows = await readSheet('risk_history');
  return rows
    .map(rowToEntry)
    .filter(e => e.student_id === studentId && e.id)
    .sort((a, b) => new Date(b.flagged_at).getTime() - new Date(a.flagged_at).getTime());
}

export async function getAllRiskHistory(): Promise<RiskHistoryEntry[]> {
  const rows = await readSheet('risk_history');
  return rows
    .map(rowToEntry)
    .filter(e => e.id)
    .sort((a, b) => new Date(b.flagged_at).getTime() - new Date(a.flagged_at).getTime());
}

/**
 * Returns the count of times each student has been flagged at-risk.
 * Used to identify "frequently at-risk" students.
 */
export async function getRiskFrequencyMap(): Promise<Map<string, number>> {
  const rows = await readSheet('risk_history');
  const freq = new Map<string, number>();
  for (const row of rows) {
    const studentId = row[1] || '';
    if (studentId) {
      freq.set(studentId, (freq.get(studentId) || 0) + 1);
    }
  }
  return freq;
}
