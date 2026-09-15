'use client';

import { Search, HelpCircle, FileDown, Download, Upload, LayoutGrid, List, BookOpen, AlertTriangle, RefreshCw, MousePointerClick } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SearchAndActionsProps {
  query: string;
  onQueryChange: (query: string) => void;
  onExportView: () => void;
  onExportFull: () => void;
  onUploadClick: () => void;
  viewMode: 'grid' | 'table';
  onViewModeChange: (mode: 'grid' | 'table') => void;
}

function GuideModalContent() {
  return (
    <ScrollArea className="flex-1 p-6 overflow-y-auto max-h-[65vh]">
      <div className="space-y-6">
        {/* Card 1: Directory Overview */}
        <div className="flex flex-col gap-3 p-5 rounded-2xl border border-border/30 dark:border-border/10 bg-indigo-500/5 dark:bg-indigo-500/10 border-l-4 border-l-indigo-500 transition-all duration-300 hover:shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-background shadow-2xs shrink-0 border border-indigo-500/15">
              <BookOpen className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-foreground text-xs leading-tight">
                Directory Overview
              </h4>
              <p className="text-[11px] leading-relaxed text-muted-foreground font-medium">
                This table acts as your central interface for tracking student placement status. Double-click cells to inline-edit active projects, stages, or experience flags.
              </p>
            </div>
          </div>
          
          {/* Visual Interactive Preview */}
          <div className="mt-1 p-3.5 rounded-xl bg-card border border-border/45 text-[11px] space-y-2.5 shadow-2xs select-none">
            <div className="flex items-center justify-between text-[9px] text-muted-foreground border-b border-border/30 pb-2 font-black tracking-wider uppercase">
              <span>Mentee Name</span>
              <span>Placement Stage</span>
              <span>Active Project</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 font-bold">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-black">
                  AR
                </div>
                <div>
                  <div className="text-[11px] font-bold text-foreground">Alex Rivera</div>
                  <div className="text-[9px] text-muted-foreground font-medium leading-none mt-0.5">alex.rivera@example.com</div>
                </div>
              </div>
              
              <div className="flex items-center justify-between sm:justify-end gap-3 flex-1 sm:flex-initial">
                <span className="px-2 py-0.5 rounded-md text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-black tracking-wide uppercase">
                  Interviewing
                </span>
                
                <div className="group relative px-2.5 py-1.5 rounded-lg border border-dashed border-indigo-500/40 hover:border-indigo-500 bg-indigo-500/5 transition-all text-[10px] text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 font-black">
                  <span>e-Commerce App</span>
                  <MousePointerClick className="w-3.5 h-3.5 animate-pulse text-indigo-600 dark:text-indigo-400 shrink-0" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Risk Flags Calculation */}
        <div className="flex flex-col gap-3 p-5 rounded-2xl border border-border/30 dark:border-border/10 bg-amber-500/5 dark:bg-amber-500/10 border-l-4 border-l-amber-500 transition-all duration-300 hover:shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-background shadow-2xs shrink-0 border border-amber-500/15">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-foreground text-xs leading-tight">
                Risk Flags Calculation
              </h4>
              <p className="text-[11px] leading-relaxed text-muted-foreground font-medium">
                Risk is evaluated dynamically based on attendance percentages, days since last recorded progress logs, stalled pipeline phases, and mock scores.
              </p>
            </div>
          </div>
          
          {/* Visual Interactive Preview */}
          <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
            <div className="p-3 rounded-xl bg-card border border-border/45 flex items-center justify-between shadow-2xs select-none">
              <div className="space-y-0.5">
                <div className="text-[10px] text-muted-foreground font-bold">Attendance Rate</div>
                <div className="text-[11px] font-black text-foreground">Critical Threshold</div>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                74%
              </span>
            </div>
            
            <div className="p-3 rounded-xl bg-card border border-border/45 flex items-center justify-between shadow-2xs select-none">
              <div className="space-y-0.5">
                <div className="text-[10px] text-muted-foreground font-bold">Mock Score</div>
                <div className="text-[11px] font-black text-foreground">Warning Threshold</div>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                62%
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Background Synchronization */}
        <div className="flex flex-col gap-3 p-5 rounded-2xl border border-border/30 dark:border-border/10 bg-emerald-500/5 dark:bg-emerald-500/10 border-l-4 border-l-emerald-500 transition-all duration-300 hover:shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-background shadow-2xs shrink-0 border border-emerald-500/15">
              <RefreshCw className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-1">
              <h4 className="font-black text-foreground text-xs leading-tight">
                Background Synchronization
              </h4>
              <p className="text-[11px] leading-relaxed text-muted-foreground font-medium">
                Every edit executes optimistic state patches inside the React context while scheduling reliable, asynchronous background sync updates with active Google Sheets API database tabs.
              </p>
            </div>
          </div>
          
          {/* Visual Data Flow Diagram */}
          <div className="mt-1 p-3.5 rounded-xl bg-card border border-border/45 text-[11px] flex items-center justify-between gap-1.5 shadow-2xs select-none">
            <div className="flex items-center gap-2 bg-background px-3 py-2 rounded-lg border border-border/50 shadow-3xs font-black">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shrink-0" />
              <span className="text-[10px]">Client Edit</span>
            </div>
            
            <div className="flex-1 flex items-center justify-center px-1 text-muted-foreground">
              <div className="relative w-full flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-dashed border-emerald-500/30" />
                </div>
                <span className="relative bg-card px-2 py-0.5 rounded-md border border-emerald-500/25 text-[8px] text-emerald-600 dark:text-emerald-400 font-extrabold tracking-widest uppercase flex items-center gap-1 shadow-3xs">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin text-emerald-600 dark:text-emerald-400" />
                  Auto-Sync
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 bg-background px-3 py-2 rounded-lg border border-border/50 shadow-3xs font-black">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span className="text-[10px]">Google Sheets</span>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

