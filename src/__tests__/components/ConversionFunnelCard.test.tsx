// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ConversionFunnelCard } from '@/components/analytics/overview/conversion-funnel-card';

afterEach(() => {
  cleanup();
});

const mockFunnelData = [
  { stage: 'learning', label: 'Learning', count: 100 },
  { stage: 'applying', label: 'Applying', count: 80 },
  { stage: 'interviewing', label: 'Interviewing', count: 40 },
  { stage: 'placed', label: 'Placed', count: 20 }
];

describe('ConversionFunnelCard', () => {
  it('Renders funnel rows and labels successfully', () => {
    render(<ConversionFunnelCard funnelData={mockFunnelData} />);

    expect(screen.getByText('Conversion Funnel')).toBeInTheDocument();
    expect(screen.getByText('Learning')).toBeInTheDocument();
    expect(screen.getByText('Applying')).toBeInTheDocument();
    expect(screen.getByText('Interviewing')).toBeInTheDocument();
    expect(screen.getByText('Placed')).toBeInTheDocument();
  });

  it('Calculates and displays drop-off rates between adjacent stages', () => {
    render(<ConversionFunnelCard funnelData={mockFunnelData} />);

    // Learning -> Applying: (100-80)/100 = 20% drop-off
    expect(screen.getByText('-20% drop-off')).toBeInTheDocument();

    // Applying -> Interviewing: (80-40)/80 = 50% drop-off
    // Interviewing -> Placed: (40-20)/40 = 50% drop-off
    const dropOffs = screen.getAllByText('-50% drop-off');
    expect(dropOffs).toHaveLength(2);
  });
});
