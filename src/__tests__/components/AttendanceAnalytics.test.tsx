// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

// Mock Recharts to avoid JSdom layout measurement issues
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children, data }: any) => (
    <div data-testid="line-chart" data-data={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Line: () => <div data-testid="line" />,
  BarChart: ({ children, data }: any) => (
    <div data-testid="bar-chart" data-data={JSON.stringify(data)}>
      {children}
    </div>
  ),
  Bar: () => <div data-testid="bar" />,
  XAxis: () => <div data-testid="xaxis" />,
  YAxis: () => <div data-testid="yaxis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  CartesianGrid: () => <div data-testid="cartesiangrid" />,
}));

import { AttendanceAnalytics } from "@/components/attendance/AttendanceAnalytics";

const mockTrendData = [
  { date: "2026-05-10", rate: 85, present: 17, absent: 3 },
  { date: "2026-05-11", rate: 90, present: 18, absent: 2 },
];

const mockBatchData = [
  { batch: "Batch A", rate: 88, totalLogs: 40 },
  { batch: "Batch B", rate: 92, totalLogs: 35 },
];

describe("AttendanceAnalytics", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders trend line chart by default and allows switching to batch performance tab", async () => {
    render(<AttendanceAnalytics trendData={mockTrendData} batchData={mockBatchData} />);

    // Verify titles exist
    expect(screen.getByText("Attendance Insights")).toBeInTheDocument();

    // Verify LineChart exists initially
    const lineChart = screen.getByTestId("line-chart");
    expect(lineChart).toBeInTheDocument();
    expect(JSON.parse(lineChart.getAttribute("data-data") || "[]")).toEqual(mockTrendData);

    // Switch to Batch tab
    const batchTabButton = screen.getByRole("tab", { name: /batch rates/i });
    fireEvent.click(batchTabButton);

    // Verify BarChart exists after tab switch
    const barChart = await screen.findByTestId("bar-chart");
    expect(barChart).toBeInTheDocument();
    expect(JSON.parse(barChart.getAttribute("data-data") || "[]")).toEqual(mockBatchData);
  });

  it("renders empty state or handles empty data elegantly", () => {
    render(<AttendanceAnalytics trendData={[]} batchData={[]} />);

    expect(screen.getByText("No historic attendance records to plot")).toBeInTheDocument();
  });
});
