// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TaskStats } from '@/components/mentor/tasks/task-stats';

// Mock StatsCard since it might have internal popovers/tooltips that require TooltipProvider
vi.mock('@/components/dashboard/stats-card', () => ({
  StatsCard: ({ title, value, subtitle }: any) => (
    <div data-testid="stats-card">
      <span data-testid="card-title">{title}</span>
      <span data-testid="card-value">{value}</span>
      <span data-testid="card-subtitle">{subtitle}</span>
    </div>
  ),
}));

describe('TaskStats Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders all four KPI stats cards with correct values and subtitles', () => {
    render(
      <TaskStats
        pendingCount={5}
        overdueCount={2}
        completionRate={71}
        totalMentees={8}
      />
    );

    const cards = screen.getAllByTestId('stats-card');
    expect(cards).toHaveLength(4);

    // Verify Pending Tasks Card
    expect(screen.getByText('Pending Tasks')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('Active items')).toBeInTheDocument();

    // Verify Completion Rate Card
    expect(screen.getByText('Completion')).toBeInTheDocument();
    expect(screen.getByText('71%')).toBeInTheDocument();
    expect(screen.getByText('Overall rate')).toBeInTheDocument();

    // Verify Overdue Card
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Requires attention')).toBeInTheDocument();

    // Verify Mentees Card
    expect(screen.getByText('Mentees')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('Active assignments')).toBeInTheDocument();
  });

  it('renders clean on-track status when overdue count is zero', () => {
    render(
      <TaskStats
        pendingCount={3}
        overdueCount={0}
        completionRate={100}
        totalMentees={2}
      />
    );

    expect(screen.getByText('All on track')).toBeInTheDocument();
    expect(screen.queryByText('Requires attention')).not.toBeInTheDocument();
  });
});
