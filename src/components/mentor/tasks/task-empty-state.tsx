'use client';

import { CheckCircle2, Search, ListTodo } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TaskEmptyStateProps {
  searchQuery?: string;
  filter: 'all' | 'pending' | 'completed';
  onClearSearch?: () => void;
  onAddTask?: () => void;
}

export function TaskEmptyState({
  searchQuery,
  filter,
  onClearSearch,
  onAddTask,
}: TaskEmptyStateProps) {
  if (searchQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in zoom-in duration-300">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Search className="w-8 h-8 text-muted-foreground/40" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">No matches found</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          We couldn&apos;t find any tasks matching &quot;{searchQuery}&quot;. Try a different term or clear filters.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={onClearSearch}
          className="mt-6"
        >
          Clear search
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-in fade-in zoom-in duration-300">
      <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4 border border-emerald-100">
        {filter === 'pending' ? (
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        ) : (
          <ListTodo className="w-8 h-8 text-muted-foreground/40" />
        )}
      </div>
      <h3 className="text-lg font-semibold text-foreground">
        {filter === 'pending' ? 'All caught up!' : 'No tasks yet'}
      </h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
        {filter === 'pending'
          ? 'You have completed all your pending tasks. Great job!'
          : 'There are no tasks to show in this view.'}
      </p>
      {filter === 'pending' && (
        <Button
          onClick={onAddTask}
          className="mt-6"
        >
          Create new task
        </Button>
      )}
    </div>
  );
}
