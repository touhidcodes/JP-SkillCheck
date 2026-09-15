import type { JWTPayload, UserRole } from '@/types';

export type ApiError = { message: string; status: number };

export function createApiError(message: string, status: number): ApiError {
  return { message, status };
}

export function getUserFromHeaders(headers: Headers): JWTPayload | null {
  const userId = headers.get('x-user-id');
  const userRole = headers.get('x-user-role') as UserRole | null;
  const userEmail = headers.get('x-user-email');
  const userName = headers.get('x-user-name');

  if (!userId || !userRole || !userEmail || !userName) {
    return null;
  }

  return {
    id: userId,
    role: userRole,
    email: userEmail,
    name: userName,
  };
}

export function requireRole(headers: Headers, roles: UserRole[]): JWTPayload {
  const user = getUserFromHeaders(headers);
  
  if (!user) {
    throw createApiError('Unauthorized', 401);
  }

  if (!roles.includes(user.role)) {
    throw createApiError('Forbidden: insufficient permissions', 403);
  }

  return user;
}