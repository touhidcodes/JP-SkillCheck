'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MenteesTablePaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  totalFiltered: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function MenteesTablePagination({
  page,
  totalPages,
  pageSize,
  totalFiltered,
  onPageChange,
  onPageSizeChange,
}: MenteesTablePaginationProps) {
  const startRow = totalFiltered ? (page - 1) * pageSize + 1 : 0;
  const endRow = Math.min(page * pageSize, totalFiltered);

  return (
    <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted-foreground font-semibold">
        Showing {startRow}-{endRow} of {totalFiltered} students
      </p>
      <div className="flex items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(val) => onPageSizeChange(Number(val))}>
          <SelectTrigger className="h-9 w-[80px] rounded-lg border-border/50 text-xs font-semibold bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-xl border-border/60">
            {[10, 25, 50].map((size) => (
              <SelectItem key={size} value={String(size)} className="text-xs font-semibold">
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="h-9 w-9 p-0 rounded-lg border-border/50">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs text-muted-foreground font-bold px-1">{page} / {totalPages}</span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="h-9 w-9 p-0 rounded-lg border-border/50">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
