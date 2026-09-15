'use client';

import { useState, useEffect, useMemo } from 'react';
import { differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import type { Student, RiskLevel, RiskScore } from '@/types';

export function daysInactive(student: Student) {
  if (!student.last_activity_date) return 999;
  const date = new Date(student.last_activity_date);
  if (Number.isNaN(date.getTime())) return 999;
  return differenceInDays(new Date(), date);
}

export function filterCounts(students: Student[], riskMap: Map<string, RiskLevel>) {
  const count = (selector: (s: Student) => string | boolean | undefined) => {
    const map = new Map<string, number>();
    for (const student of students) {
      const val = String(selector(student) ?? '');
      if (!val) continue;
      map.set(val, (map.get(val) || 0) + 1);
    }
    return map;
  };
  return {
    project: count((s) => s.project),
    stage: count((s) => s.stage),
    risk: count((s) => riskMap.get(s.id)),
    job_focus: count((s) => s.job_focus),
    terminated: count((s) => s.terminated),
    hired: count((s) => s.hired),
    experience: count((s) => s.experience),
    batch: count((s) => s.batch),
  };
}

export function exportRows(rows: Student[], riskById: Map<string, RiskScore>, format: 'xlsx' | 'csv') {
  const data = rows.map((s) => ({
    NAME: s.name,
    EMAIL: s.student_email || '',
    PHONE: s.phone || '',
    PROJECT: s.project || '',
    BATCH: s.batch,
    STAGE: s.stage,
    RISK: riskById.get(s.id)?.level || 'safe',
    FOCUS: s.job_focus || '',
    EXPERIENCE: s.experience || '',
    HIRED: s.hired ? 'Yes' : 'No',
    TERMINATED: s.terminated ? 'Yes' : 'No',
    LAST_ACTIVE: s.last_activity_date || '',
    NOTES: s.notes || '',
  }));
  const sheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Mentees');
  XLSX.writeFile(workbook, `placement-mentees.${format}`, { bookType: format === 'csv' ? 'csv' : 'xlsx' });
}

export function getFilteredAndSorted(
  students: Student[],
  debouncedQuery: string,
  filters: Record<string, string | undefined>,
  sorts: Array<{ key: string; direction: 'asc' | 'desc' }>,
  riskById: Map<string, RiskScore>
) {
  const q = debouncedQuery.toLowerCase();
  const filtered = students.filter((s) => {
    const risk = riskById.get(s.id)?.level || 'safe';
    const hit = !q || [s.name, s.student_email, s.batch, s.project].some((v) => String(v || '').toLowerCase().includes(q));
    if (!hit) return false;
    if (filters.project && s.project !== filters.project) return false;
    if (filters.stage && s.stage !== filters.stage) return false;
    if (filters.risk && risk !== filters.risk) return false;
    if (filters.job_focus && s.job_focus !== filters.job_focus) return false;
    if (filters.terminated && String(s.terminated) !== filters.terminated) return false;
    if (filters.hired && String(s.hired) !== filters.hired) return false;
    if (filters.experience && s.experience !== filters.experience) return false;
    if (filters.batch && s.batch !== filters.batch) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    for (const sort of sorts) {
      const riskA = riskById.get(a.id)?.level || 'safe';
      const riskB = riskById.get(b.id)?.level || 'safe';
      const valueA = sort.key === 'risk' ? riskA : sort.key === 'status' ? `${a.hired}-${a.terminated}` : String(a[sort.key as keyof Student] || '');
      const valueB = sort.key === 'risk' ? riskB : sort.key === 'status' ? `${b.hired}-${b.terminated}` : String(b[sort.key as keyof Student] || '');
      const compare = sort.key === 'last_activity_date' ? daysInactive(b) - daysInactive(a) : valueA.localeCompare(valueB);
      if (compare !== 0) return sort.direction === 'asc' ? compare : -compare;
    }
    return 0;
  });

  return { filtered, sorted };
}

export function useMenteesTableQuery() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);
  return { query, setQuery, debouncedQuery };
}

export function useMenteesTableFiltersAndSorts() {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [sorts, setSorts] = useState<Array<{ key: string; direction: 'asc' | 'desc' }>>([{ key: 'last_activity_date', direction: 'asc' }]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value === '__all__') delete next[key];
      else next[key] = value;
      return next;
    });
    setPage(1);
  };

  const handleToggleSort = (key: string, shift: boolean) => {
    setSorts((prev) => {
      const existing = prev.find((s) => s.key === key);
      const next = { key, direction: (existing?.direction === 'asc' ? 'desc' : 'asc') as 'asc' | 'desc' };
      return shift ? [next, ...prev.filter((s) => s.key !== key)] : [next];
    });
  };

  return {
    filters,
    setFilters,
    sorts,
    setSorts,
    page,
    setPage,
    pageSize,
    setPageSize,
    handleFilterChange,
    handleToggleSort,
  };
}

