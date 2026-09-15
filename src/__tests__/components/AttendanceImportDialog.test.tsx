// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";

const mocks = vi.hoisted(() => ({
  parseExcelFile: vi.fn(),
  normalizeRows: vi.fn(),
  onImport: vi.fn(),
  onOpenChange: vi.fn(),
}));

vi.mock("@/lib/import/excel-mapper", () => ({
  parseExcelFile: mocks.parseExcelFile,
  normalizeRows: mocks.normalizeRows,
  IMPORT_FIELDS: [
    { key: "name", label: "Name", required: true },
    { key: "student_email", label: "Email", required: true },
    { key: "attendance_status", label: "Attendance Status" },
    { key: "notes", label: "Notes" },
  ],
}));

import { AttendanceImportDialog } from "@/components/attendance/AttendanceImportDialog";

const mockStudents = [
  { id: "student-1", name: "Riad Parvin", student_email: "riad@test.com", batch: "Batch-1" },
  { id: "student-2", name: "John Doe", student_email: "john@test.com", batch: "Batch-1" },
];

describe("AttendanceImportDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("does not render when open is false", () => {
    render(
      <AttendanceImportDialog
        open={false}
        onOpenChange={mocks.onOpenChange}
        students={mockStudents as any}
        onImport={mocks.onImport}
      />
    );
    expect(screen.queryByText("Bulk Import Attendance")).not.toBeInTheDocument();
  });

  it("renders file upload step when open is true", () => {
    render(
      <AttendanceImportDialog
        open={true}
        onOpenChange={mocks.onOpenChange}
        students={mockStudents as any}
        onImport={mocks.onImport}
      />
    );
    expect(screen.getByText("Bulk Import Attendance")).toBeInTheDocument();
    expect(screen.getByText("Upload Attendance File")).toBeInTheDocument();
  });
});
