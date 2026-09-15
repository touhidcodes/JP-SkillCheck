// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import RiskTrackerPage from '@/app/(dashboard)/mentor/risk/page';
import { usePlacementStore } from '@/lib/placement/store';

// Mock Zustand store
vi.mock('@/lib/placement/store', () => ({
  usePlacementStore: vi.fn(),
}));

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="areachart">{children}</div>,
  Area: () => <div data-testid="area" />,
  BarChart: ({ children }: any) => <div data-testid="barchart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div data-testid="xaxis" />,
  YAxis: () => <div data-testid="yaxis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="cartesiangrid" />,
  Legend: () => <div data-testid="legend" />,
}));

// Mock intervention dialogs to verify they are wired up
vi.mock('@/components/dashboard/student-profile-sheet', () => ({
  StudentProfileSheet: ({ student, onClose }: any) => 
    student ? <div data-testid="mock-profile-sheet">Profile: {student.name} <button onClick={onClose}>Close</button></div> : null,
}));
vi.mock('@/components/dashboard/dialogs/add-note-dialog', () => ({
  AddNoteDialog: ({ student, open, onOpenChange }: any) => 
    open && student ? <div data-testid="mock-note-dialog">Note: {student.name} <button onClick={() => onOpenChange(false)}>Close</button></div> : null,
}));
vi.mock('@/components/dashboard/dialogs/log-progress-dialog', () => ({
  LogProgressDialog: ({ student, open, onOpenChange }: any) => 
    open && student ? <div data-testid="mock-log-dialog">Log: {student.name} <button onClick={() => onOpenChange(false)}>Close</button></div> : null,
}));
vi.mock('@/components/dashboard/dialogs/risk-override-dialog', () => ({
  RiskOverrideDialog: ({ student, open, onOpenChange }: any) => 
    open && student ? <div data-testid="mock-override-dialog">Override: {student.name} <button onClick={() => onOpenChange(false)}>Close</button></div> : null,
}));
vi.mock('@/components/mentor/tasks/create-task-dialog', () => ({
  CreateTaskDialog: ({ students, open, onOpenChange }: any) => 
    open && students.length > 0 ? (
      <div data-testid="mock-task-dialog">
        Task student: {students.map((s: any) => s.name).join(', ')} 
        <button onClick={() => onOpenChange(false)}>Close</button>
      </div>
    ) : null,
}));

const mockStudents = [
  {
    id: 's1',
    name: 'Ada Lovelace',
    batch: 'Batch 12',
    stage: 'applying',
    last_activity_date: '2026-05-18T10:00:00.000Z',
    updated_at: '2026-05-18T10:00:00.000Z',
    created_at: '2026-05-01T10:00:00.000Z',
  },
  {
    id: 's2',
    name: 'Alan Turing',
    batch: 'Batch 13',
    stage: 'interviewing',
    last_activity_date: '2026-05-10T10:00:00.000Z',
    updated_at: '2026-05-10T10:00:00.000Z',
    created_at: '2026-05-01T10:00:00.000Z',
  },
];

const mockRiskScores = [
  { student_id: 's1', score: 85, level: 'high', top_factor: 'Platform Inactivity', manual_override: false },
  { student_id: 's2', score: 35, level: 'medium', top_factor: 'Attendance Drop', manual_override: true },
];

const mockAlerts = [
  { id: 'a1', student_id: 's1', message: 'Ada has been inactive for 14 days', status: 'open', level: 'high', created_at: '2026-05-18T10:00:00.000Z' },
  { id: 'a2', student_id: 's2', message: 'Alan missed two consecutive sessions', status: 'open', level: 'medium', created_at: '2026-05-17T10:00:00.000Z' },
];

describe('RiskTrackerPage Unit Tests', () => {
  const dismissAlertMock = vi.fn();
  const resolveAlertMock = vi.fn();

  beforeEach(() => {
    vi.mocked(usePlacementStore).mockReturnValue({
      students: mockStudents,
      riskScores: mockRiskScores,
      attendance: [],
      progressLogs: [],
      alerts: mockAlerts,
      dismissAlert: dismissAlertMock,
      resolveAlert: resolveAlertMock,
      isLoading: false,
      error: null,
      optimisticStudentUpdate: vi.fn(),
    } as any);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders stats grid and header information', () => {
    render(<RiskTrackerPage />);

    expect(screen.getByText('Risk Tracker & Analytics')).toBeInTheDocument();
    expect(screen.getByText('High Risk')).toBeInTheDocument();
    expect(screen.getByText('Medium Risk')).toBeInTheDocument();
    expect(screen.getByText('Safe Profile')).toBeInTheDocument();
    expect(screen.getByText('Active Alerts')).toBeInTheDocument();

    // Verify at-risk student list is rendered in the table
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Alan Turing')).toBeInTheDocument();
  });

  it('renders AreaChart and BarChart container wrappers', () => {
    render(<RiskTrackerPage />);
    expect(screen.getByTestId('areachart')).toBeInTheDocument();
    expect(screen.getByTestId('barchart')).toBeInTheDocument();
  });

  it('filters students in table by typing in the search input', () => {
    render(<RiskTrackerPage />);

    // Verify both are present initially
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('Alan Turing')).toBeInTheDocument();

    // Filter for Ada
    const searchInput = screen.getByPlaceholderText('Search name or risk factor...');
    fireEvent.change(searchInput, { target: { value: 'Ada' } });

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.queryByText('Alan Turing')).not.toBeInTheDocument();
  });

  it('displays empty state message when search matches nothing', () => {
    render(<RiskTrackerPage />);

    const searchInput = screen.getByPlaceholderText('Search name or risk factor...');
    fireEvent.change(searchInput, { target: { value: 'Grace Hopper' } });

    expect(screen.getByText('No risk matches found')).toBeInTheDocument();
    expect(screen.getByText('Adjust filters or search parameters.')).toBeInTheDocument();
  });

  it('triggers resolve and dismiss alert callbacks correctly', () => {
    render(<RiskTrackerPage />);

    // Trigger resolve on the first alert
    const resolveButtons = screen.getAllByRole('button', { name: /Resolve/i });
    fireEvent.click(resolveButtons[0]);
    expect(resolveAlertMock).toHaveBeenCalledWith('a1');

    // Trigger dismiss on the second alert
    const dismissButtons = screen.getAllByRole('button', { name: /Dismiss/i });
    fireEvent.click(dismissButtons[1]);
    expect(dismissAlertMock).toHaveBeenCalledWith('a2');
  });

  it('opens StudentProfileSheet when clicking on student name', () => {
    render(<RiskTrackerPage />);

    const studentButton = screen.getByRole('button', { name: 'Ada Lovelace' });
    fireEvent.click(studentButton);

    expect(screen.getByTestId('mock-profile-sheet')).toBeInTheDocument();
    expect(screen.getByText('Profile: Ada Lovelace')).toBeInTheDocument();

    // Close profile sheet
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByTestId('mock-profile-sheet')).not.toBeInTheDocument();
  });

  it('renders skeleton loading screen when store isLoading is active', () => {
    vi.mocked(usePlacementStore).mockReturnValue({
      students: [],
      riskScores: [],
      attendance: [],
      progressLogs: [],
      alerts: [],
      dismissAlert: vi.fn(),
      resolveAlert: vi.fn(),
      isLoading: true,
      error: null,
      optimisticStudentUpdate: vi.fn(),
    } as any);

    const { container } = render(<RiskTrackerPage />);
    // Verify loaders/skeletons are rendered
    expect(container.getElementsByClassName('animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByText('Ada Lovelace')).not.toBeInTheDocument();
  });
});
