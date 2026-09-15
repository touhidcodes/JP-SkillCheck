'use client';

import { cn } from '@/lib/utils';
import { AlertTriangle, Award, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export type PerformanceTier = 'Elite' | 'Strong' | 'Developing' | 'Needs Support';

export function getPerformanceTier(score: number, placementRate: number): PerformanceTier {
  if (score >= 80 && placementRate >= 30) return 'Elite';
  if (score >= 60 && placementRate >= 15) return 'Strong';
  if (score >= 40) return 'Developing';
  return 'Needs Support';
}

export const TIER_STYLES: Record<PerformanceTier, string> = {
  'Elite':         'bg-emerald-100 text-emerald-700 border-emerald-200',
  'Strong':        'bg-blue-100    text-blue-700    border-blue-200',
  'Developing':    'bg-amber-100   text-amber-700   border-amber-200',
  'Needs Support': 'bg-red-100     text-red-700     border-red-200',
};

export const TIER_DOT: Record<PerformanceTier, string> = {
  'Elite':         'bg-emerald-500',
  'Strong':        'bg-blue-500',
  'Developing':    'bg-amber-500',
  'Needs Support': 'bg-red-500',
};

interface MentorLeaderboardEntry {
  rank: number;
  mentor_email: string;
  mentor_name: string;
  total_students: number;
  hired: number;
  placement_rate: number;
  interviews_this_period: number;
  offers_this_period: number;
  at_risk: number;
  needs_support: boolean;
  score: number;
}

interface MentorLeaderboardCardProps {
  entries: MentorLeaderboardEntry[];
  maxToShow?: number;
}

function TrendIcon({ value }: { value: number }) {
  if (value > 0) return <TrendingUp className="w-3 h-3 text-emerald-500" />;
  if (value < 0) return <TrendingDown className="w-3 h-3 text-red-500" />;
  return <Minus className="w-3 h-3 text-muted-foreground" />;
}

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };
const AVATAR_PALETTE = [
  'bg-violet-100 text-violet-700', 'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700',
];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

export function MentorLeaderboardCard({ entries, maxToShow = 5 }: MentorLeaderboardCardProps) {
  const visible = entries.slice(0, maxToShow);

  if (!visible.length) {
    return <p className="text-sm text-muted-foreground text-center py-8">No mentor data</p>;
  }

  return (
    <div className="space-y-2">
      {visible.map((entry, idx) => {
        const tier = getPerformanceTier(entry.score, entry.placement_rate);
        const ac = avatarColor(entry.mentor_name);
        const isTop3 = entry.rank <= 3;

        return (
          <div
            key={entry.mentor_email}
            className={cn(
              'flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all duration-150',
              'hover:shadow-sm group',
              isTop3
                ? 'bg-gradient-to-r from-white to-muted/30 border-border/70'
                : entry.needs_support
                  ? 'bg-red-50/40 border-red-200/60 hover:bg-red-50/60'
                  : 'bg-background border-border/50 hover:bg-muted/20',
            )}
            style={{ animationDelay: `${idx * 0.05}s` }}
          >
            {/* Rank */}
            <div className="w-7 flex justify-center shrink-0">
              {isTop3
                ? <span className="text-lg leading-none select-none">{MEDAL[entry.rank]}</span>
                : <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[11px] font-bold text-muted-foreground">{entry.rank}</span>
              }
            </div>

            {/* Avatar */}
            <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0', ac)}>
              {getInitials(entry.mentor_name)}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm font-semibold text-foreground truncate leading-tight">
                  {entry.mentor_name}
                </span>
                <span className={cn(
                  'text-[10px] font-semibold px-1.5 py-0.5 rounded-full border leading-none shrink-0',
                  TIER_STYLES[tier],
                )}>
                  <span className={cn('inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle', TIER_DOT[tier])} />
                  {tier}
                </span>
                {entry.needs_support && (
                  <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-[11px] text-muted-foreground">{entry.total_students} mentees</span>
                <span className="text-[11px] text-emerald-600 font-medium">{entry.hired} hired</span>
                {entry.at_risk > 0 && (
                  <span className="text-[11px] text-red-600">{entry.at_risk} at risk</span>
                )}
              </div>
            </div>

            {/* Score bar + value */}
            <div className="w-24 shrink-0 hidden sm:flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Score</span>
                <span className="text-sm font-bold text-foreground tabular-nums">{entry.score}</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', TIER_DOT[tier])}
                  style={{ width: `${Math.min(100, entry.score)}%` }}
                />
              </div>
            </div>

            {/* Placement rate */}
            <div className="w-14 text-right shrink-0">
              <div className="flex items-center justify-end gap-0.5">
                <TrendIcon value={entry.placement_rate - 20} />
                <span className={cn(
                  'text-sm font-bold tabular-nums',
                  entry.placement_rate >= 30 ? 'text-emerald-600' :
                  entry.placement_rate >= 15 ? 'text-amber-600' : 'text-red-500',
                )}>
                  {entry.placement_rate}%
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">placed</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Top 3 Podium Hero Section */
export function MentorPodium({ entries }: { entries: MentorLeaderboardEntry[] }) {
  const top3 = entries.slice(0, 3);
  if (top3.length === 0) return null;

  const order = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3; // Silver, Gold, Bronze

  const podiumHeights: Record<number, string> = {
    0: 'h-20',   // silver (2nd)
    1: 'h-28',   // gold (1st)
    2: 'h-16',   // bronze (3rd)
  };
  const podiumColors: Record<number, string> = {
    0: 'bg-gradient-to-b from-slate-200 to-slate-300 border-slate-300',
    1: 'bg-gradient-to-b from-amber-200 to-amber-300 border-amber-300',
    2: 'bg-gradient-to-b from-orange-200 to-orange-300 border-orange-300',
  };

  return (
    <div className="flex items-end justify-center gap-2 pt-4 pb-2">
      {order.map((entry, podIdx) => {
        const tier = getPerformanceTier(entry.score, entry.placement_rate);
        const ac = avatarColor(entry.mentor_name);
        return (
          <div key={entry.mentor_email} className="flex flex-col items-center gap-2">
            {/* Card above podium */}
            <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-card border border-border/60 shadow-sm min-w-[90px]">
              <span className="text-xl">{MEDAL[entry.rank]}</span>
              <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold', ac)}>
                {getInitials(entry.mentor_name)}
              </div>
              <p className="text-[11px] font-semibold text-center leading-tight max-w-[80px] truncate">
                {entry.mentor_name.split(' ')[0]}
              </p>
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', TIER_STYLES[tier])}>
                {tier}
              </span>
              <div className="text-center">
                <p className="text-sm font-bold text-emerald-600">{entry.placement_rate}%</p>
                <p className="text-[9px] text-muted-foreground">placed</p>
              </div>
            </div>
            {/* Podium block */}
            <div className={cn(
              'w-full rounded-t-lg border-b-0',
              podiumHeights[podIdx],
              podiumColors[podIdx],
              'border',
            )}>
              <div className="flex items-center justify-center h-full">
                <span className="text-lg font-black text-white/80">#{entry.rank}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
