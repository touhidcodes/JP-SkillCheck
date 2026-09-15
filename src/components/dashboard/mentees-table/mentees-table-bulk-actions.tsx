'use client';

import { MessageSquare, Trash2, FileSpreadsheet, X, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MenteesTableBulkActionsProps {
  selectedCount: number;
  onClearSelection: () => void;
  onSendMessage: () => void;
  onAddToFollowUp: () => void;
  onExportSelected: () => void;
  onDeleteSelected: () => void;
}

export function MenteesTableBulkActions({
  selectedCount,
  onClearSelection,
  onSendMessage,
  onAddToFollowUp,
  onExportSelected,
  onDeleteSelected,
}: MenteesTableBulkActionsProps) {
  return (
    <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center animate-fade-in-up">
      <div className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-primary/20 bg-card/90 backdrop-blur-md px-6 py-3.5 shadow-2xl min-w-[500px]">
        <span className="text-xs font-black text-primary border-r border-border/50 pr-4">
          {selectedCount} selected
        </span>
        <Button variant="ghost" size="sm" onClick={onSendMessage} className="h-8 text-xs font-bold text-muted-foreground hover:text-foreground">
          <MessageSquare className="mr-1.5 h-3.5 w-3.5 text-primary" />Message
        </Button>
        <Button variant="ghost" size="sm" onClick={onAddToFollowUp} className="h-8 text-xs font-bold text-muted-foreground hover:text-foreground">
          <HelpCircle className="mr-1.5 h-3.5 w-3.5 text-amber-500" />Follow-up
        </Button>
        <Button variant="ghost" size="sm" onClick={onExportSelected} className="h-8 text-xs font-bold text-muted-foreground hover:text-foreground">
          <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />Export
        </Button>
        <Button variant="destructive" size="sm" onClick={onDeleteSelected} className="h-8 text-xs font-bold px-3.5 rounded-xl">
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete
        </Button>
        <Button variant="ghost" size="icon" onClick={onClearSelection} className="h-8 w-8 rounded-full border border-border/40 hover:bg-muted/40 ml-auto">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
