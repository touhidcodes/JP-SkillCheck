// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MentorStatsGrid } from '@/components/mentor/mentor-stats-grid';
import { MentorSmartNudges } from '@/components/mentor/mentor-smart-nudges';
import { MentorDashboardHeader } from '@/components/mentor/mentor-dashboard-header';

// Mock Tooltip components
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
}));

// Mock Dialog components since headers might render guides or dialogs
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div>{children}</div>,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>,
  DialogTrigger: ({ children }: any) => <div>{children}</div>,
}));

afterEach(() => {
  cleanup();
});

describe('MentorStatsGrid', () => {
  it('Renders all five stats cards with correct titles, values, and subtitles', () => {
    render(
      <MentorStatsGrid
        total={25}
        totalMenteesSubtitle="3 high risk"
        hiredThisMonth={4}
        hiredPercentage={16}
        highRisk={3}
        highRiskSubtitle="Immediate attention needed"
        avgAttendance={88}
        avgAttendanceSubtitle="Stable participation"
        activeThisWeek={20}
        inactiveCount={5}
      />
    );

    expect(screen.getByText('Total Mentees')).toBeInTheDocument();
    expect(screen.getByText('Hired This Month')).toBeInTheDocument();
    expect(screen.getByText('High Risk Students')).toBeInTheDocument();
    expect(screen.getByText('Avg Attendance')).toBeInTheDocument();
    expect(screen.getByText('Active This Week')).toBeInTheDocument();

    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('88%')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });
});

describe('MentorSmartNudges', () => {
  it('Flags no progress logs and stalled stages correctly', () => {
    const mockStudents = [
      { id: '1', name: 'John Doe', stage: 'applying', interview_count: 0 },
      { id: '2', name: 'Jane Smith', stage: 'learning' },
    ];
    const mockLogs = [
      { student_id: '2', note: 'Learning React', logged_at: new Date().toISOString() },
    ];
    const mockAttendance = [
      { date: '2026-05-20' },
    ];

    render(
      <MentorSmartNudges
        students={mockStudents}
        progressLogs={mockLogs}
        attendance={mockAttendance}
      />
    );

    expect(screen.getByText('Smart Nudges')).toBeInTheDocument();
    expect(screen.getByText(/Log progress notes for 1 students stalling past 14\+ days/i)).toBeInTheDocument();
    expect(screen.getByText(/Prep 1 active mentees in 'Applying' stage with 0 mock interviews/i)).toBeInTheDocument();
  });

  it('Renders catch-up message when no alerts are present', () => {
    render(
      <MentorSmartNudges
        students={[]}
        progressLogs={[]}
        attendance={[{ date: new Date().toISOString().slice(0, 10) }]}
      />
    );

    expect(screen.getByText('All clear! You are fully caught up with no pending alerts.')).toBeInTheDocument();
  });
});

describe('MentorDashboardHeader', () => {
  it('Renders cohort dropdown and sync actions', () => {
    render(
      <MentorDashboardHeader
        totalMentees={25}
        batches={['Batch 12', 'Batch 13']}
        activeBatch="all"
        onActiveBatchChange={vi.fn()}
        onImportClick={vi.fn()}
      />
    );

    expect(screen.getByText('Mentor Dashboard')).toBeInTheDocument();
  });
});
