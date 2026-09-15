/**
 * Notifications Sheet
 *
 * In-app notifications for risk alerts and mentor actions. Notifications are
 * typed with payloads to enable type-safe rendering on the client without
 * needing to parse raw JSON strings.
 *
 * Sheet columns (notifications):
 *   0: id
 *   1: recipient_email   — who should see this notification
 *   2: type              — one of the NotificationType values
 *   3: student_id
 *   4: student_name
 *   5: message
 *   6: read              — 'true' | 'false'
 *   7: created_at
 *   8: payload           — JSON-encoded type-specific data
 */

import { readSheet, appendRow, updateRow } from './client';
import { v4 as uuidv4 } from 'uuid';

const USERS_CACHE: { data: Map<string, { id: string; name: string; email: string; role: string; active: boolean }>; timestamp: number } = {
  data: new Map(),
  timestamp: 0,
};
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getCachedUsers(): Promise<Map<string, { id: string; name: string; email: string; role: string; active: boolean }>> {
  const now = Date.now();
  if (USERS_CACHE.data.size === 0 || now - USERS_CACHE.timestamp > CACHE_TTL_MS) {
    const rows = await readSheet('users');
    USERS_CACHE.data.clear();
    for (const row of rows) {
      const user = {
        id: row[0] || '',
        name: row[1] || '',
        email: row[2] || '',
        role: row[3] || 'mentor',
        active: row[4] === 'true',
      };
      if (user.email) USERS_CACHE.data.set(user.email, user);
    }
    USERS_CACHE.timestamp = now;
  }
  return USERS_CACHE.data;
}

export type NotificationType =
  | 'risk_alert'
  | 'risk_resolved'
  | 'task_due'
  | 'stage_changed'
  | 'mentor_update_reminder'
  | 'attendance_alert'
  | 'action_required'
  | 'system_message'
  | 'mentor_at_risk'
  | 'mentor_needs_support'
  | 'mentor_kpi_achieved'
  | 'mentor_kpi_failed'
  | 'mentor_kpi_behind'
  | 'student_inactivity'
  | 'student_attendance_drop'
  | 'student_progress_decline';

export type NotificationPayload =
  | { type: 'risk_alert'; reasons: string[]; days_inactive: number }
  | { type: 'risk_resolved'; triggered_by: string }
  | { type: 'task_due'; task_title: string; due_date: string; priority: string }
  | { type: 'stage_changed'; from_stage: string; to_stage: string; triggered_by: string }
  | { type: 'mentor_update_reminder'; pending_since: string }
  | { type: 'attendance_alert'; absence_count: number; last_absence_date: string }
  | { type: 'action_required'; action: string; description: string }
  | { type: 'system_message'; title: string; action_url?: string }
  | { type: 'mentor_at_risk'; mentor_email: string; mentor_name: string; reasons: string[] }
  | { type: 'mentor_needs_support'; mentor_email: string; mentor_name: string; reasons: string[] }
  | { type: 'mentor_kpi_achieved'; mentor_email: string; mentor_name: string; placements: number; target: number; month: string }
  | { type: 'mentor_kpi_failed'; mentor_email: string; mentor_name: string; placements: number; target: number; month: string }
  | { type: 'mentor_kpi_behind'; mentor_email: string; mentor_name: string; placements: number; target: number; month: string }
  | { type: 'student_inactivity'; days_inactive: number }
  | { type: 'student_attendance_drop'; attendance_rate: number; threshold: number }
  | { type: 'student_progress_decline'; details: string; previous_score?: number; current_score?: number }
  | Record<string, never>;

export interface Notification {
  id: string;
  recipient_email: string;
  type: NotificationType;
  student_id: string;
  student_name: string;
  message: string;
  read: boolean;
  created_at: string;
  payload: NotificationPayload;
}

function rowToNotification(row: string[]): Notification {
  let payload: NotificationPayload = {};
  try {
    if (row[8]) payload = JSON.parse(row[8]) as NotificationPayload;
  } catch { /* skip */ }
  return {
    id: row[0] || '',
    recipient_email: row[1] || '',
    type: (row[2] as NotificationType) || 'risk_alert',
    student_id: row[3] || '',
    student_name: row[4] || '',
    message: row[5] || '',
    read: row[6] === 'true',
    created_at: row[7] || '',
    payload,
  };
}

export async function createNotification(
  recipientEmail: string,
  type: NotificationType,
  studentId: string,
  studentName: string,
  message: string,
  payload: NotificationPayload = {}
): Promise<void> {
  const id = uuidv4();
  await appendRow('notifications', [
    id,
    recipientEmail,
    type,
    studentId,
    studentName,
    message,
    'false',
    new Date().toISOString(),
    JSON.stringify(payload),
  ]);
}

export async function getNotificationsForUser(
  email: string,
  unreadOnly = false
): Promise<Notification[]> {
  const rows = await readSheet('notifications');
  let notifications = rows
    .map(rowToNotification)
    .filter(n => n.id && n.recipient_email === email);

  if (unreadOnly) {
    notifications = notifications.filter(n => !n.read);
  }

  return notifications.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function markNotificationRead(id: string, userEmail: string): Promise<void> {
  const rows = await readSheet('notifications');
  const idx = rows.findIndex(r => r[0] === id);
  if (idx === -1) return;
  const row = rows[idx];
  if (row[1] !== userEmail) return;
  const sheetRow = idx + 2;
  await updateRow('notifications', sheetRow, [
    row[0], row[1], row[2], row[3], row[4], row[5], 'true', row[7], row[8] ?? '',
  ]);
}

export function isNotificationType(type: string): type is NotificationType {
  return [
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
  ].includes(type);
}

export function getPayloadForType(type: NotificationType): NotificationPayload['type'] {
  return type as NotificationPayload['type'];
}

export async function markAllNotificationsRead(email: string): Promise<number> {
  const rows = await readSheet('notifications');
  const updates: { sheetRow: number; values: string[] }[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row[1] === email && row[6] !== 'true') {
      updates.push({
        sheetRow: i + 2,
        values: [row[0], row[1], row[2], row[3], row[4], row[5], 'true', row[7], row[8] ?? ''],
      });
    }
  }
  if (updates.length === 0) return 0;
  const { batchUpdateRows } = await import('./client');
  await batchUpdateRows('notifications', updates);
  return updates.length;
}
