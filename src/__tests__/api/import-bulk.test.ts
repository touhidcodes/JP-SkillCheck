import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/import/bulk/route';

const sharedMocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  appendRow: vi.fn(),
  appendRows: vi.fn(),
  batchUpdateRows: vi.fn(),
  getAllStudents: vi.fn(),
  calculateRiskScore: vi.fn(),
}));

vi.mock('@/lib/auth/helpers', () => ({
  requireRole: sharedMocks.requireRole,
}));

vi.mock('@/lib/sheets/client', () => ({
  appendRow: sharedMocks.appendRow,
  appendRows: sharedMocks.appendRows,
  batchUpdateRows: sharedMocks.batchUpdateRows,
}));

vi.mock('@/lib/sheets/students', () => ({
  getAllStudents: sharedMocks.getAllStudents,
  studentToRow: (student: any) => [student.id, student.name, student.batch, student.student_email],
}));

vi.mock('@/lib/sheets/progress-logs', () => ({
  progressLogToRow: (log: any) => [log.id, log.student_id, log.student_name, log.student_email, log.note],
}));

vi.mock('@/lib/risk/placement-risk', () => ({
  calculateRiskScore: sharedMocks.calculateRiskScore,
}));

function makeRequest(body: unknown): Request {
  return new Request('https://app.test/api/import/bulk', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': 'Bearer test-token',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/import/bulk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sharedMocks.requireRole.mockReturnValue({ email: 'manager@example.com', role: 'manager' });
    sharedMocks.getAllStudents.mockResolvedValue([
      {
        id: 'existing-1',
        name: 'Existing Student',
        student_email: 'existing@example.com',
        batch: 'batch-1',
      },
    ]);
    sharedMocks.calculateRiskScore.mockReturnValue({ level: 'safe' });
    sharedMocks.batchUpdateRows.mockResolvedValue(undefined);
    sharedMocks.appendRows.mockResolvedValue(undefined);
    sharedMocks.appendRow.mockResolvedValue(undefined);
  });

  it('performs batch creation, updates, and appends logs on valid import data', async () => {
    const payload = {
      file_name: 'test-import.xlsx',
      rows: [
        {
          row_number: 2,
          student: {
            name: 'New Student',
            student_email: 'new@example.com',
            batch: 'batch-2',
            notes: 'First log note',
          },
          attendance: {
            date: '2026-06-02',
            session_type: 'Daily',
            status: 'Present',
          },
          conflict_action: 'merge',
        },
        {
          row_number: 3,
          student: {
            name: 'Existing Student Edited',
            student_email: 'existing@example.com',
            batch: 'batch-1',
          },
          conflict_action: 'overwrite',
        },
      ],
    };

    const response = await POST(makeRequest(payload));
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.summary).toEqual(
      expect.objectContaining({
        imported: 1,
        updated: 1,
        skipped: 0,
        conflicts: 1,
        attendance_created: 1,
        progress_created: 1,
      })
    );

    // Assert batchUpdateRows is called for the existing student update
    expect(sharedMocks.batchUpdateRows).toHaveBeenCalledTimes(1);
    expect(sharedMocks.batchUpdateRows).toHaveBeenCalledWith('students', [
      expect.objectContaining({
        sheetRow: 2, // index 0 in getAllStudents + 2
        values: expect.arrayContaining(['existing-1', 'Existing Student Edited', 'batch-1', 'existing@example.com']),
      }),
    ]);

    // Assert appendRows is called for the new student insertion
    expect(sharedMocks.appendRows).toHaveBeenCalledWith('students', [
      expect.arrayContaining([expect.any(String), 'New Student', 'batch-2', 'new@example.com']),
    ]);

    // Assert appendRows is called for attendance logs
    expect(sharedMocks.appendRows).toHaveBeenCalledWith('attendance_logs', [
      expect.arrayContaining(['2026-06-02', 'true', 'manager@example.com']),
    ]);

    // Assert appendRows is called for progress logs
    expect(sharedMocks.appendRows).toHaveBeenCalledWith('progress_logs', [
      expect.arrayContaining(['New Student', 'new@example.com', 'First log note']),
    ]);
  });

  it('returns 400 when validation fails due to empty name', async () => {
    const payload = {
      file_name: 'test-import.xlsx',
      rows: [
        {
          row_number: 2,
          student: {
            name: '',
            student_email: 'invalid@example.com',
          },
        },
      ],
    };

    const response = await POST(makeRequest(payload));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.message).toBe('Validation failed');
  });

  it('fails when user role is not authorized', async () => {
    sharedMocks.requireRole.mockImplementation(() => {
      throw new Error('Unauthorized role');
    });

    const payload = {
      file_name: 'test-import.xlsx',
      rows: [
        {
          row_number: 2,
          student: {
            name: 'John Doe',
            student_email: 'john@example.com',
          },
        },
      ],
    };

    const response = await POST(makeRequest(payload));
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.message).toBe('Unauthorized role');
  });
});
