// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TaskAnalytics } from '@/components/mentor/tasks/task-analytics';
import type { MentorTask } from '@/types';

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="barchart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  PieChart: ({ children }: any) => <div data-testid="piechart">{children}</div>,
  Pie: ({ children }: any) => <div data-testid="pie">{children}</div>,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div data-testid="xaxis" />,
  YAxis: () => <div data-testid="yaxis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="cartesiangrid" />,
  Legend: () => <div data-testid="legend" />,
}));

// Mock MetricPopover
vi.mock('@/components/shared/metric-popover', () => ({
  MetricPopover: () => <div data-testid="metric-popover" />,
}));

const mockTasks: MentorTask[] = [
  {
    id: '1',
    mentor_email: 'mentor@example.com',
    student_id: 's1',
    student_name: 'Alice Cooper',
    task_type: 'follow_up',
    title: 'Resume Review',
    description: 'Check structure',
    due_date: '2026-05-20',
    completed: false,
    completed_at: '',
    created_at: '2026-05-18T10:00:00Z',
    priority: 'high',
    source: 'manual',
  },
  {
    id: '2',
    mentor_email: 'mentor@example.com',
    student_id: 's2',
    student_name: 'Bob Marley',
    task_type: 'schedule_interview',
    title: 'Mock Interview',
    description: 'Prep behavior',
    due_date: '2026-05-21',
    completed: true,
    completed_at: '2026-05-19T15:00:00Z',
    created_at: '2026-05-18T11:00:00Z',
    priority: 'critical',
    source: 'manual',
  },
  {
    id: '3',
    mentor_email: 'mentor@example.com',
    student_id: 's1',
    student_name: 'Alice Cooper',
    task_type: 'review_progress',
    title: 'LeetCode practice',
    description: 'Solve 5 medium',
    due_date: '2026-05-22',
    completed: false,
    completed_at: '',
    created_at: '2026-05-18T12:00:00Z',
    priority: 'medium',
    source: 'manual',
  },
];

describe('TaskAnalytics Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders default workload tab and displays title', () => {
    render(<TaskAnalytics tasks={mockTasks} />);
    
    expect(screen.getByText('Task Analytics & Insights')).toBeInTheDocument();
    expect(screen.getByText('Monitor mentor workload, task priorities, and completion distributions.')).toBeInTheDocument();
    
    // Check that the active tab's chart is rendered (only 1 at a time in Radix/Base UI dynamic mounting)
    const charts = screen.getAllByTestId('barchart');
    expect(charts.length).toBe(1);
  });

  it('allows switching between tabs (Workload, Priority, Task Types)', () => {
    render(<TaskAnalytics tasks={mockTasks} />);

    // Click Priority Mix trigger
    const priorityTrigger = screen.getAllByText('Priority Mix')[0];
    fireEvent.click(priorityTrigger);

    const pieCharts = screen.getAllByTestId('piechart');
    expect(pieCharts.length).toBe(1);

    const typesTrigger = screen.getAllByText('Task Types')[0];
    fireEvent.click(typesTrigger);
    expect(screen.getAllByTestId('barchart').length).toBe(1);
  });

  it('collapses and expands when toggle button is clicked', () => {
    render(<TaskAnalytics tasks={mockTasks} />);
    
    // Initially expanded
    expect(screen.getAllByTestId('barchart').length).toBe(1);

    // Find collapse button
    const toggleBtn = screen.getByRole('button', { name: /Collapse Analytics/i });
    fireEvent.click(toggleBtn);

    // Barcharts should be unmounted when collapsed
    expect(screen.queryByTestId('barchart')).not.toBeInTheDocument();

    // Click expand
    const expandBtn = screen.getByRole('button', { name: /Expand Analytics/i });
    fireEvent.click(expandBtn);
    expect(screen.getAllByTestId('barchart').length).toBe(1);
  });
});
