// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { TeamManagementTable } from '@/components/team/team-management-table';

// Mock Tooltip provider
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockPaginatedMentors = [
  {
    mentor_email: 'nahlan@programming-hero.com',
    mentor_name: 'Nahlan Suba',
    rank: 1,
    total_students: 15,
    active: 12,
    hired: 3,
    at_risk: 2,
    placement_rate: 20,
    interviews_this_period: 5,
    tasks_this_period: 3,
    offers_this_period: 1,
    score: 95,
    needs_support: false,
    stage_distribution: { learning: 2, applying: 3, interviewing: 2, offer_pending: 1, placed: 1, hired: 3 }
  },
  {
    mentor_email: 'tandra@programming-hero.com',
    mentor_name: 'Tandra',
    rank: 2,
    total_students: 15,
    active: 13,
    hired: 2,
    at_risk: 1,
    placement_rate: 13,
    interviews_this_period: 4,
    tasks_this_period: 2,
    offers_this_period: 2,
    score: 80,
    needs_support: false,
    stage_distribution: { learning: 3, applying: 4, interviewing: 1, offer_pending: 2, placed: 2, hired: 2 }
  }
];

afterEach(() => {
  cleanup();
});

describe('TeamManagementTable', () => {
  it('Renders table with data successfully', () => {
    render(
      <TeamManagementTable
        isLoading={false}
        paginated={mockPaginatedMentors}
        filteredCount={2}
        maxScore={100}
        currentPage={1}
        totalPages={1}
        onPageChange={vi.fn()}
        periodLabel="Last 7 days"
      />
    );

    expect(screen.getByText('Last 7 days')).toBeInTheDocument();
    expect(screen.getByText('Nahlan Suba')).toBeInTheDocument();
    expect(screen.getByText('Tandra')).toBeInTheDocument();
    expect(screen.getByText('🥇')).toBeInTheDocument();
    expect(screen.getByText('🥈')).toBeInTheDocument();
  });

  it('Renders loading skeleton states when loading is active', () => {
    render(
      <TeamManagementTable
        isLoading={true}
        paginated={[]}
        filteredCount={0}
        maxScore={100}
        currentPage={1}
        totalPages={1}
        onPageChange={vi.fn()}
        periodLabel="Last 7 days"
      />
    );

    // Grid should contain skeleton tags
    const cells = screen.queryByText('Nahlan Suba');
    expect(cells).not.toBeInTheDocument();
  });

  it('Renders empty state message when entries are empty', () => {
    render(
      <TeamManagementTable
        isLoading={false}
        paginated={[]}
        filteredCount={0}
        maxScore={100}
        currentPage={1}
        totalPages={1}
        onPageChange={vi.fn()}
        periodLabel="Last 7 days"
      />
    );

    expect(screen.getByText('No mentors found')).toBeInTheDocument();
  });
});
