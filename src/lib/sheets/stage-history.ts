/**
 * WHY this file exists:
 * Stage history tracking is the foundational data for time-in-stage analytics.
 * Without this, the Kanban board's "days in stage" is computed from
 * `updated_at` which changes on ANY field update, not just stage transitions.
 *
 * This module provides typed access to the stage_history sheet, which records
 * every pipeline stage transition as an immutable event. This is the correct
 * data modeling decision because:
 *
 * 1. EVENTS vs STATE: Stage is a state that changes over time. Storing only
 *    the current state loses the history. An event log preserves both the
 *    current state AND the history of how the student arrived here.
 *
 * 2. CORRECT TIME-IN-STAGE: With events, days_in_stage = now - transitioned_at
 *    of the most recent entry where to_stage = current_stage. With state-only,
 *    updated_at changes on ANY field update, making days_in_stage unreliable.
 *
 * 3. ANOMALY DETECTION: Events enable detecting regressions (student moved from
 *    interviewing back to applying, which should rarely happen and signals
 *    an issue), stage-transition velocity analysis, and cohort-relative timing.
 *
 * 4. AUDIT TRAIL: For terminated students, stage_history shows the complete
 *    journey through the pipeline, enabling root-cause analysis.
 *
 * 5. FUTURE-PROOFING: If we later want to track time between ALL states
 *    (not just stage), we add new event types. With state-only storage,
 *    we'd need a new column each time.
 *
 * In a relational DB this would be a simple table with a trigger.
 * In Sheets, it's a separate sheet with an append-only log pattern.
 */

import { readSheet, appendRow } from './client';
import type { StudentStage } from '@/types';

export interface StageTransition {
  id: string;
  student_id: string;
  from_stage: StudentStage | '';
  to_stage: StudentStage;
  transitioned_at: string; // ISO8601
  triggered_by: 'api' | 'risk_engine' | 'admin' | 'bulk_upload';
  note: string;
}

// Sheet columns: id | student_id | from_stage | to_stage | transitioned_at | triggered_by | note
function rowToTransition(row: string[]): StageTransition {
  return {
    id: row[0] || '',
    student_id: row[1] || '',
    from_stage: (row[2] || '') as StudentStage,
    to_stage: (row[3] || 'learning') as StudentStage,
    transitioned_at: row[4] || '',
    triggered_by: (row[5] || 'api') as StageTransition['triggered_by'],
    note: row[6] || '',
  };
}

function transitionToRow(t: StageTransition): string[] {
  return [
    t.id,
    t.student_id,
    t.from_stage,
    t.to_stage,
    t.transitioned_at,
    t.triggered_by,
    t.note,
  ];
}

export async function getTransitionsByStudent(studentId: string): Promise<StageTransition[]> {
  const rows = await readSheet('stage_history');
  return rows
    .map(rowToTransition)
    .filter(r => r.student_id === studentId)
    .sort((a, b) => new Date(b.transitioned_at).getTime() - new Date(a.transitioned_at).getTime());
}

export async function getLatestTransition(studentId: string): Promise<StageTransition | null> {
  const all = await getTransitionsByStudent(studentId);
  return all[0] ?? null;
}

/**
 * Log a stage transition to the stage_history sheet.
 * Called whenever a student's stage changes (in updateStudent, placement PATCH, etc.)
 *
 * The transitioned_at is always now — this is an event log.
 * The from_stage is the PREVIOUS stage (passed explicitly to avoid reading the
 * student again just to know what the old stage was).
 */
export async function logStageTransition(
  studentId: string,
  fromStage: StudentStage | '',
  toStage: StudentStage,
  triggeredBy: StageTransition['triggered_by'],
  note?: string
): Promise<void> {
  const entry: StageTransition = {
    id: crypto.randomUUID(),
    student_id: studentId,
    from_stage: fromStage,
    to_stage: toStage,
    transitioned_at: new Date().toISOString(),
    triggered_by: triggeredBy,
    note: note ?? '',
  };
  await appendRow('stage_history', transitionToRow(entry));
}

/**
 * Compute days-in-stage for a student from the stage_history log.
 * Falls back to 0 if no transitions are found.
 */
export async function getDaysInStage(studentId: string): Promise<number> {
  const latest = await getLatestTransition(studentId);
  if (!latest) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((Date.now() - new Date(latest.transitioned_at).getTime()) / msPerDay);
}