'use client';

import { useQuery } from '@tanstack/react-query';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'manager' | 'mentor';
}

export function useAuth() {
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
  });

  return {
    user: data?.user,
    isLoading,
    isAuthenticated: !error && !isLoading && !!data?.user,
  };
}