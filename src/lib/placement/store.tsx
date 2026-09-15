'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { toast } from 'sonner';
import type { AttendanceLog, ImportBatch, MentorTask, PlacementAlert, PlacementNote, ProgressLog, RiskScore, Student } from '@/types';
import { calculateRiskScore } from '@/lib/risk/placement-risk';

interface PlacementState {
  students: Student[];
  attendance: AttendanceLog[];
  progressLogs: ProgressLog[];
  notes: PlacementNote[];
  tasks: MentorTask[];
  importHistory: ImportBatch[];
  alerts: PlacementAlert[];
  riskScores: RiskScore[];
  isLoading: boolean;
  error: string;
}

type Action =
  | { type: 'hydrate:start' }
  | { type: 'hydrate:success'; payload: Partial<PlacementState> }
  | { type: 'hydrate:error'; error: string }
  | { type: 'students:set'; students: Student[] }
  | { type: 'student:update'; id: string; updates: Partial<Student> }
  | { type: 'attendance:set'; attendance: AttendanceLog[] }
  | { type: 'progress:set'; progressLogs: ProgressLog[] }
  | { type: 'alerts:set'; alerts: PlacementAlert[] }
  | { type: 'alerts:update'; id: string; status: PlacementAlert['status'] }
  | { type: 'import:add'; batch: ImportBatch };

const initialState: PlacementState = {
  students: [],
  attendance: [],
  progressLogs: [],
  notes: [],
  tasks: [],
  importHistory: [],
  alerts: [],
  riskScores: [],
  isLoading: true,
  error: '',
};

function recalculate(state: PlacementState): PlacementState {
  const riskScores = state.students.map((student) => calculateRiskScore(student, state.attendance, state.progressLogs));
  const existingOpenAlerts = new Set(state.alerts.filter((alert) => alert.status === 'open').map((alert) => `${alert.student_id}:${alert.level}`));
  const thresholdAlerts = riskScores
    .filter((score) => score.level !== 'safe')
    .filter((score) => !existingOpenAlerts.has(`${score.student_id}:${score.level}`))
    .map((score) => {
      const student = state.students.find((item) => item.id === score.student_id);
      return {
        id: `${score.student_id}-${score.level}-${score.calculated_at}`,
        student_id: score.student_id,
        student_name: student?.name || 'Student',
        level: score.level,
        message: `${student?.name || 'Student'} crossed into ${score.level.toUpperCase()} RISK - ${score.top_factor}`,
        created_at: score.calculated_at,
        status: 'open' as const,
      };
    });

  return { ...state, riskScores, alerts: [...thresholdAlerts, ...state.alerts] };
}

function reducer(state: PlacementState, action: Action): PlacementState {
  switch (action.type) {
    case 'hydrate:start':
      return { ...state, isLoading: true, error: '' };
    case 'hydrate:success':
      return recalculate({ ...state, ...action.payload, isLoading: false, error: '' });
    case 'hydrate:error':
      return { ...state, isLoading: false, error: action.error };
    case 'students:set':
      return recalculate({ ...state, students: action.students });
    case 'student:update':
      return recalculate({
        ...state,
        students: state.students.map((student) => student.id === action.id ? { ...student, ...action.updates } : student),
      });
    case 'attendance:set':
      return recalculate({ ...state, attendance: action.attendance });
    case 'progress:set':
      return recalculate({ ...state, progressLogs: action.progressLogs });
    case 'alerts:set':
      return { ...state, alerts: action.alerts };
    case 'alerts:update':
      return { ...state, alerts: state.alerts.map((alert) => alert.id === action.id ? { ...alert, status: action.status } : alert) };
    case 'import:add':
      return { ...state, importHistory: [action.batch, ...state.importHistory] };
    default:
      return state;
  }
}

interface PlacementStoreValue extends PlacementState {
  refresh: () => Promise<void>;
  optimisticStudentUpdate: (id: string, updates: Partial<Student>) => Promise<void>;
  dismissAlert: (id: string) => void;
  resolveAlert: (id: string) => void;
  applyImportResult: (students: Student[], batch: ImportBatch) => void;
}

const PlacementStoreContext = createContext<PlacementStoreValue | null>(null);

export function PlacementStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const refresh = useCallback(async () => {
    dispatch({ type: 'hydrate:start' });
    try {
      const [studentsRes, attendanceRes, progressRes, tasksRes] = await Promise.all([
        fetch('/api/students?limit=1000'),
        fetch('/api/attendance'),
        fetch('/api/progress-logs'),
        fetch('/api/mentor/tasks').catch(() => null),
      ]);
      if (!studentsRes.ok) throw new Error('Failed to load students');
      const [studentsJson, attendanceJson, progressJson, tasksJson] = await Promise.all([
        studentsRes.json(),
        attendanceRes.ok ? attendanceRes.json() : Promise.resolve({ data: [] }),
        progressRes.ok ? progressRes.json() : Promise.resolve({ data: [] }),
        tasksRes?.ok ? tasksRes.json() : Promise.resolve({ data: [] }),
      ]);
      dispatch({
        type: 'hydrate:success',
        payload: {
          students: studentsJson.data || [],
          attendance: attendanceJson.data || [],
          progressLogs: progressJson.data || [],
          tasks: tasksJson.data || [],
        },
      });
    } catch (error) {
      dispatch({ type: 'hydrate:error', error: error instanceof Error ? error.message : 'Failed to load Placement data' });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const optimisticStudentUpdate = useCallback(async (id: string, updates: Partial<Student>) => {
    const previous = state.students.find((student) => student.id === id);
    dispatch({ type: 'student:update', id, updates });
    let undone = false;
    toast('Saved locally', {
      description: 'Syncing change to Placement...',
      action: {
        label: 'Undo',
        onClick: () => {
          undone = true;
          if (previous) dispatch({ type: 'student:update', id, updates: previous });
        },
      },
      duration: 5000,
    });

    try {
      const res = await fetch(`/api/students/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error((await res.json()).message || 'Sync failed');
      if (!undone) toast.success('Student synced');
    } catch (error) {
      if (previous) dispatch({ type: 'student:update', id, updates: previous });
      toast.error(error instanceof Error ? error.message : 'Failed to sync change');
    }
  }, [state.students]);

  const value = useMemo<PlacementStoreValue>(() => ({
    ...state,
    refresh,
    optimisticStudentUpdate,
    dismissAlert: (id) => dispatch({ type: 'alerts:update', id, status: 'dismissed' }),
    resolveAlert: (id) => dispatch({ type: 'alerts:update', id, status: 'resolved' }),
    applyImportResult: (students, batch) => {
      dispatch({ type: 'students:set', students });
      dispatch({ type: 'import:add', batch });
    },
  }), [state, refresh, optimisticStudentUpdate]);

  return <PlacementStoreContext.Provider value={value}>{children}</PlacementStoreContext.Provider>;
}

export function usePlacementStore() {
  const value = useContext(PlacementStoreContext);
  if (!value) throw new Error('usePlacementStore must be used inside PlacementStoreProvider');
  return value;
}
