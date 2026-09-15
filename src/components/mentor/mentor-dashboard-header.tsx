'use client';

import { Upload, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MentorDashboardHeaderProps {
  totalMentees: number;
  batches: string[];
  activeBatch: string;
  onActiveBatchChange: (batch: string) => void;
  onImportClick: () => void;
}

export function MentorDashboardHeader({
  totalMentees,
  batches,
  activeBatch,
  onActiveBatchChange,
  onImportClick,
}: MentorDashboardHeaderProps) {
  return (
    <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between pb-2">
      {/* Background soft gradient mesh */}
      <div className="absolute -top-12 -left-12 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />
      
      <div>
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white lg:text-4xl bg-clip-text">
          Mentor Dashboard
        </h1>
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full bg-primary/10 dark:bg-primary/20 px-2.5 py-0.5 text-xs font-bold text-primary">
            <Users className="h-3.5 w-3.5" />
            <span>Active Mentor Mode</span>
          </div>
          <span className="text-xs text-muted-foreground/80 font-bold">•</span>
          <p className="text-xs text-muted-foreground font-bold">
            {totalMentees} {totalMentees === 1 ? 'student' : 'students'} assigned
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <Select value={activeBatch} onValueChange={onActiveBatchChange}>
          <SelectTrigger className="w-[180px] h-10 rounded-xl border-border/50 text-xs font-bold bg-card shadow-xs hover:bg-muted/30 transition-all duration-300">
            <SelectValue placeholder="Filter by Cohort" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border/60">
            <SelectItem value="all" className="text-xs font-semibold">All Cohorts</SelectItem>
            {batches.map((batch) => (
              <SelectItem key={batch} value={batch} className="text-xs font-semibold">
                Cohort {batch}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button 
          onClick={onImportClick} 
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs px-4 h-10 rounded-xl shadow-xs transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
        >
          <Upload className="h-3.5 w-3.5 stroke-[2.5]" />
          <span>Sync Excel Logs</span>
        </Button>
      </div>
    </div>
  );
}
