/**
 * Error Logger — Append-only error tracking to the error_log sheet.
 *
 * All unhandled errors in API routes can be logged here for debugging.
 * Errors are written to the error_log Google Sheet and also printed to
 * the server console so they appear in deployment logs.
 */

import { appendRow } from '@/lib/sheets/client';

export interface ErrorLogEntry {
  id: string;
  route: string;
  error_message: string;
  stack_trace?: string;
  user_id?: string;
  created_at: string;
}

export async function logApiError(params: {
  route: string;
  error: unknown;
  userId?: string;
}): Promise<void> {
  const { route, error, userId } = params;

  const errorMessage = error instanceof Error ? error.message : String(error);
  const stackTrace   = error instanceof Error ? error.stack  : undefined;

  // Always log to console so errors appear in deployment logs
  console.error(`[API Error] ${route}: ${errorMessage}`);

  const entry: ErrorLogEntry = {
    id: crypto.randomUUID(),
    route,
    error_message: errorMessage,
    stack_trace:   stackTrace,
    user_id:       userId,
    created_at:    new Date().toISOString(),
  };

  try {
    await appendRow('error_log', [
      entry.id,
      entry.route,
      entry.error_message,
      entry.stack_trace || '',
      entry.user_id    || '',
      entry.created_at,
    ]);
  } catch (appendError) {
    // Fail silently — don't create cascading errors from the error logger itself
    console.error('[ErrorLog] Failed to write to error_log sheet:', appendError);
  }
}
