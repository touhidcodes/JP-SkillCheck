'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateFormInput, PatchFormInput } from '@/lib/validations/attendance-form';
import type { AttendanceForm } from '@/lib/sheets/attendance-forms';
import { attendanceFormKeys } from '@/lib/query-keys';

interface AttendanceFormsListResponse {
  data: (AttendanceForm & {
    is_expired: boolean;
    public_url: string;
  })[];
  total: number;
}

interface AttendanceFormDetailResponse {
  id: string;
  session_label: string;
  date: string;
  mode: AttendanceForm['mode'];
  period: AttendanceForm['period'];
  expires_at: string;
  is_active: boolean;
  is_expired: boolean;
  submission_count: number;
  public_url: string;
}

async function fetchAttendanceForms(date: string): Promise<AttendanceFormsListResponse> {
  const res = await fetch(`/api/attendance-forms?date=${date}`);
  if (!res.ok) throw new Error('Failed to fetch forms');
  return res.json();
}

async function fetchAttendanceFormById(id: string): Promise<AttendanceFormDetailResponse> {
  const res = await fetch(`/api/attendance-forms/${id}`);
  if (!res.ok) throw new Error('Failed to fetch form');
  return res.json();
}

async function postAttendanceForm(payload: CreateFormInput) {
  const res = await fetch('/api/attendance-forms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Failed to create form');
  }
  return res.json();
}

async function patchAttendanceForm(id: string, payload: PatchFormInput) {
  const res = await fetch(`/api/attendance-forms/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message ?? 'Failed to update form');
  }
  return res.json();
}

export function useAttendanceForms(date: string) {
  return useQuery({
    queryKey: attendanceFormKeys.list(date),
    queryFn: () => fetchAttendanceForms(date),
    staleTime: 30_000,
  });
}

export function useAttendanceFormDetail(id: string, enabled = true) {
  return useQuery({
    queryKey: attendanceFormKeys.detail(id),
    queryFn: () => fetchAttendanceFormById(id),
    refetchInterval: 10_000,
    enabled: enabled && !!id,
  });
}

export function useCreateAttendanceForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postAttendanceForm,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceFormKeys.all });
    },
  });
}

export function useDeactivateForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => patchAttendanceForm(id, { is_active: false }),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: attendanceFormKeys.all });
      queryClient.invalidateQueries({ queryKey: attendanceFormKeys.detail(id) });
    },
  });
}
