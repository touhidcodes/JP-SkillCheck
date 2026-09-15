'use client';

/**
 * NotificationBell
 *
 * Shows unread notification count in the header.
 * Clicking opens a sleek, glassmorphic dropdown with recent risk alerts.
 * Supports mark-as-read per notification and mark-all-read.
 * Integrates live, beautifully-styled sonner toasts on new notifications.
 *
 * Polls every 60 seconds to fetch fresh alerts.
 */

import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Trophy,
  ShieldAlert,
  Clock,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  CheckCheck,
  AlertCircle,
  Inbox
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Notification {
  id: string;
  recipient_email: string;
  type: string;
  student_id: string;
  student_name: string;
  message: string;
  read: boolean;
  created_at: string;
  payload?: any;
}

const TYPE_CONFIGS: Record<string, {
  icon: React.ComponentType<any>;
  bgClass: string;
  iconClass: string;
  borderClass: string;
}> = {
  risk_alert: {
    icon: AlertTriangle,
    bgClass: 'bg-red-500/10 dark:bg-red-500/20',
    iconClass: 'text-red-500',
    borderClass: 'border-red-500/30'
  },
  risk_resolved: {
    icon: CheckCircle2,
    bgClass: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    iconClass: 'text-emerald-500',
    borderClass: 'border-emerald-500/30'
  },
  mentor_at_risk: {
    icon: ShieldAlert,
    bgClass: 'bg-rose-500/10 dark:bg-rose-500/20',
    iconClass: 'text-rose-500',
    borderClass: 'border-rose-500/30'
  },
  mentor_needs_support: {
    icon: ShieldAlert,
    bgClass: 'bg-amber-500/10 dark:bg-amber-500/20',
    iconClass: 'text-amber-500',
    borderClass: 'border-amber-500/30'
  },
  mentor_kpi_achieved: {
    icon: Trophy,
    bgClass: 'bg-yellow-500/10 dark:bg-yellow-500/20',
    iconClass: 'text-yellow-500',
    borderClass: 'border-yellow-500/30'
  },
  mentor_kpi_failed: {
    icon: TrendingDown,
    bgClass: 'bg-red-500/10 dark:bg-red-500/20',
    iconClass: 'text-red-500',
    borderClass: 'border-red-500/30'
  },
  mentor_kpi_behind: {
    icon: Clock,
    bgClass: 'bg-amber-500/10 dark:bg-amber-500/20',
    iconClass: 'text-amber-500',
    borderClass: 'border-amber-500/30'
  },
  student_inactivity: {
    icon: Clock,
    bgClass: 'bg-blue-500/10 dark:bg-blue-500/20',
    iconClass: 'text-blue-500',
    borderClass: 'border-blue-500/30'
  },
  student_attendance_drop: {
    icon: TrendingDown,
    bgClass: 'bg-rose-500/10 dark:bg-rose-500/20',
    iconClass: 'text-rose-500',
    borderClass: 'border-rose-500/30'
  },
  student_progress_decline: {
    icon: TrendingDown,
    bgClass: 'bg-orange-500/10 dark:bg-orange-500/20',
    iconClass: 'text-orange-500',
    borderClass: 'border-orange-500/30'
  },
};

