/**
 * WHY this file exists:
 * Top-level KPI grid for the analytics overview page. Shows 4 headline numbers
 * that managers care about most: total students, at-risk, interviewing,
 * and offer pending. Placed side-by-side at the top of the page for immediate
 * situational awareness.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, AlertTriangle, UsersRound, Clock } from 'lucide-react';

interface KpiGridProps {
  totalStudents: number;
  riskCount: number;
  interviewing: number;
  offerPending: number;
  activeStudents: number;
}

export function KpiGrid({ totalStudents, riskCount, interviewing, offerPending, activeStudents }: KpiGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
          <Users className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <p className="text-3xl font-bold">{totalStudents}</p>
          <p className="text-xs text-muted-foreground mt-1">{activeStudents} active</p>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-medium text-muted-foreground">At Risk</CardTitle>
          <AlertTriangle className="w-4 h-4 text-red-500" />
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <p className="text-3xl font-bold">{riskCount}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {riskCount > 5 ? 'Needs attention' : 'Under control'}
          </p>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-medium text-muted-foreground">Interviewing</CardTitle>
          <UsersRound className="w-4 h-4 text-blue-500" />
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <p className="text-3xl font-bold">{interviewing}</p>
          <p className="text-xs text-muted-foreground mt-1">students in pipeline</p>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-medium text-muted-foreground">Offer Pending</CardTitle>
          <Clock className="w-4 h-4 text-amber-500" />
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <p className="text-3xl font-bold">{offerPending}</p>
          <p className="text-xs text-muted-foreground mt-1">awaiting response</p>
        </CardContent>
      </Card>
    </div>
  );
}