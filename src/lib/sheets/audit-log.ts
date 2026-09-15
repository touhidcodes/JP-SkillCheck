/**
 * Audit Log Sheet Module
 *
 * Records important system actions for compliance and debugging.
 * Each entry captures who did what, to whom, when, and from where.
 *
 * Sheet columns:
 *   0:  id
 *   1:  actor_id
 *   2:  actor_email
 *   3:  actor_role
 *   4:  action
 *   5:  target_type
 *   6:  target_id
 *   7:  metadata
 *   8:  ip_address
 *   9:  user_agent
 *   10: created_at
 */

import { readSheet, appendRow } from './client';
import { v4 as uuidv4 } from 'uuid';

export interface AuditLogEntry {
  id: string;
  actor_id: string;
  actor_email: string;
  actor_role: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

function rowToAuditLog(row: string[]): AuditLogEntry {
  return {
    id: row[0] || '',
    actor_id: row[1] || '',
    actor_email: row[2] || '',
    actor_role: row[3] || '',
    action: row[4] || '',
    target_type: row[5] || '',
    target_id: row[6] || '',
    metadata: row[7] || '',
    ip_address: row[8] || '',
    user_agent: row[9] || '',
    created_at: row[10] || '',
  };
}

export async function getAuditLogs(filters?: {
  actorEmail?: string;
  action?: string;
  targetType?: string;
  limit?: number;
}): Promise<AuditLogEntry[]> {
  const rows = await readSheet('audit_log');
  let logs = rows.map(rowToAuditLog).filter(l => l.id);

  if (filters?.actorEmail) {
    logs = logs.filter(l => l.actor_email === filters.actorEmail);
  }
  if (filters?.action) {
    logs = logs.filter(l => l.action === filters.action);
  }
  if (filters?.targetType) {
    logs = logs.filter(l => l.target_type === filters.targetType);
  }

  logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const limit = filters?.limit ?? 100;
  return logs.slice(0, limit);
}

export async function createAuditLog(entry: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<void> {
  const id = uuidv4();
  await appendRow('audit_log', [
    id,
    entry.actor_id,
    entry.actor_email,
    entry.actor_role,
    entry.action,
    entry.target_type,
    entry.target_id,
    entry.metadata,
    entry.ip_address,
    entry.user_agent,
    new Date().toISOString(),
  ]);
}