export function MenteesTableSearchAndActions({
  query,
  onQueryChange,
  onExportView,
  onExportFull,
  onUploadClick,
  viewMode,
  onViewModeChange,
}: SearchAndActionsProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="relative min-w-[240px] flex-1">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search name, email, batch, project"
          className="pl-9 h-10 rounded-xl bg-card border-border/50 text-xs font-semibold"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup value={[viewMode]} onValueChange={(v) => v.length > 0 && onViewModeChange(v[0] as 'grid' | 'table')} className="hidden md:flex bg-card border border-border/50 rounded-xl p-0.5">
          <ToggleGroupItem value="grid" aria-label="Grid View" className="h-9 w-9 p-0 rounded-lg data-[state=on]:bg-primary/10 data-[state=on]:text-primary">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="table" aria-label="Table View" className="h-9 w-9 p-0 rounded-lg data-[state=on]:bg-primary/10 data-[state=on]:text-primary">
            <List className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        <Dialog>
          <DialogTrigger render={<span />}>
            <Button variant="outline" size="icon" className="h-10 w-10 text-muted-foreground hover:text-foreground border border-border/50 rounded-xl" title="Table Guide & Help">
              <HelpCircle className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md lg:max-w-lg bg-card border-border/40 rounded-2xl shadow-xl flex flex-col p-0 overflow-hidden">
            <DialogHeader className="p-6 border-b border-border/40 shrink-0 bg-muted/20 dark:bg-muted/10">
              <DialogTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" />
                Mentee Directory Guide
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-semibold">
                How to interact with student rows, formulas, and exports.
              </DialogDescription>
            </DialogHeader>
            <GuideModalContent />
            <DialogFooter className="p-4 border-t border-border/40 bg-muted/20 dark:bg-muted/10 shrink-0">
              <DialogClose render={<span />}>
                <Button variant="outline" className="text-xs font-black rounded-xl hover:bg-muted/45 px-5 h-9">
                  Close Guide
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button variant="outline" onClick={onExportView} className="h-10 text-xs font-bold text-muted-foreground border-border/50 rounded-xl"><FileDown className="mr-2 h-4 w-4" />Export view</Button>
        <Button variant="outline" onClick={onExportFull} className="h-10 text-xs font-bold text-muted-foreground border-border/50 rounded-xl"><Download className="mr-2 h-4 w-4" />Export full</Button>
        <Button onClick={onUploadClick} className="bg-primary hover:bg-primary/90 text-primary-foreground font-extrabold text-xs h-10 px-4 rounded-xl shadow-xs"><Upload className="mr-2 h-4 w-4" />Upload Excel</Button>
      </div>
    </div>
  );
}
