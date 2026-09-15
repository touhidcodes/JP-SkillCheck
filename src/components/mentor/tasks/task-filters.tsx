'use client';

import { Search, Filter, SortAsc, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

interface TaskFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  filter: 'all' | 'pending' | 'completed';
  onFilterChange: (value: 'all' | 'pending' | 'completed') => void;
  sortBy: 'due_date' | 'priority' | 'student_name';
  onSortChange: (value: 'due_date' | 'priority' | 'student_name') => void;
  onAddTask: () => void;
}

export function TaskFilters({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  sortBy,
  onSortChange,
  onAddTask,
}: TaskFiltersProps) {
  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-card p-4 rounded-xl border border-border/50 shadow-sm">
      <div className="flex flex-1 items-center gap-3 w-full md:w-auto">
        <div className="relative flex-1 md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-10 border-border/60 bg-muted/20 focus:bg-background transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <Select value={filter} onValueChange={(v) => onFilterChange(v as 'all' | 'pending' | 'completed')}>
            <SelectTrigger className="h-10 w-[120px] bg-muted/20 border-border/60">
              <Filter className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => onSortChange(v as 'due_date' | 'priority' | 'student_name')}>
            <SelectTrigger className="h-10 w-[140px] bg-muted/20 border-border/60">
              <SortAsc className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="due_date">Due Date</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="student_name">Student Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={onAddTask} className="w-full md:w-auto gap-2 shadow-sm">
        <Plus className="w-4 h-4" />
        Add New Task
      </Button>
    </div>
  );
}
