/**
 * WHY this file exists:
 * Analytics events provide the foundational data for mentor self-analytics and
 * activity tracking. Without event logging, we have no visibility into what
 * actions mentors are taking day-to-day.
 *
 * This module provides typed access to the analytics_events sheet, which records
 * every meaningful mentor action (task creation, stage updates, attendance logging,
 * progress log creation, etc.) with a timestamp, actor, target student, and payload.
 *
 * The events enable:
 * 1. MENTOR SELF-ANALYTICS: Each mentor can see their own activity metrics
 *    (tasks completed, students touched, logs created per week)
 * 2. ACCOUNTABILITY: Track which mentor took which action and when
 * 3. TREND ANALYSIS: Aggregate mentor behavior patterns over time
 * 4. PIPELINE ANALYTICS: Cross-reference mentor actions with student outcomes
 *
 * In Sheets this is an append-only event log. In PostgreSQL this would be a
 * simple table with INSERT-only access and indexed by (mentor_email, created_at).
 */

import { readSheet, appendRow } from './client';
import { v4 as uuidv4 } from 'uuid';

export type EventType =
  | 'task_created'
  | 'task_completed'
  | 'stage_updated'
  | 'progress_log_created'
  | 'attendance_logged'
  | 'student_visited'
  | 'warning_acknowledged';

export interface AnalyticsEvent {
  id: string;
  event_type: EventType;
  actor_email: string;
  actor_role: 'mentor' | 'manager';
  student_id: string;
  student_name: string;
  created_at: string;
  payload: string;
}

function rowToEvent(row: string[]): AnalyticsEvent {
  return {
    id: row[0] || '',
    event_type: (row[1] as EventType) || 'task_created',
    actor_email: row[2] || '',
    actor_role: (row[3] as 'mentor' | 'manager') || 'mentor',
    student_id: row[4] || '',
    student_name: row[5] || '',
    created_at: row[6] || '',
    payload: row[7] || '',
  };
}

function eventToRow(e: AnalyticsEvent): string[] {
  return [
    e.id,
    e.event_type,
    e.actor_email,
    e.actor_role,
    e.student_id,
    e.student_name,
    e.created_at,
    e.payload,
  ];
}

export async function logEvent(
  eventType: EventType,
  actorEmail: string,
  actorRole: 'mentor' | 'manager',
  studentId: string,
  studentName: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  const event: AnalyticsEvent = {
    id: uuidv4(),
    event_type: eventType,
    actor_email: actorEmail,
    actor_role: actorRole,
    student_id: studentId,
    student_name: studentName,
    created_at: new Date().toISOString(),
    payload: JSON.stringify(payload),
  };
  await appendRow('analytics_events', eventToRow(event));
}

export async function getEventsByMentor(
  mentorEmail: string,
  options?: { limit?: number; event_type?: EventType }
): Promise<AnalyticsEvent[]> {
  const rows = await readSheet('analytics_events');
  let events = rows
    .map(rowToEvent)
    .filter(e => e.actor_email === mentorEmail);

  if (options?.event_type) {
    events = events.filter(e => e.event_type === options.event_type);
  }

  events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (options?.limit) {
    events = events.slice(0, options.limit);
  }

  return events;
}

export async function getEventsByStudent(studentId: string): Promise<AnalyticsEvent[]> {
  const rows = await readSheet('analytics_events');
  return rows
    .map(rowToEvent)
    .filter(e => e.student_id === studentId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}