const DEFAULT_CONFIG = {
  icon: AlertCircle,
  bgClass: 'bg-gray-500/10 dark:bg-gray-500/20',
  iconClass: 'text-gray-500',
  borderClass: 'border-gray-500/30'
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [shownToasts, setShownToasts] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await fetch('/api/notifications?limit=25');
      if (!res.ok) return { data: [], unread_count: 0 };
      return res.json() as Promise<{ data: Notification[]; unread_count: number }>;
    },
    refetchInterval: 60_000,
  });

  const notifications = data?.data ?? [];
  const unreadCount = data?.unread_count ?? 0;

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}`, { method: 'PATCH' });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  const markAllRead = async () => {
    await fetch('/api/notifications?action=read-all', { method: 'POST' });
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    toast.success('All notifications marked as read');
  };

  // Live premium sonner toasts for new incoming unread notifications
  useEffect(() => {
    if (!notifications || notifications.length === 0) return;
    const unread = notifications.filter(n => !n.read);
    
    unread.forEach(n => {
      // Toast if created in last 5 minutes and hasn't been toasted in this session
      const isRecent = (Date.now() - new Date(n.created_at).getTime()) < 5 * 60 * 1000;
      if (isRecent && !shownToasts.has(n.id)) {
        setShownToasts(prev => {
          const next = new Set(prev);
          next.add(n.id);
          return next;
        });

        const config = TYPE_CONFIGS[n.type] || DEFAULT_CONFIG;
        const Icon = config.icon;

        toast.custom((t) => (
          <div className="flex items-start gap-3 p-4 rounded-xl border border-border bg-popover/90 backdrop-blur-md shadow-2xl w-full max-w-sm transition-all duration-300 animate-in fade-in-50 slide-in-from-bottom-5">
            <div className={cn("p-2 rounded-lg shrink-0", config.bgClass)}>
              <Icon className={cn("w-4 h-4", config.iconClass)} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">New Alert</p>
              <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{n.message}</p>
            </div>
            <button
              onClick={() => {
                markRead(n.id);
                toast.dismiss(t);
              }}
              className="text-[11px] font-medium text-primary hover:text-primary/80 shrink-0 self-center px-2 py-1.5 rounded bg-secondary hover:bg-secondary/80 transition-colors"
            >
              Dismiss
            </button>
          </div>
        ), { duration: 6000 });
      }
    });
  }, [notifications, shownToasts]);

  const filteredNotifications = notifications.filter(n => {
    if (activeTab === 'unread') return !n.read;
    return true;
  });

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setOpen(v => !v)}
        className={cn(
          "relative inline-flex items-center justify-center w-10 h-10 rounded-xl border transition-all duration-200 focus:outline-none",
          open
            ? "border-primary bg-primary/5 text-primary shadow-sm"
            : "border-border bg-background hover:bg-muted text-foreground"
        )}
        aria-label="Notifications"
      >
        <Bell className={cn("w-4.5 h-4.5", open && "animate-pulse")} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] rounded-full bg-red-600 text-white text-[10px] font-extrabold flex items-center justify-center px-1 shadow-md border-2 border-background animate-bounce">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Card */}
      {open && (
        <>
          {/* Invisible Backdrop to close on click outside */}
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setOpen(false)}
          />

          <div className="absolute right-0 top-12 z-50 w-96 rounded-2xl border border-border bg-popover/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex flex-col gap-3 px-4 pt-4 pb-3 border-b border-border/50 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground tracking-tight flex items-center gap-1.5">
                  Inbox
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold text-red-600 bg-red-500/10 px-2 py-0.5 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-primary hover:underline font-semibold transition-all"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 p-0.5 rounded-lg bg-secondary/60">
                <button
                  onClick={() => setActiveTab('all')}
                  className={cn(
                    "flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all",
                    activeTab === 'all'
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  All
                </button>
                <button
                  onClick={() => setActiveTab('unread')}
                  className={cn(
                    "flex-1 text-center py-1.5 text-xs font-semibold rounded-md transition-all",
                    activeTab === 'unread'
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Unread ({unreadCount})
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-96 overflow-y-auto divide-y divide-border/30 custom-scrollbar">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                  <div className="p-3 rounded-full bg-muted/50 text-muted-foreground/40">
                    <Inbox className="w-8 h-8" />
                  </div>
                  <div className="px-6">
                    <p className="text-xs font-bold text-foreground">All caught up!</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">No notifications match this filter.</p>
                  </div>
                </div>
              ) : (
                filteredNotifications.map(n => {
                  const config = TYPE_CONFIGS[n.type] || DEFAULT_CONFIG;
                  const Icon = config.icon;

                  return (
                    <div
                      key={n.id}
                      className={cn(
                        'flex items-start gap-3.5 px-4 py-3.5 transition-all relative border-l-2',
                        n.read
                          ? 'border-transparent bg-background/40 hover:bg-background/80'
                          : cn('bg-primary/5 hover:bg-primary/10', config.borderClass)
                      )}
                    >
                      {/* Left Icon badge */}
                      <div className={cn(
                        'mt-0.5 shrink-0 w-8 h-8 rounded-xl flex items-center justify-center shadow-sm border border-transparent',
                        config.bgClass
                      )}>
                        <Icon className={cn("w-4 h-4", config.iconClass)} />
                      </div>

                      {/* Content block */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-xs leading-relaxed',
                          n.read ? 'text-muted-foreground' : 'text-foreground font-medium'
                        )}>
                          {n.message}
                        </p>
                        
                        {/* Interactive fields from payload if present */}
                        {n.payload?.details && (
                          <p className="text-[10px] text-orange-600 dark:text-orange-400 bg-orange-500/5 border border-orange-500/10 px-2 py-1 rounded-md mt-1.5 leading-snug">
                            {n.payload.details}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-[10px] text-muted-foreground font-medium">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </span>
                          {!n.read && (
                            <>
                              <span className="text-[10px] text-muted-foreground/30">•</span>
                              <button
                                onClick={() => markRead(n.id)}
                                className="text-[10px] text-primary hover:underline font-semibold"
                              >
                                Mark read
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Small blue dot indicator for unread */}
                      {!n.read && (
                        <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-2" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
