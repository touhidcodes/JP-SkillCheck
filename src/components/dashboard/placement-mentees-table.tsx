'use client';

import React from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlacementStore } from '@/lib/placement/store';

import { MenteesTableSearchAndActions } from './mentees-table/mentees-table-search-and-actions';
import { MenteesTableFilters } from './mentees-table/mentees-table-filters';
import { MenteesTableGrid } from './mentees-table/mentees-table-grid';
import { MenteesTablePagination } from './mentees-table/mentees-table-pagination';
import { MenteesTableBulkActions } from './mentees-table/mentees-table-bulk-actions';

import {
  useMenteesTableState,
  exportRows,
} from '@/hooks/use-mentees-table-state';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { StudentProfileSheet } from '@/components/dashboard/student-profile-sheet';
import { EditStudentDialog } from './dialogs/edit-student-dialog';
import { AddNoteDialog } from './dialogs/add-note-dialog';
import { LogProgressDialog } from './dialogs/log-progress-dialog';
import { CreateTaskDialog } from '@/components/mentor/tasks/create-task-dialog';

export function TableSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function TableError({ error }: { error: string }) {
  return (
    <Card className="border-red-200 dark:border-red-900/30 bg-red-500/5 dark:bg-red-950/10 rounded-2xl">
      <CardContent className="p-8 text-center space-y-3">
        <p className="font-bold text-red-700 dark:text-red-400 text-xs">{error}</p>
        <Button className="rounded-xl text-xs font-bold" onClick={() => window.location.reload()}>
          Retry Loading
        </Button>
      </CardContent>
    </Card>
  );
}

export function MenteesInsightBanner({ state }: any) {
  if (state.bannerDismissed || (state.highRiskCount === 0 && state.inactiveCount === 0)) return null;
  return (
    <div className="flex items-center justify-between rounded-xl border border-amber-200/50 bg-amber-500/5 px-4 py-3 text-xs font-semibold text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/10 dark:text-amber-300">
      <span className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
        {state.inactiveCount} students haven&apos;t been active in 14+ days. Review risk levels.
      </span>
      <button aria-label="Dismiss insight banner" onClick={() => state.setBannerDismissed(true)}>
        <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
      </button>
    </div>
  );
}

export function MenteesSummaryChips({ state }: any) {
  const chips = [
    { label: 'Total', value: state.filtered.length, tone: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
    { label: 'Hired', value: state.filtered.filter((s: any) => s.hired).length, tone: 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400' },
    { label: 'Terminated', value: state.filtered.filter((s: any) => s.terminated).length, tone: 'bg-red-500/10 text-red-700 dark:bg-red-950/20 dark:text-red-400' },
    { label: 'High Risk', value: state.highRiskCount, tone: 'bg-amber-500/10 text-amber-700 animate-pulse dark:bg-amber-950/20 dark:text-amber-400' },
    { label: 'No activity > 14 days', value: state.inactiveCount, tone: 'bg-red-500/10 text-red-600 dark:bg-red-950/20 dark:text-red-400' },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <span key={c.label} className={cn("rounded-full px-3 py-1 text-xs font-semibold shadow-2xs", c.tone)}>
          {c.value} {c.label}
        </span>
      ))}
    </div>
  );
}

