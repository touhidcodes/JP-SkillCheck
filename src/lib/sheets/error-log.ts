/**
 * Error Log Sheet Module
 *
 * Records technical errors for debugging and monitoring.
 * Captures route, error message, stack trace, and user context.
 *
 * Sheet columns:
 *   0: id
 *   1: route
 *   2: error_message
 *   3: stack_trace
 *   4: user_id
 *   5: created_at
 */

import { readSheet, appendRow } from './client';
import { v4 as uuidv4 } from 'uuid';

export interface ErrorLogEntry {
  id: string;
  route: string;
  error_message: string;
  stack_trace: string;
  user_id: string;
  created_at: string;
}

function rowToErrorLog(row: string[]): ErrorLogEntry {
  return {
    id: row[0] || '',
    route: row[1] || '',
    error_message: row[2] || '',
    stack_trace: row[3] || '',
    user_id: row[4] || '',
    created_at: row[5] || '',
  };
}

export async function getErrorLogs(filters?: {
  route?: string;
  limit?: number;
}): Promise<ErrorLogEntry[]> {
  const rows = await readSheet('error_log');
  let logs = rows.map(rowToErrorLog).filter(l => l.id);

  if (filters?.route) {
    logs = logs.filter(l => l.route === filters.route);
  }

  logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const limit = filters?.limit ?? 50;
  return logs.slice(0, limit);
}

export async function createErrorLog(entry: Omit<ErrorLogEntry, 'id' | 'created_at'>): Promise<void> {
  const id = uuidv4();
  await appendRow('error_log', [
    id,
    entry.route,
    entry.error_message,
    entry.stack_trace,
    entry.user_id,
    new Date().toISOString(),
  ]);
}
