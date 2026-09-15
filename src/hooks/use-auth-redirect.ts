'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './use-auth';

interface UseAuthRedirectOptions {
  allowedRoles?: ('manager' | 'mentor')[];
  redirectTo?: string;
}

export function useAuthRedirect(options: UseAuthRedirectOptions = {}) {
  const { allowedRoles, redirectTo } = options;
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    if (allowedRoles && user && !allowedRoles.includes(user.role)) {
      const destination = user.role === 'manager' ? '/manager' : '/mentor';
      router.push(destination);
      return;
    }

    if (redirectTo) {
      router.push(redirectTo);
    }
  }, [isLoading, isAuthenticated, user, allowedRoles, redirectTo, router]);
}