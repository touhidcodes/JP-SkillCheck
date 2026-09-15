import { createAuditLog } from './audit-log';

export interface AppendAuditLogInput {
  user_email: string;
  role: 'manager' | 'mentor' | 'student';
  action: string;
  entity_type: string;
  entity_id: string;
  payload?: unknown;
  request?: Request;
  actor_id?: string;
}

export async function appendAuditLog(input: AppendAuditLogInput): Promise<void> {
  const headers = input.request?.headers;
  const ip_address =
    headers?.get('x-forwarded-for')?.split(',')[0].trim() ||
    headers?.get('x-real-ip') ||
    'unknown';
  const user_agent = headers?.get('user-agent') || 'unknown';

  await createAuditLog({
    actor_id: input.actor_id || input.user_email,
    actor_email: input.user_email,
    actor_role: input.role,
    action: input.action,
    target_type: input.entity_type,
    target_id: input.entity_id,
    metadata: JSON.stringify(input.payload ?? {}),
    ip_address,
    user_agent,
  });
}
