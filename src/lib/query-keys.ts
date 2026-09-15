export const attendanceFormKeys = {
  all: ['attendance-forms'] as const,
  list: (date: string) => ['attendance-forms', 'list', date] as const,
  detail: (id: string) => ['attendance-forms', 'detail', id] as const,
};
