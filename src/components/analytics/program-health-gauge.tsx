'use client';

import { cn } from '@/lib/utils';

interface ProgramHealthGaugeProps {
  score: number; // 0–100
  size?: 'sm' | 'md' | 'lg';
}

function getHealthLabel(score: number): { label: string; color: string; bg: string; ring: string } {
  if (score >= 80) return { label: 'Excellent', color: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'stroke-emerald-500' };
  if (score >= 60) return { label: 'Good',      color: 'text-blue-600',   bg: 'bg-blue-50',   ring: 'stroke-blue-500'   };
  if (score >= 40) return { label: 'Fair',      color: 'text-amber-600',  bg: 'bg-amber-50',  ring: 'stroke-amber-500'  };
  return { label: 'Needs Attention', color: 'text-red-600', bg: 'bg-red-50', ring: 'stroke-red-500' };
}

/**
 * Computes a composite program health score from analytics data.
 * Weights: placement rate (40%) + low at-risk ratio (30%) + avg mentor activity (30%)
 */
export function computeHealthScore(mentors: {
  totalMentees: number;
  hired: number;
  placed: number;
  atRisk: number;
  activityScore: number;
}[]): number {
  if (!mentors.length) return 0;

  const totalMentees  = mentors.reduce((s, m) => s + m.totalMentees, 0);
  const totalPlaced   = mentors.reduce((s, m) => s + m.placed + m.hired, 0);
  const totalAtRisk   = mentors.reduce((s, m) => s + m.atRisk, 0);
  const avgActivity   = mentors.reduce((s, m) => s + m.activityScore, 0) / mentors.length;

  const placementRate = totalMentees > 0 ? (totalPlaced / totalMentees) * 100 : 0;
  const safeRatio     = totalMentees > 0 ? (1 - totalAtRisk / totalMentees) * 100 : 100;

  const score = Math.round(placementRate * 0.4 + safeRatio * 0.3 + avgActivity * 0.3);
  return Math.min(100, Math.max(0, score));
}

export function ProgramHealthGauge({ score, size = 'md' }: ProgramHealthGaugeProps) {
  const { label, color, ring } = getHealthLabel(score);

  // SVG circle gauge
  const sizes = { sm: 96, md: 140, lg: 180 };
  const dim = sizes[size];
  const r = (dim / 2) - 12;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (score / 100) * circumference;

  const textSize = { sm: 'text-xl', md: 'text-3xl', lg: 'text-4xl' };
  const labelSize = { sm: 'text-[10px]', md: 'text-xs', label: 'text-sm' };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
          {/* Track */}
          <circle
            cx={dim / 2} cy={dim / 2} r={r}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="10"
          />
          {/* Progress arc */}
          <circle
            cx={dim / 2} cy={dim / 2} r={r}
            fill="none"
            className={ring}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${dim / 2} ${dim / 2})`}
            style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('font-black tabular-nums leading-none', textSize[size], color)}>
            {score}
          </span>
          <span className={cn('text-muted-foreground mt-0.5', labelSize.sm)}>/ 100</span>
        </div>
      </div>

      <div className="text-center">
        <p className={cn('font-semibold', labelSize.label, color)}>{label}</p>
        <p className="text-xs text-muted-foreground">Program Health</p>
      </div>
    </div>
  );
}
