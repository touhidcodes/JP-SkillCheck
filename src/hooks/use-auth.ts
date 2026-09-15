'use client';

import { useQuery } from '@tanstack/react-query';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'manager' | 'mentor';
}

export function useAuth() {
  const authEnabled = process.env.NEXT_PUBLIC_ADMIN_AUTH_ENABLED !== 'false';
  const { data, isLoading, error } = useQuery<{ user: User }>({
    queryKey: ['auth'],
    queryFn: async () => {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        throw new Error('Not authenticated');
      }
      return response.json();
    },
    retry: false,
    enabled: authEnabled,
  });

  if (!authEnabled) {
    return {
      user: {
        id: 'dashboard-preview',
        email: 'preview@local.dev',
        name: 'Dashboard Preview',
        role: 'manager' as const,
      },
      isLoading: false,
      isAuthenticated: true,
    };
  }

  return {
    user: data?.user,
    isLoading,
    isAuthenticated: !error && !isLoading && !!data?.user,
  };
}
