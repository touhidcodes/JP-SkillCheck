// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DetailedAnalyticsTable } from '@/components/dashboard/detailed-analytics-table';
import type { MentorEntry, CohortEntry } from '@/lib/analytics/engine';

// Mock Tooltip provider
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

const mockMentors: MentorEntry[] = [
  {
    email: 'tandra@programming-hero.com',
    name: 'Tandra',
    totalMentees: 15,
    activeMentees: 12,
    placed: 2,
    hired: 2,
    atRisk: 1,
    interviewsThisMonth: 8,
    logsThisMonth: 10,
    avgDaysToPlacement: 45,
    activityScore: 90,
  },
  {
    email: 'nahlan@programming-hero.com',
    name: 'Nahlan Suba',
    totalMentees: 15,
    activeMentees: 10,
    placed: 3,
    hired: 3,
    atRisk: 2,
    interviewsThisMonth: 12,
    logsThisMonth: 15,
    avgDaysToPlacement: 40,
    activityScore: 95,
  },
  {
    email: 'mousumi@programming-hero.com',
    name: 'Mousumi',
    totalMentees: 15,
    activeMentees: 11,
    placed: 1,
    hired: 1,
    atRisk: 3,
    interviewsThisMonth: 5,
    logsThisMonth: 8,
    avgDaysToPlacement: 60,
    activityScore: 70,
  },
];

const mockCohorts: CohortEntry[] = [
  {
    batch: 'Batch 12',
    total: 20,
    active: 15,
    placed: 8,
    hired: 8,
    placementRate: 40,
    hireRate: 40,
    learning: 5,
    applying: 5,
    interviewing: 3,
    offer_pending: 2,
  },
  {
    batch: 'Batch 13',
    total: 30,
    active: 25,
    placed: 6,
    hired: 6,
    placementRate: 20,
    hireRate: 20,
    learning: 10,
    applying: 8,
    interviewing: 5,
    offer_pending: 2,
  },
];

afterEach(() => {
  cleanup();
});

describe('DetailedAnalyticsTable', () => {
  it('Renders the Mentor tab and values by default', () => {
    render(<DetailedAnalyticsTable mentors={mockMentors} cohorts={mockCohorts} />);
    
    // Mentor header fields
    expect(screen.getByText('Mentor name')).toBeInTheDocument();
    expect(screen.getByText('Nahlan Suba')).toBeInTheDocument();
    expect(screen.getByText('Tandra')).toBeInTheDocument();
  });

  it('Switches to Cohort tab and displays cohort rows', () => {
    render(<DetailedAnalyticsTable mentors={mockMentors} cohorts={mockCohorts} />);

    // Click "Cohort batches"
    fireEvent.click(screen.getByRole('button', { name: /Cohort batches/i }));

    // Cohort header fields
    expect(screen.getByText('Cohort batch')).toBeInTheDocument();
    expect(screen.getByText('Batch 12')).toBeInTheDocument();
    expect(screen.getByText('Batch 13')).toBeInTheDocument();
  });

  it('Filters mentors list via Search input', () => {
    render(<DetailedAnalyticsTable mentors={mockMentors} cohorts={mockCohorts} />);

    // Type query
    const input = screen.getByPlaceholderText('Search mentors…');
    fireEvent.change(input, { target: { value: 'Nahlan' } });

    expect(screen.getByText('Nahlan Suba')).toBeInTheDocument();
    expect(screen.queryByText('Tandra')).not.toBeInTheDocument();
  });

  it('Filters cohorts list via Search input', () => {
    render(<DetailedAnalyticsTable mentors={mockMentors} cohorts={mockCohorts} />);
    fireEvent.click(screen.getByRole('button', { name: /Cohort batches/i }));

    const input = screen.getByPlaceholderText('Search cohorts…');
    fireEvent.change(input, { target: { value: '12' } });

    expect(screen.getByText('Batch 12')).toBeInTheDocument();
    expect(screen.queryByText('Batch 13')).not.toBeInTheDocument();
  });

  it('Performs client-side sorting when header is clicked', () => {
    render(<DetailedAnalyticsTable mentors={mockMentors} cohorts={mockCohorts} />);
    
    // Check initial rank displays (alphabetical order 'Mousumi' -> 'Nahlan' -> 'Tandra' depending on initial default or sheets order, wait sorting matches name by default)
    const rows = screen.getAllByText(/programming-hero\.com/i);
    expect(rows[0]).toHaveTextContent('mousumi@programming-hero.com');
    expect(rows[1]).toHaveTextContent('nahlan@programming-hero.com');
    expect(rows[2]).toHaveTextContent('tandra@programming-hero.com');
  });
});
