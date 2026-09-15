'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { PlacementStoreProvider } from '@/lib/placement/store';

export default function MentorLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (user && user.role !== 'mentor') {
      router.push('/manager');
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/40">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground font-medium text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== 'mentor') {
    return null;
  }

  return (
    <PlacementStoreProvider>
      <DashboardShell title="My Dashboard">{children}</DashboardShell>
    </PlacementStoreProvider>
  );
}
