'use client';

import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MetricPopover } from '@/components/shared/metric-popover';

interface StatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: LucideIcon;
  color:
    | 'indigo'
    | 'red'
    | 'emerald'
    | 'amber'
    | 'blue'
    | 'orange'
    | 'purple'
    | 'violet';
  trend?: { value: number; label?: string }; // e.g. { value: 5, label: "vs last month" }
  info?: {
    description: string;
    metrics: string;
    calculation: string;
    importance: string;
  };
}

const colorMap: Record<
  StatsCardProps['color'],
  {
    border: string;
    iconBg: string;
    iconText: string;
    valuText: string;
    subtitleDot: string;
    gradient: string;
    cardBorderHover: string;
  }
> = {
  indigo: {
    border: 'border-l-4 border-l-indigo-500',
    iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
    iconText: 'text-indigo-600 dark:text-indigo-400',
    valuText: 'text-indigo-700 dark:text-indigo-400',
    subtitleDot: 'bg-indigo-400/60',
    gradient: 'from-indigo-500/5 via-transparent to-transparent',
    cardBorderHover: 'hover:border-indigo-500/25',
  },
  red: {
    border: 'border-l-4 border-l-red-500',
    iconBg: 'bg-red-500/10 dark:bg-red-500/20',
    iconText: 'text-red-600 dark:text-red-400',
    valuText: 'text-red-700 dark:text-red-400',
    subtitleDot: 'bg-red-400/60',
    gradient: 'from-red-500/5 via-transparent to-transparent',
    cardBorderHover: 'hover:border-red-500/25',
  },
  emerald: {
    border: 'border-l-4 border-l-emerald-500',
    iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    valuText: 'text-emerald-700 dark:text-emerald-400',
    subtitleDot: 'bg-emerald-400/60',
    gradient: 'from-emerald-500/5 via-transparent to-transparent',
    cardBorderHover: 'hover:border-emerald-500/25',
  },
  amber: {
    border: 'border-l-4 border-l-amber-500',
    iconBg: 'bg-amber-500/10 dark:bg-amber-500/20',
    iconText: 'text-amber-600 dark:text-amber-400',
    valuText: 'text-amber-700 dark:text-amber-400',
    subtitleDot: 'bg-amber-400/60',
    gradient: 'from-amber-500/5 via-transparent to-transparent',
    cardBorderHover: 'hover:border-amber-500/25',
  },
  blue: {
    border: 'border-l-4 border-l-blue-500',
    iconBg: 'bg-blue-500/10 dark:bg-blue-500/20',
    iconText: 'text-blue-600 dark:text-blue-400',
    valuText: 'text-blue-700 dark:text-blue-400',
    subtitleDot: 'bg-blue-400/60',
    gradient: 'from-blue-500/5 via-transparent to-transparent',
    cardBorderHover: 'hover:border-blue-500/25',
  },
  orange: {
    border: 'border-l-4 border-l-orange-500',
    iconBg: 'bg-orange-500/10 dark:bg-orange-500/20',
    iconText: 'text-orange-600 dark:text-orange-400',
    valuText: 'text-orange-700 dark:text-orange-400',
    subtitleDot: 'bg-orange-400/60',
    gradient: 'from-orange-500/5 via-transparent to-transparent',
    cardBorderHover: 'hover:border-orange-500/25',
  },
  purple: {
    border: 'border-l-4 border-l-purple-500',
    iconBg: 'bg-purple-500/10 dark:bg-purple-500/20',
    iconText: 'text-purple-600 dark:text-purple-400',
    valuText: 'text-purple-700 dark:text-purple-400',
    subtitleDot: 'bg-purple-400/60',
    gradient: 'from-purple-500/5 via-transparent to-transparent',
    cardBorderHover: 'hover:border-purple-500/25',
  },
  violet: {
    border: 'border-l-4 border-l-violet-500',
    iconBg: 'bg-violet-500/10 dark:bg-violet-500/20',
    iconText: 'text-violet-600 dark:text-violet-400',
    valuText: 'text-violet-700 dark:text-violet-400',
    subtitleDot: 'bg-violet-400/60',
    gradient: 'from-violet-500/5 via-transparent to-transparent',
    cardBorderHover: 'hover:border-violet-500/25',
  },
};

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
  info,
}: StatsCardProps) {
  const c = colorMap[color];

  const trendPositive = trend && trend.value > 0;
  const trendNegative = trend && trend.value < 0;
  const trendNeutral = trend && trend.value === 0;

  return (
    <div
      className={cn(
        'relative flex items-center gap-4 rounded-2xl border border-border/50 bg-card px-5 py-4 min-h-[110px]',
        'shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 group overflow-hidden',
        c.border,
        c.cardBorderHover
      )}
    >
      {/* Dynamic gradient overlay mesh */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br pointer-events-none opacity-40 transition-opacity duration-300 group-hover:opacity-60',
          c.gradient
        )}
      />

      {/* Info Popover in the top right corner */}
      {info && (
        <div className="absolute top-2.5 right-2.5 z-20">
          <MetricPopover
            title={title}
            description={info.description}
            metrics={info.metrics}
            calculation={info.calculation}
            importance={info.importance}
            side="bottom"
            align="end"
          />
        </div>
      )}

      {/* Modern abstract background watermark */}
      <div className="absolute -right-4 -bottom-4 opacity-[0.03] transition-all duration-500 group-hover:opacity-[0.06] group-hover:scale-110 group-hover:-rotate-6 pointer-events-none">
        <Icon className="w-24 h-24 text-foreground" />
      </div>

      {/* Left side: Accent Icon Box */}
      <div
        className={cn(
          'p-3 rounded-xl shrink-0 relative z-10 transition-transform duration-300 group-hover:scale-105',
          c.iconBg
        )}
      >
        <Icon className={cn('w-5.5 h-5.5', c.iconText)} />
      </div>

      {/* Right side: Information Details */}
      <div className="flex flex-col min-w-0 relative z-10 flex-1">
        <p className="text-[10px] font-bold text-muted-foreground/80 tracking-wider uppercase truncate pr-6">
          {title}
        </p>

        <div className="flex items-baseline gap-2 mt-0.5">
          <p
            className={cn(
              'text-2xl font-black leading-tight tracking-tight tabular-nums',
              c.valuText
            )}
          >
            {value}
          </p>

          {/* Styled Dynamic Trend Badge */}
          {trend && (
            <div
              className={cn(
                'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-bold transition-colors',
                trendPositive
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : trendNegative
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                    : 'bg-muted text-muted-foreground'
              )}
            >
              {trendPositive && <TrendingUp className="w-2.5 h-2.5" />}
              {trendNegative && <TrendingDown className="w-2.5 h-2.5" />}
              {trendNeutral && <Minus className="w-2.5 h-2.5" />}
              <span>
                {trendPositive ? '+' : ''}
                {trend.value}%
              </span>
            </div>
          )}
        </div>

        {/* Dynamic Contextual Subtitle */}
        {subtitle && (
          <div className="flex items-center gap-1.5 mt-1 shrink-0">
            <span className={cn('w-1 h-1 rounded-full shrink-0', c.subtitleDot)} />
            <p className="text-[10px] text-muted-foreground/75 font-semibold truncate leading-none">
              {subtitle}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