export function MenteesDialogOrchestrator({ state, optimisticStudentUpdate }: any) {
  const handleDeleteConfirm = () => {
    state.selectedStudents.forEach((student: any) => {
      optimisticStudentUpdate(student.id, {
        terminated: true,
        terminated_reason: 'Bulk action',
        terminated_date: new Date().toISOString().slice(0, 10),
      });
    });
    state.setSelectedIds(new Set());
    state.setSelectAllFiltered(false);
    state.setConfirmDelete(false);
    toast.success('Mentees marked as terminated');
  };

  return (
    <>
      <AlertDialog open={state.confirmDelete} onOpenChange={state.setConfirmDelete}>
        <AlertDialogContent className="rounded-2xl border-border/60">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold text-foreground">Terminate selected students?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground">This marks selected students as terminated instead of hard deleting records.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs font-bold rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-650 text-white text-xs font-bold rounded-xl dark:bg-red-600 dark:hover:bg-red-500">Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <StudentProfileSheet student={state.selectedStudentForProfile} onClose={() => state.setSelectedStudentForProfile(null)} initialTab={state.selectedProfileTab} />
      <EditStudentDialog student={state.activeDialog?.type === 'edit' ? state.activeDialog.student : null} open={state.activeDialog?.type === 'edit'} onOpenChange={(open: boolean) => !open && state.setActiveDialog(null)} />
      <AddNoteDialog student={state.activeDialog?.type === 'note' ? state.activeDialog.student : null} open={state.activeDialog?.type === 'note'} onOpenChange={(open: boolean) => !open && state.setActiveDialog(null)} />
      <LogProgressDialog student={state.activeDialog?.type === 'log' ? state.activeDialog.student : null} open={state.activeDialog?.type === 'log'} onOpenChange={(open: boolean) => !open && state.setActiveDialog(null)} />
      <CreateTaskDialog
        students={state.activeDialog?.student ? [{ id: state.activeDialog.student.id, name: state.activeDialog.student.name }] : []}
        defaultStudentId={state.activeDialog?.student?.id}
        open={state.activeDialog?.type === 'task'}
        onOpenChange={(open: boolean) => !open && state.setActiveDialog(null)}
        onSuccess={() => state.setActiveDialog(null)}
      />
    </>
  );
}

export function PlacementMenteesTable({ onUpload }: { onUpload: () => void }) {
  const { students, riskScores, isLoading, error, optimisticStudentUpdate } = usePlacementStore();
  const state = useMenteesTableState(students, riskScores, onUpload, optimisticStudentUpdate);

  if (isLoading) return <TableSkeleton />;
  if (error) return <TableError error={error} />;

  return (
    <div className="space-y-5">
      <MenteesInsightBanner state={state} />
      <MenteesSummaryChips state={state} />
      
      <Card className="rounded-2xl border border-border/40 bg-card shadow-xs">
        <CardContent className="space-y-5 p-5">
          <MenteesTableSearchAndActions
            query={state.query}
            onQueryChange={state.setQuery}
            onExportView={() => exportRows(state.sorted, state.riskById, 'xlsx')}
            onExportFull={() => exportRows(students, state.riskById, 'csv')}
            onUploadClick={onUpload}
            viewMode={state.viewMode}
            onViewModeChange={state.setViewMode}
          />
          <MenteesTableFilters
            filters={state.filters}
            counts={state.counts}
            onFilterChange={state.handleFilterChange}
            onClearAll={() => state.setFilters({})}
          />
          <MenteesTableGrid
            pageRows={state.pageRows}
            selectedIds={state.selectedIds}
            onSelectAllPageRows={state.handleSelectAllPageRows}
            onSelectRow={state.handleSelectRow}
            riskById={state.riskById}
            debouncedQuery={state.debouncedQuery}
            editing={state.editing}
            dirtyCells={state.dirtyCells}
            onEdit={state.setEditing}
            onSave={state.handleSaveInline}
            onAction={state.handleAction}
            onUpdate={optimisticStudentUpdate}
            sorts={state.sorts}
            onToggleSort={state.handleToggleSort}
            viewMode={state.viewMode}
          />
          <MenteesTablePagination
            page={state.page}
            totalPages={state.totalPages}
            pageSize={state.pageSize}
            totalFiltered={state.sorted.length}
            onPageChange={state.setPage}
            onPageSizeChange={state.setPageSize}
          />
        </CardContent>
      </Card>

      {state.selectedCount > 0 && (
        <MenteesTableBulkActions
          selectedCount={state.selectedCount}
          onClearSelection={state.handleClearSelection}
          onSendMessage={() => {
            const emails = state.selectedStudents.map((s: any) => s.student_email).filter(Boolean);
            if (emails.length) window.location.href = `mailto:${emails.join(',')}`;
            else toast.error('No emails found for selected students');
          }}
          onAddToFollowUp={() => toast.success('Added selection to follow-up workflow')}
          onExportSelected={() => exportRows(state.selectedStudents, state.riskById, 'xlsx')}
          onDeleteSelected={() => state.setConfirmDelete(true)}
        />
      )}

      <MenteesDialogOrchestrator state={state} optimisticStudentUpdate={optimisticStudentUpdate} />
    </div>
  );
}
