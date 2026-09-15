'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricPopover } from '@/components/shared/metric-popover';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const COHORT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

interface CohortEntry {
  batch: string;
  total: number;
  active: number;
  placed: number;
  hired: number;
  placementRate: number;
  hireRate: number;
  learning: number;
  applying: number;
  interviewing: number;
  offer_pending: number;
}

interface CohortMatrixProps {
  cohorts: CohortEntry[];
}

export function CohortMatrix({ cohorts }: CohortMatrixProps) {
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(() => [...cohorts].sort((a, b) => b.total - a.total), [cohorts]);
  const displayed = useMemo(() => showAll ? sorted : sorted.slice(0, 5), [sorted, showAll]);

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            Cohort Comparison
            <MetricPopover
              title="Cohort Comparison"
              description="A side-by-side performance view of different student batches/cohorts."
              metrics="Student count, completion rates, and hired ratios per cohort."
              calculation="For each cohort: (Hired / Total) * 100, plus aggregate event logging."
              importance="Indicates whether newer cohorts are improving compared to older ones, validating curriculum or strategy changes."
            />
          </CardTitle>
          {cohorts.length > 5 && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="flex items-center gap-1 text-xs text-primary hover:underline font-bold"
            >
              {showAll ? <><ChevronUp className="w-3.5 h-3.5" /> Show less</> : <><ChevronDown className="w-3.5 h-3.5" /> Show all {cohorts.length}</>}
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Placement and hire rates by batch</p>
      </CardHeader>
      <CardContent className="px-5 pb-5 space-y-6">
        <CohortBarChart cohorts={displayed} />
        <CohortTable cohorts={displayed} />
      </CardContent>
    </Card>
  );
}

function CohortBarChart({ cohorts }: { cohorts: CohortEntry[] }) {
  const chartData = useMemo(() => cohorts.map(c => ({
    batch: c.batch,
    'Hire Rate %': c.hireRate,
    'Placement %': c.placementRate,
  })), [cohorts]);

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
          <XAxis
            dataKey="batch"
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            stroke="hsl(var(--muted-foreground))"
            tickLine={false}
            interval={0}
            angle={-25}
            textAnchor="end"
          />
          <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} unit="%" />
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '10px', fontSize: '11px' }}
            labelFormatter={(label) => `Batch: ${label}`}
          />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          <Bar dataKey="Hire Rate %" fill="#6366f1" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Placement %" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function CohortTable({ cohorts }: { cohorts: CohortEntry[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/50 bg-background">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/50 bg-muted/30">
            {['Batch', 'Total', 'Active', 'Placed', 'Hired', 'Hire Rate', 'Placement'].map(h => (
              <th key={h} className={cn('py-2.5 px-3 text-muted-foreground font-semibold uppercase tracking-wider', h === 'Batch' ? 'text-left' : 'text-right')}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c, i) => (
            <tr key={c.batch} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
              <td className="py-2.5 px-3">
                <div className="flex items-center gap-1.5 font-semibold">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COHORT_COLORS[i % COHORT_COLORS.length] }} />
                  {c.batch}
                </div>
              </td>
              <td className="py-2.5 px-3 text-right tabular-nums">{c.total}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-blue-600 font-medium">{c.active}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-violet-600">{c.placed}</td>
              <td className="py-2.5 px-3 text-right tabular-nums text-emerald-600 font-bold">{c.hired}</td>
              <td className="py-2.5 px-3 text-right font-bold tabular-nums text-emerald-600">{c.hireRate}%</td>
              <td className="py-2.5 px-3 text-right font-bold tabular-nums text-emerald-700">{c.placementRate}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
