// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import MentorLeaderboardPage from '@/app/(dashboard)/mentor/leaderboard/page';
import { useQuery } from '@tanstack/react-query';
import type { ActivityTier } from '@/types';

// Mock tanstack/react-query
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

const mockStudents = [
  {
    rank: 1,
    id: 's1',
    name: 'Alice Cooper',
    batch: 'Batch 10',
    project: 'E-commerce',
    stage: 'interviewing',
    risk_status: 'stable',
    hired: false,
    interviews: 4,
    tasks: 12,
    offers: 1,
    jobs_applied: 15,
    attendance_rate: 95,
    activity_tier: 'Excellent' as ActivityTier,
    activity_description: 'Highly active',
    score: 82.5,
  },
  {
    rank: 2,
    id: 's2',
    name: 'Bob Marley',
    batch: 'Batch 10',
    project: 'SaaS App',
    stage: 'applying',
    risk_status: 'at_risk',
    hired: false,
    interviews: 1,
    tasks: 4,
    offers: 0,
    jobs_applied: 8,
    attendance_rate: 75,
    activity_tier: 'Moderate' as ActivityTier,
    activity_description: 'Moderate logs',
    score: 41.0,
  },
  {
    rank: 3,
    id: 's3',
    name: 'Charlie Chaplin',
    batch: 'Batch 11',
    project: 'Mobile Game',
    stage: 'learning',
    risk_status: 'stable',
    hired: false,
    interviews: 0,
    tasks: 1,
    offers: 0,
    jobs_applied: 2,
    attendance_rate: 90,
    activity_tier: 'Good' as ActivityTier,
    activity_description: 'Good activity',
    score: 25.0,
  }
];

describe('MentorLeaderboardPage', () => {
  beforeEach(() => {
    vi.mocked(useQuery).mockImplementation(() => {
      return {
        data: { data: mockStudents, period_label: 'This Week' },
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
    render(<MentorLeaderboardPage />);

    expect(screen.getByText('Mentees Leaderboard')).toBeInTheDocument();
    expect(screen.getByText('Total Mentees')).toBeInTheDocument();
    expect(screen.getByText('Placement Rate')).toBeInTheDocument();
    expect(screen.getByText('Placed Students')).toBeInTheDocument();
    expect(screen.getByText('Avg Attendance')).toBeInTheDocument();

    // Verify stats calculated from mock data
    expect(screen.getByText('3')).toBeInTheDocument(); // total count
    expect(screen.getByText('87%')).toBeInTheDocument(); // avg attendance (95+75+90)/3 = 86.6% (87%)
    expect(screen.getByText('0%')).toBeInTheDocument(); // placement rate (0 / 3) = 0%
  });

  it('renders gold-silver-bronze podium when at least 3 students are present', () => {
    render(<MentorLeaderboardPage />);

    expect(screen.getByText('Top Student Performers')).toBeInTheDocument();
    expect(screen.getAllByText('Alice Cooper').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob Marley').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Charlie Chaplin').length).toBeGreaterThan(0);

    expect(screen.getAllByText('#1')[0]).toBeInTheDocument();
    expect(screen.getAllByText('#2')[0]).toBeInTheDocument();
    expect(screen.getAllByText('#3')[0]).toBeInTheDocument();
  });

  it('renders student list table with correct headers and rows', () => {
    render(<MentorLeaderboardPage />);

    expect(screen.getByText('Assigned Student Performance Rankings')).toBeInTheDocument();
    expect(screen.getByText('Student Info')).toBeInTheDocument();
    expect(screen.getByText('Batch/Cohort')).toBeInTheDocument();
    expect(screen.getByText('Engagement Metrics')).toBeInTheDocument();

    // Student names in table
    expect(screen.getAllByText('Alice Cooper').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob Marley').length).toBeGreaterThan(0);
  });

  it('filters student list by search query', () => {
    render(<MentorLeaderboardPage />);

    // Assert SaaS App is visible initially
    expect(screen.getByText('SaaS App')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Search students...');
    fireEvent.change(searchInput, { target: { value: 'Alice' } });

    // Table rows should filter
    expect(screen.getAllByText('Alice Cooper').length).toBeGreaterThan(0);
    expect(screen.queryByText('SaaS App')).not.toBeInTheDocument();
  });

  it('shows empty placeholder when search query finds no matches', () => {
    render(<MentorLeaderboardPage />);

    const searchInput = screen.getByPlaceholderText('Search students...');
    fireEvent.change(searchInput, { target: { value: 'Nonexistent Student' } });

    expect(screen.getByText('No assigned students found')).toBeInTheDocument();
    expect(screen.getByText('Adjust filter settings or search terms.')).toBeInTheDocument();
  });
});
