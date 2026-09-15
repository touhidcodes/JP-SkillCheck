'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  LayoutDashboard, Users, Kanban,
  LogOut, ClipboardCheck, BarChart2, Trophy,
  ShieldCheck, CheckCircle2, TrendingUp, AlertTriangle, BarChart3,
  ChevronRight, Home,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { NotificationBell } from '@/components/dashboard/notification-bell';
import { ThemeToggle } from '@/components/dashboard/theme-toggle';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function roleLabel(role: UserRole): string {
  return role === 'manager' ? 'Manager' : 'Mentor';
}

function roleBadgeVariant(role: string): 'default' | 'secondary' | 'outline' {
  if (role === 'manager') return 'default';
  return 'outline';
}

function RoleBasedSidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();

  const managerNav: NavSection[] = [
    {
      label: 'Overview',
      items: [
        { href: `/${role}`, label: 'Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Mentor Analytics',
      items: [
        { href: `/${role}/analytics/mentor-performance`, label: 'Mentor Performance', icon: BarChart3 },
        { href: `/${role}/analytics`, label: 'Analytics', icon: TrendingUp },
        { href: `/${role}/team`, label: 'Team', icon: ShieldCheck },
      ],
    },
  ];

  const mentorNav: NavSection[] = [
    {
      label: 'Overview',
      items: [
        { href: `/${role}`, label: 'My Dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'My Mentees',
      items: [
        { href: `/${role}/students`,              label: 'My Mentees',    icon: Users },
        { href: `/${role}/students/progress-logs`, label: 'Progress Logs', icon: BarChart2 },
        { href: `/${role}/students/attendance`,    label: 'Attendance',    icon: ClipboardCheck },
        { href: `/${role}/placement`,              label: 'Placement',     icon: Kanban },
        { href: `/${role}/risk`,                   label: 'Risk Tracker',  icon: AlertTriangle },
        { href: `/${role}/leaderboard`,            label: 'Leaderboard',   icon: Trophy },
      ],
    },
    {
      label: 'My Tasks',
      items: [
        { href: `/${role}/tasks`, label: 'My Tasks', icon: CheckCircle2 },
      ],
    },
  ];

  const navSections = role === 'manager' ? managerNav : mentorNav;

  const isActive = (href: string) => {
    if (href === `/${role}`) return pathname === `/${role}`;
    if (href === `/${role}/students`) return pathname === `/${role}/students`;
    if (href === `/${role}/analytics`) return pathname === `/${role}/analytics`;
    return pathname.startsWith(href);
  };

  return (
    <>
      {navSections.map((section, si) => (
        <div key={si} className="space-y-1.5 pt-1">
          {section.label && (
            <p className="px-3 mb-2 text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest leading-none">
              {section.label}
            </p>
          )}
          {section.items.map(item => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 relative group',
                  active
                    ? 'bg-primary/10 text-primary shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] border border-primary/10'
                    : 'text-muted-foreground hover:bg-muted/65 hover:text-foreground border border-transparent'
                )}
              >
                {/* Active link left accent bar */}
                {active && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-primary rounded-r-full" />
                )}
                
                <item.icon className={cn(
                  'w-4.5 h-4.5 shrink-0 transition-transform duration-200 group-hover:scale-105',
                  active ? 'text-primary' : 'text-muted-foreground/80'
                )} />
                <span className="flex-1 truncate">{item.label}</span>
                
                {item.badge && (
                  <span className="ml-auto text-[9px] bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full font-bold">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
    </>
  );
}

interface DashboardShellProps {
  children: React.ReactNode;
  title: string;
}

export function DashboardShell({ children, title }: DashboardShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground font-semibold text-sm">Loading session…</p>
        </div>
      </div>
    );
  }

  // Segment breadcrumbs based on route
  const getBreadcrumbs = () => {
    const segments = pathname.split('/').filter(Boolean);
    const crumbs: Array<{
      label: string;
      icon: React.ComponentType<{ className?: string }> | null;
      href: string;
    }> = [{ label: 'Home', icon: Home, href: `/${user?.role ?? 'mentor'}` }];
    
    let pathAcc = '';
    segments.forEach((seg, idx) => {
      pathAcc += `/${seg}`;
      if (idx === 0) return; // skip the base role route
      
      const label = seg
        .replace(/-/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
        
      crumbs.push({
        label,
        icon: null,
        href: pathAcc,
      });
    });

    return crumbs;
  };

  const crumbs = getBreadcrumbs();

  return (
    <div className="min-h-screen flex bg-background" data-title={title}>
      {/* Sidebar Navigation */}
      <aside className="w-64 shrink-0 bg-card border-r border-border/60 flex flex-col h-screen sticky top-0 z-20 shadow-[1px_0_10px_rgba(0,0,0,0.01)]">
        {/* Brand details */}
        <div className="h-16 px-5 flex items-center gap-3 border-b border-border/50 shrink-0">
          <div className="w-9 h-9 rounded-xl overflow-hidden shadow-sm shrink-0 border border-border/30">
            <Image src="/assets/icon.webp" alt="Placement" width={36} height={36} className="object-cover w-full h-full" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-tight text-foreground">Placement</span>
              <Badge
                variant={roleBadgeVariant(user?.role ?? 'mentor')}
                className="text-[9px] uppercase tracking-widest px-1.5 h-4.5 font-bold shadow-none leading-none scale-90 origin-left shrink-0"
              >
                {roleLabel(user?.role ?? 'mentor')}
              </Badge>
            </div>
          </div>
        </div>

        {/* Nav lists */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto space-y-5 scrollbar-thin">
          <RoleBasedSidebar role={user?.role ?? 'mentor'} />
        </nav>

        {/* User profile footer */}
        {user && (
          <div className="shrink-0 p-4 border-t border-border/50 bg-muted/20 space-y-3">
            <div className="flex items-center gap-3 px-1">
              <Avatar className="w-9 h-9 shrink-0 border border-border/70 shadow-sm relative group-hover:scale-105 transition-transform duration-200">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-extrabold">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate leading-tight">{user.name}</p>
                <p className="text-[10px] text-muted-foreground truncate leading-none mt-0.5">{user.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-foreground h-9 px-2 text-xs rounded-xl font-bold transition-all duration-200"
              onClick={handleLogout}
            >
              <LogOut className="w-3.5 h-3.5 mr-2" />
              Sign Out
            </Button>
          </div>
        )}
      </aside>

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Sticky floating header */}
        <header className="h-16 shrink-0 bg-background/85 backdrop-blur-md border-b border-border/50 flex items-center justify-between px-6 sticky top-0 z-30">
          {/* Left section: Breadcrumbs navigation */}
          <div className="flex items-center gap-2 text-xs">
            {crumbs.map((crumb, idx) => (
              <div key={crumb.href} className="flex items-center gap-1.5 text-muted-foreground">
                {idx > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
                
                {crumb.icon ? (
                  <Link
                    href={crumb.href}
                    className="flex items-center gap-1 hover:text-foreground transition-colors font-semibold"
                  >
                    <crumb.icon className="w-3.5 h-3.5 shrink-0" />
                  </Link>
                ) : (
                  <span className={cn(
                    'font-semibold',
                    idx === crumbs.length - 1 ? 'text-foreground' : 'hover:text-foreground cursor-pointer'
                  )}>
                    {idx === crumbs.length - 1 ? crumb.label : <Link href={crumb.href}>{crumb.label}</Link>}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Right section: notifications & date */}
          <div className="flex items-center gap-4">
            <p className="text-[11px] font-bold text-muted-foreground/75 bg-muted/40 px-2.5 py-1 rounded-full border border-border/30 hidden sm:block">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        {/* Content viewport */}
        <main className="flex-1 p-6 overflow-y-auto bg-background scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  );
}