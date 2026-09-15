// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ManagerLeaderboardPage from '@/app/(dashboard)/manager/leaderboard/page';
import { useQuery } from '@tanstack/react-query';
import type { ActivityTier } from '@/types';

// Mock tanstack/react-query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

// Mock Recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="barchart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="xaxis" />,
  YAxis: () => <div data-testid="yaxis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="cartesiangrid" />,
  Legend: () => <div data-testid="legend" />,
}));

const mockMentors = [
  {
    rank: 1,
    mentor_email: 'lead@example.com',
    mentor_name: 'Lead Mentor',
    total_students: 12,
    active: 8,
    hired: 4,
    at_risk: 0,
    terminated: 0,
    placement_rate: 33,
    interviews_this_period: 15,
    tasks_this_period: 25,
    offers_this_period: 5,
    jobs_applied_this_period: 40,
    avg_attendance_rate: 94,
    tier_counts: { Excellent: 8, Good: 4, Moderate: 0, Inactive: 0, Critical: 0 } as Record<ActivityTier, number>,
    stage_distribution: { learning: 2, applying: 4, interviewing: 2, offer_pending: 0, placed: 4, hired: 4 },
    needs_support: false,
    score: 85.5,
  },
  {
    rank: 2,
    mentor_email: 'strong@example.com',
    mentor_name: 'Strong Mentor',
    total_students: 10,
    active: 7,
    hired: 2,
    at_risk: 1,
    terminated: 0,
    placement_rate: 20,
    interviews_this_period: 8,
    tasks_this_period: 14,
    offers_this_period: 2,
    jobs_applied_this_period: 22,
    avg_attendance_rate: 88,
    tier_counts: { Excellent: 4, Good: 4, Moderate: 1, Inactive: 1, Critical: 0 } as Record<ActivityTier, number>,
    stage_distribution: { learning: 3, applying: 3, interviewing: 1, offer_pending: 1, placed: 2, hired: 2 },
    needs_support: false,
    score: 62.0,
  },
  {
    rank: 3,
    mentor_email: 'support@example.com',
    mentor_name: 'Needs Support Mentor',
    total_students: 8,
    active: 4,
    hired: 0,
    at_risk: 4,
    terminated: 0,
    placement_rate: 0,
    interviews_this_period: 2,
    tasks_this_period: 5,
    offers_this_period: 0,
    jobs_applied_this_period: 10,
    avg_attendance_rate: 70,
    tier_counts: { Excellent: 0, Good: 2, Moderate: 2, Inactive: 2, Critical: 2 } as Record<ActivityTier, number>,
    stage_distribution: { learning: 1, applying: 2, interviewing: 1, offer_pending: 0, placed: 0, hired: 0 },
    needs_support: true,
    score: 18.0,
  },
];

describe('ManagerLeaderboardPage', () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockImplementation(() => {
      return {
        data: { data: mockMentors, period_label: 'This Week' },
        isLoading: false,
        isError: false,
      } as any;
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders page header and stats grid', () => {
    render(<ManagerLeaderboardPage />);

    expect(screen.getByText('Mentor Performance Leaderboard')).toBeInTheDocument();
    expect(screen.getByText('Total Mentors')).toBeInTheDocument();
    expect(screen.getByText('Avg Placement Rate')).toBeInTheDocument();
    expect(screen.getByText('Total Hired')).toBeInTheDocument();
    expect(screen.getAllByText('Needs Support').length).toBeGreaterThan(0);

    // Verify stats calculated from mock data
    expect(screen.getByText('3')).toBeInTheDocument(); // total mentors
    expect(screen.getByText('18%')).toBeInTheDocument(); // avg placement rate (33+20+0)/3 = 17.6% (18%)
    expect(screen.getByText('6')).toBeInTheDocument(); // total hired (4+2+0) = 6
    expect(screen.getAllByText('1')[0]).toBeInTheDocument(); // needs support count
  });

  it('renders gold-silver-bronze podium for mentors', () => {
    render(<ManagerLeaderboardPage />);

    expect(screen.getByText('Top Mentor Performers')).toBeInTheDocument();
    expect(screen.getAllByText('Lead Mentor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Strong Mentor').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Needs Support Mentor').length).toBeGreaterThan(0);

    expect(screen.getAllByText('#1')[0]).toBeInTheDocument();
    expect(screen.getAllByText('#2')[0]).toBeInTheDocument();
    expect(screen.getAllByText('#3')[0]).toBeInTheDocument();
  });

  it('renders Recharts comparison bar chart and allows toggling', () => {
    render(<ManagerLeaderboardPage />);

    expect(screen.getByTestId('barchart')).toBeInTheDocument();

    const toggleBtn = screen.getByRole('button', { name: /Hide Chart/i });
    fireEvent.click(toggleBtn);

    expect(screen.queryByTestId('barchart')).not.toBeInTheDocument();

    const showBtn = screen.getByRole('button', { name: /Show Chart/i });
    fireEvent.click(showBtn);

    expect(screen.getByTestId('barchart')).toBeInTheDocument();
  });

  it('filters mentor list by search query', () => {
    render(<ManagerLeaderboardPage />);

    expect(screen.getByText('strong@example.com')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Search mentors...');
    fireEvent.change(searchInput, { target: { value: 'Lead' } });

    // Table rows should filter
    expect(screen.getAllByText('Lead Mentor').length).toBeGreaterThan(0);
    expect(screen.queryByText('strong@example.com')).not.toBeInTheDocument();
  });

  it('shows empty placeholder when search query finds no matches', () => {
    render(<ManagerLeaderboardPage />);

    const searchInput = screen.getByPlaceholderText('Search mentors...');
    fireEvent.change(searchInput, { target: { value: 'Nonexistent Mentor' } });

    expect(screen.getByText('No mentors found')).toBeInTheDocument();
    expect(screen.getByText('Adjust filter settings or search terms.')).toBeInTheDocument();
  });
});
