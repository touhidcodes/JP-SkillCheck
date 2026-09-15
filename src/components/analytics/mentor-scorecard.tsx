import { cn } from '@/lib/utils';
import type { MentorEntry } from '@/lib/analytics/engine';

interface MentorScorecardProps {
  data: MentorEntry[];
}

export function MentorScorecard({ data }: MentorScorecardProps) {
  if (!data.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        No mentor data available
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border/50 bg-background overflow-hidden shadow-sm">
      {/* Header */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 border-b border-border/60">
              <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                Mentor
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                Mentees
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                Active
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                Placed
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                Hired
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                At Risk
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                Interviews/mo
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                Avg Days to Hire
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                Activity Score
              </th>
            </tr>
          </thead>

          <tbody>
            {data.map((m) => (
              <tr
                key={m.email}
                className="border-b border-border/40 last:border-b-0 hover:bg-muted/30 transition-colors"
              >
                {/* Mentor name + email */}
                <td className="py-3 px-4">
                  <p className="font-semibold text-foreground leading-tight">{m.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.email}</p>
                </td>

                {/* Mentees */}
                <td className="py-3 px-4 text-right">
                  <span className="text-sm text-foreground tabular-nums">{m.totalMentees}</span>
                </td>

                {/* Active */}
                <td className="py-3 px-4 text-right">
                  <span className="text-sm text-foreground tabular-nums">{m.activeMentees}</span>
                </td>

                {/* Placed */}
                <td className="py-3 px-4 text-right">
                  <span className={cn(
                    'text-sm font-semibold tabular-nums',
                    m.placed > 0 ? 'text-emerald-600' : 'text-muted-foreground',
                  )}>
                    {m.placed}
                  </span>
                </td>

                {/* Hired */}
                <td className="py-3 px-4 text-right">
                  <span className={cn(
                    'text-sm font-semibold tabular-nums',
                    m.hired > 0 ? 'text-emerald-700' : 'text-muted-foreground',
                  )}>
                    {m.hired}
                  </span>
                </td>

                {/* At Risk */}
                <td className="py-3 px-4 text-right">
                  <span className={cn(
                    'text-sm font-semibold tabular-nums',
                    m.atRisk > 0 ? 'text-red-500' : 'text-muted-foreground',
                  )}>
                    {m.atRisk}
                  </span>
                </td>

                {/* Interviews/mo */}
                <td className="py-3 px-4 text-right">
                  <span className="text-sm text-foreground tabular-nums">{m.interviewsThisMonth}</span>
                </td>

                {/* Avg Days to Hire */}
                <td className="py-3 px-4 text-right">
                  <span className="text-sm text-foreground tabular-nums">
                    {m.avgDaysToPlacement > 0 ? `${m.avgDaysToPlacement}d` : '—'}
                  </span>
                </td>

                {/* Activity Score */}
                <td className="py-3 px-4 text-right">
                  <span className={cn(
                    'text-sm font-bold tabular-nums',
                    m.activityScore >= 80 ? 'text-emerald-600' :
                    m.activityScore >= 60 ? 'text-amber-600' : 'text-red-500',
                  )}>
                    {m.activityScore}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
