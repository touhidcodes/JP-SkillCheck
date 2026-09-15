import type { UserRole } from '@/types';

export enum Permission {
  STUDENTS_VIEW_ALL    = 'STUDENTS_VIEW_ALL',
  STUDENTS_VIEW_OWN    = 'STUDENTS_VIEW_OWN',
  STUDENTS_CREATE      = 'STUDENTS_CREATE',
  STUDENTS_DELETE      = 'STUDENTS_DELETE',
  STUDENTS_TERMINATE   = 'STUDENTS_TERMINATE',
  STUDENTS_UPDATE      = 'STUDENTS_UPDATE',
  MENTORS_VIEW         = 'MENTORS_VIEW',
  MENTORS_CREATE       = 'MENTORS_CREATE',
  MENTORS_UPDATE       = 'MENTORS_UPDATE',
  ANALYTICS_VIEW_ALL   = 'ANALYTICS_VIEW_ALL',
  ANALYTICS_VIEW_OWN   = 'ANALYTICS_VIEW_OWN',
  REPORTS_DOWNLOAD     = 'REPORTS_DOWNLOAD',
  REPORTS_GENERATE     = 'REPORTS_GENERATE',
  WARNINGS_ISSUE       = 'WARNINGS_ISSUE',
  WARNINGS_RESOLVE     = 'WARNINGS_RESOLVE',
  WARNINGS_VIEW        = 'WARNINGS_VIEW',
  ADMIN_AUDIT_VIEW     = 'ADMIN_AUDIT_VIEW',
  TASKS_MANAGE         = 'TASKS_MANAGE',
  TASKS_VIEW_OWN       = 'TASKS_VIEW_OWN',
}

// The two roles that exist in the system
export enum Role {
  MANAGER = 'manager',
  MENTOR  = 'mentor',
}

type PermissionSet = Permission[];

const ROLE_PERMISSIONS: Record<Role, PermissionSet> = {
  [Role.MANAGER]: [
    Permission.MENTORS_VIEW,
    Permission.MENTORS_CREATE,
    Permission.MENTORS_UPDATE,
    Permission.ANALYTICS_VIEW_ALL,
    Permission.REPORTS_DOWNLOAD,
    Permission.REPORTS_GENERATE,
    Permission.WARNINGS_VIEW,
    Permission.ADMIN_AUDIT_VIEW,
    Permission.TASKS_MANAGE,
    Permission.TASKS_VIEW_OWN,
  ],
  [Role.MENTOR]: [
    Permission.STUDENTS_VIEW_OWN,
    Permission.STUDENTS_UPDATE,
    Permission.MENTORS_VIEW,
    Permission.ANALYTICS_VIEW_OWN,
    Permission.WARNINGS_RESOLVE,
    Permission.WARNINGS_VIEW,
    Permission.REPORTS_DOWNLOAD,
    Permission.TASKS_VIEW_OWN,
  ],
};

export function hasPermission(role: UserRole | Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role as Role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

export function hasAnyPermission(role: UserRole | Role, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

export function getPermissionsForRole(role: UserRole | Role): Permission[] {
  return ROLE_PERMISSIONS[role as Role] || [];
}

export function requirePermission(permission: Permission) {
  return function checkPermission(
    headers: Headers
  ): { id: string; email: string; name: string; role: UserRole } {
    const userId    = headers.get('x-user-id');
    const userRole  = headers.get('x-user-role') as UserRole | null;
    const userEmail = headers.get('x-user-email');
    const userName  = headers.get('x-user-name');

    if (!userId || !userRole || !userEmail || !userName) {
      throw { message: 'Unauthorized', status: 401 };
    }

    if (!hasPermission(userRole, permission)) {
      throw { message: 'Forbidden: insufficient permissions', status: 403 };
    }

    return { id: userId, role: userRole, email: userEmail, name: userName };
  };
}

export function requireAnyPermission(permissions: Permission[]) {
  return function checkAnyPermission(
    headers: Headers
  ): { id: string; email: string; name: string; role: UserRole } {
    const userId    = headers.get('x-user-id');
    const userRole  = headers.get('x-user-role') as UserRole | null;
    const userEmail = headers.get('x-user-email');
    const userName  = headers.get('x-user-name');

    if (!userId || !userRole || !userEmail || !userName) {
      throw { message: 'Unauthorized', status: 401 };
    }

    if (!hasAnyPermission(userRole, permissions)) {
      throw { message: 'Forbidden: insufficient permissions', status: 403 };
    }

    return { id: userId, role: userRole, email: userEmail, name: userName };
  };
}

export { requireRole } from '@/lib/auth/helpers';
