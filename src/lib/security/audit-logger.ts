/**
 * Audit Logging System
 *
 * WHY APPEND-ONLY (NO DELETES/UPDATES):
 * =====================================
 * 1. COMPLIANCE: Regulatory frameworks (SOC 2, GDPR, HIPAA) require audit trail
 *    integrity. Deleted or modified audit records make compliance audits fail.
 * 2. INVESTIGATION: When a security incident occurs, investigators need
 *    to reconstruct exactly what happened. If records can be deleted, a
 *    malicious insider could erase evidence.
 * 3. NON-REPUDIATION: Audit logs serve as legal evidence. A manager cannot deny
 *    taking an action if the audit log shows the exact timestamp, IP, and
 *    metadata of their request.
 * 4. ACCOUNTABILITY: Append-only ensures that every action is recorded permanently.
 *    This deters bad actors who know their actions can't be erased.
 * 5. FINANCIAL/AUDIT REQUIREMENTS: Any system handling student disciplinary
 *    records (warnings, terminations) needs tamper-proof logs for due process.
 *
 * COMPLIANCE SCENARIOS THIS ENABLES:
 * - Employee misconduct investigations
 * - Student appeal support (prove warning was issued with evidence)
 * - Regulatory inspection readiness
 * - Security breach forensics
 * - Access pattern anomaly detection (who accessed what, when)
 */

import { appendRow } from '@/lib/sheets/client';

export enum AuditAction {
  STUDENT_CREATED      = 'STUDENT_CREATED',
  STUDENT_UPDATED      = 'STUDENT_UPDATED',
  STUDENT_TERMINATED   = 'STUDENT_TERMINATED',
  STUDENT_STAGE_CHANGED = 'STUDENT_STAGE_CHANGED',
  MENTOR_ASSIGNED      = 'MENTOR_ASSIGNED',
  MENTOR_REMOVED       = 'MENTOR_REMOVED',
  WARNING_ISSUED       = 'WARNING_ISSUED',
  WARNING_ESCALATED    = 'WARNING_ESCALATED',
  WARNING_RESOLVED     = 'WARNING_RESOLVED',
  REPORT_DOWNLOADED    = 'REPORT_DOWNLOADED',
  BULK_IMPORT          = 'BULK_IMPORT',
  USER_LOGIN           = 'USER_LOGIN',
  USER_LOGOUT          = 'USER_LOGOUT',
  USER_CREATED         = 'USER_CREATED',
  USER_ROLE_CHANGED    = 'USER_ROLE_CHANGED',
  CRON_TRIGGERED       = 'CRON_TRIGGERED',
}

export type AuditTargetType = 'student' | 'mentor' | 'task' | 'warning' | 'report' | 'config' | 'user';

export interface AuditEvent {
  id: string;
  actor_id: string;
  actor_email: string;
  actor_role: string;
  action: AuditAction;
  target_type: AuditTargetType;
  target_id: string;
  metadata?: Record<string, unknown>;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

function generateUuid(): string {
  return crypto.randomUUID();
}

export async function logAuditEvent(event: AuditEvent): Promise<void> {
  const auditRow = [
    event.id,
    event.actor_id,
    event.actor_email,
    event.actor_role,
    event.action,
    event.target_type,
    event.target_id,
    JSON.stringify(event.metadata || {}),
    event.ip_address,
    event.user_agent,
    event.created_at,
  ];

  try {
    await appendRow('audit_log', auditRow);
  } catch (error) {
    console.error('[AuditLog] Failed to write audit event:', error);
    throw error;
  }
}

export function createAuditEvent(params: {
  actor: { id: string; email: string; role: string };
  action: AuditAction;
  target_type: AuditTargetType;
  target_id: string;
  metadata?: Record<string, unknown>;
  request?: Request;
}): AuditEvent {
  const { actor, action, target_type, target_id, metadata, request } = params;

  const ip_address = request?.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || request?.headers.get('x-real-ip')
    || 'unknown';

  const user_agent = request?.headers.get('user-agent') || 'unknown';

  return {
    id: generateUuid(),
    actor_id: actor.id,
    actor_email: actor.email,
    actor_role: actor.role,
    action,
    target_type,
    target_id,
    metadata,
    ip_address,
    user_agent,
    created_at: new Date().toISOString(),
  };
}

export async function logStudentCreated(
  actor: { id: string; email: string; role: string },
  studentId: string,
  studentName: string,
  request?: Request
): Promise<void> {
  const event = createAuditEvent({
    actor,
    action: AuditAction.STUDENT_CREATED,
    target_type: 'student',
    target_id: studentId,
    metadata: { student_name: studentName },
    request,
  });
  await logAuditEvent(event);
}

export async function logStudentTerminated(
  actor: { id: string; email: string; role: string },
  studentId: string,
  studentName: string,
  reason: string,
  request?: Request
): Promise<void> {
  const event = createAuditEvent({
    actor,
    action: AuditAction.STUDENT_TERMINATED,
    target_type: 'student',
    target_id: studentId,
    metadata: { student_name: studentName, reason },
    request,
  });
  await logAuditEvent(event);
}

export async function logWarningIssued(
  actor: { id: string; email: string; role: string },
  warningId: string,
  studentId: string,
  severity: string,
  reason: string,
  request?: Request
): Promise<void> {
  const event = createAuditEvent({
    actor,
    action: AuditAction.WARNING_ISSUED,
    target_type: 'warning',
    target_id: warningId,
    metadata: { student_id: studentId, severity, reason },
    request,
  });
  await logAuditEvent(event);
}

export async function logReportDownload(
  actor: { id: string; email: string; role: string },
  reportId: string,
  reportType: string,
  request?: Request
): Promise<void> {
  const event = createAuditEvent({
    actor,
    action: AuditAction.REPORT_DOWNLOADED,
    target_type: 'report',
    target_id: reportId,
    metadata: { report_type: reportType },
    request,
  });
  await logAuditEvent(event);
}

export async function logUserLogin(
  actor: { id: string; email: string; role: string },
  request?: Request
): Promise<void> {
  const event = createAuditEvent({
    actor,
    action: AuditAction.USER_LOGIN,
    target_type: 'user',
    target_id: actor.id,
    request,
  });
  await logAuditEvent(event);
}

export async function logCronTriggered(
  cronType: string,
  triggeredBy: string,
  request?: Request
): Promise<void> {
  const event = createAuditEvent({
    actor: { id: 'system', email: 'cron@system', role: 'system' },
    action: AuditAction.CRON_TRIGGERED,
    target_type: 'config',
    target_id: cronType,
    metadata: { triggered_by: triggeredBy },
    request,
  });
  await logAuditEvent(event);
}