export function useMenteesTableSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAllFiltered, setSelectAllFiltered] = useState(false);

  const handleSelectRow = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
    setSelectAllFiltered(false);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setSelectAllFiltered(false);
  };

  return {
    selectedIds,
    setSelectedIds,
    selectAllFiltered,
    setSelectAllFiltered,
    handleSelectRow,
    handleClearSelection,
  };
}

export function useMenteesTableDialogs(
  optimisticStudentUpdate: (id: string, updates: Partial<Student>) => Promise<void> | void
) {
  const [selectedStudentForProfile, setSelectedStudentForProfile] = useState<Student | null>(null);
  const [selectedProfileTab, setSelectedProfileTab] = useState<string>('overview');
  const [activeDialog, setActiveDialog] = useState<{ type: string; student: Student } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState<{ id: string; field: keyof Student } | null>(null);
  const [dirtyCells, setDirtyCells] = useState<Set<string>>(new Set());

  const handleAction = (type: string, student: Student) => {
    if (type === 'view_profile') {
      setSelectedProfileTab('overview');
      setSelectedStudentForProfile(student);
    } else if (type === 'view_attendance') {
      setSelectedProfileTab('attendance');
      setSelectedStudentForProfile(student);
    } else if (type === 'send_message') {
      if (student.student_email) window.location.href = `mailto:${student.student_email}`;
      else toast.error('No email address found for this mentee');
    } else if (['edit', 'note', 'log', 'task'].includes(type)) {
      setActiveDialog({ type, student });
    }
  };

  const handleSaveInline = async (student: Student, field: keyof Student, value: string) => {
    setEditing(null);
    const cellKey = `${student.id}:${String(field)}`;
    setDirtyCells((prev) => new Set(prev).add(cellKey));
    const updates = { [field]: value } as Partial<Student>;
    if (field === 'stage' && value === 'hired') updates.hired = true;
    await optimisticStudentUpdate(student.id, updates);
    setTimeout(() => setDirtyCells((prev) => {
      const next = new Set(prev);
      next.delete(cellKey);
      return next;
    }), 1200);
  };

  return {
    selectedStudentForProfile,
    setSelectedStudentForProfile,
    selectedProfileTab,
    activeDialog,
    setActiveDialog,
    confirmDelete,
    setConfirmDelete,
    editing,
    setEditing,
    dirtyCells,
    handleAction,
    handleSaveInline,
  };
}

export function useMenteesTableState(
  students: Student[],
  riskScores: RiskScore[],
  onUpload: () => void,
  optimisticStudentUpdate: (id: string, updates: Partial<Student>) => Promise<void> | void
) {
  const { query, setQuery, debouncedQuery } = useMenteesTableQuery();
  const filterSortProps = useMenteesTableFiltersAndSorts();
  const selectionProps = useMenteesTableSelection();
  const dialogProps = useMenteesTableDialogs(optimisticStudentUpdate);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const riskById = useMemo(() => new Map(riskScores.map((r) => [r.student_id, r])), [riskScores]);
  const counts = useMemo(() => filterCounts(students, new Map(riskScores.map((r) => [r.student_id, r.level]))), [students, riskScores]);

  const { filtered, sorted } = useMemo(
    () => getFilteredAndSorted(students, debouncedQuery, filterSortProps.filters, filterSortProps.sorts, riskById),
    [students, debouncedQuery, filterSortProps.filters, filterSortProps.sorts, riskById]
  );

  const totalPages = Math.max(1, Math.ceil(sorted.length / filterSortProps.pageSize));
  const pageRows = sorted.slice((filterSortProps.page - 1) * filterSortProps.pageSize, filterSortProps.page * filterSortProps.pageSize);
  
  const selectedStudents = selectionProps.selectAllFiltered ? sorted : students.filter((s) => selectionProps.selectedIds.has(s.id));
  const selectedCount = selectionProps.selectAllFiltered ? sorted.length : selectionProps.selectedIds.size;
  const highRiskCount = riskScores.filter((r) => r.level === 'high').length;
  const inactiveCount = students.filter((s) => daysInactive(s) > 14).length;

  const handleSelectAllPageRows = (checked: boolean) => {
    const next = new Set(selectionProps.selectedIds);
    pageRows.forEach((s) => (checked ? next.add(s.id) : next.delete(s.id)));
    selectionProps.setSelectedIds(next);
    selectionProps.setSelectAllFiltered(false);
  };

  return {
    query,
    setQuery,
    debouncedQuery,
    ...filterSortProps,
    ...selectionProps,
    ...dialogProps,
    bannerDismissed,
    setBannerDismissed,
    riskById,
    counts,
    filtered,
    sorted,
    totalPages,
    pageRows,
    selectedStudents,
    selectedCount,
    highRiskCount,
    inactiveCount,
    handleSelectAllPageRows,
    viewMode,
    setViewMode,
  };
}
