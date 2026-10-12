'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'manager' | 'mentor';
  image?: string;
}

export function useAuth() {
  let sessionData: ReturnType<typeof useSession>['data'] = null;
  let status: ReturnType<typeof useSession>['status'] = 'unauthenticated';

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const session = useSession();
    sessionData = session.data;
    status = session.status;
  } catch {
    // Graceful fallback if invoked outside SessionProvider context
  }

  const [localUser, setLocalUser] = useState<User | null>(null);
  const [isClientLoaded, setIsClientLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('skillcheck_user_session');
      if (stored) {
        const parsed = JSON.parse(stored);
        setLocalUser({
          id: parsed.email || 'user_1',
          email: parsed.email || 'user@example.com',
          name: parsed.name || 'User',
          role: parsed.role === 'mentor' ? 'mentor' : 'mentor',
          image: parsed.image,
        });
      }
    } catch {
      // ignore JSON parse errors
    } finally {
      setIsClientLoaded(true);
    }
  }, []);

  const user: User | null = localUser || (sessionData?.user ? {
    id: sessionData.user.email || 'google_user',
    email: sessionData.user.email || '',
    name: sessionData.user.name || 'User',
    role: 'mentor',
    image: sessionData.user.image || undefined,
  } : null);

  const isLoading = !isClientLoaded || status === 'loading';

  return {
    user,
    isLoading,
    isAuthenticated: !isLoading && !!user,
  };
}


