import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUser = {
  id: "user-1",
  role: "mentor" as const,
  email: "mentor@example.com",
  name: "Mentor One",
};

const sharedMocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  ensureAttendanceFormsSheet: vi.fn(),
  createAttendanceForm: vi.fn(),
  findActiveFormForSession: vi.fn(),
  listFormsByMentor: vi.fn(),
  getAttendanceFormById: vi.fn(),
  updateAttendanceForm: vi.fn(),
  appendAuditLog: vi.fn(),
  buildPublicFormUrl: vi.fn((id: string) => `https://app.test/attend/${id}`),
}));

vi.mock("@/lib/auth/helpers", () => ({
  requireRole: sharedMocks.requireRole,
}));
vi.mock("@/lib/sheets/initialize", () => ({
  ensureAttendanceFormsSheet: sharedMocks.ensureAttendanceFormsSheet,
}));
vi.mock("@/lib/sheets/attendance-forms", () => ({
  createAttendanceForm: sharedMocks.createAttendanceForm,
  findActiveFormForSession: sharedMocks.findActiveFormForSession,
  listFormsByMentor: sharedMocks.listFormsByMentor,
  getAttendanceFormById: sharedMocks.getAttendanceFormById,
  updateAttendanceForm: sharedMocks.updateAttendanceForm,
}));
vi.mock("@/lib/sheets/audit", () => ({
  appendAuditLog: sharedMocks.appendAuditLog,
}));
vi.mock("@/lib/utils/form-url", () => ({
  buildPublicFormUrl: sharedMocks.buildPublicFormUrl,
}));

import {
  GET as getAttendanceForms,
  POST as createAttendanceFormRoute,
} from "@/app/api/attendance-forms/route";
import {
  GET as getAttendanceFormById,
  PATCH as patchAttendanceFormById,
} from "@/app/api/attendance-forms/[id]/route";

function jsonRequest(url: string, body?: unknown, init?: RequestInit): Request {
  return new Request(url, {
    method: init?.method ?? (body ? "POST" : "GET"),
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function readJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

describe("attendance-forms API routes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-17T12:00:00.000Z"));
    vi.clearAllMocks();
    sharedMocks.requireRole.mockReturnValue(mockUser);
    sharedMocks.ensureAttendanceFormsSheet.mockResolvedValue(undefined);
    sharedMocks.appendAuditLog.mockResolvedValue(undefined);
    sharedMocks.buildPublicFormUrl.mockImplementation(
      (id: string) => `https://app.test/attend/${id}`,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("POST /api/attendance-forms creates a form and returns public_url with status 201", async () => {
    sharedMocks.findActiveFormForSession.mockResolvedValue(null);
    sharedMocks.createAttendanceForm.mockResolvedValue({
      id: "form-123",
      mentor_email: mockUser.email,
      session_id: "session-abc",
      session_label: "Morning Session",
      date: "2026-05-17",
      mode: "session",
      period: "full_day",
      expires_at: "2026-05-17T10:00:00.000Z",
      created_at: "2026-05-17T08:00:00.000Z",
      is_active: true,
      submission_count: 0,
      topic_tags: "",
      duration_minutes: 0,
    });

    const response = await createAttendanceFormRoute(
      jsonRequest("https://app.test/api/attendance-forms", {
        session_id: "session-abc",
        session_label: "Morning Session",
        date: "2026-05-17",
        mode: "session",
        period: "full_day",
        expiry_minutes: 120,
      }),
    );

    expect(response.status).toBe(201);
    expect(sharedMocks.ensureAttendanceFormsSheet).toHaveBeenCalledTimes(1);
    expect(sharedMocks.createAttendanceForm).toHaveBeenCalledWith(
      expect.objectContaining({
        mentor_email: mockUser.email,
        session_id: "session-abc",
        session_label: "Morning Session",
        date: "2026-05-17",
        mode: "session",
        period: "full_day",
        expiry_minutes: 120,
      }),
    );

    const body = await readJson(response);
    expect(body).toMatchObject({
      id: "form-123",
      public_url: "https://app.test/attend/form-123",
      expires_at: "2026-05-17T10:00:00.000Z",
      session_label: "Morning Session",
      date: "2026-05-17",
      is_existing: false,
    });
  });

  it("POST /api/attendance-forms returns existing form (is_existing: true) when called again for same session_id", async () => {
    sharedMocks.findActiveFormForSession.mockResolvedValue({
      id: "form-existing",
      mentor_email: mockUser.email,
      session_id: "session-abc",
      session_label: "Morning Session",
      date: "2026-05-17",
      mode: "session",
      period: "full_day",
      expires_at: "2026-05-17T10:00:00.000Z",
      created_at: "2026-05-17T08:00:00.000Z",
      is_active: true,
      submission_count: 1,
      topic_tags: "",
      duration_minutes: 0,
    });

    const response = await createAttendanceFormRoute(
      jsonRequest("https://app.test/api/attendance-forms", {
        session_id: "session-abc",
        session_label: "Morning Session",
        date: "2026-05-17",
        mode: "session",
        period: "full_day",
      }),
    );

    expect(response.status).toBe(200);
    expect(sharedMocks.createAttendanceForm).not.toHaveBeenCalled();
    const body = await readJson(response);
    expect(body).toMatchObject({
      id: "form-existing",
      public_url: "https://app.test/attend/form-existing",
      expires_at: "2026-05-17T10:00:00.000Z",
      session_label: "Morning Session",
      date: "2026-05-17",
      is_existing: true,
    });
  });

  it("POST /api/attendance-forms returns 401 without valid auth", async () => {
    sharedMocks.requireRole.mockImplementation(() => {
      throw { message: "Unauthorized", status: 401 };
    });

    const response = await createAttendanceFormRoute(
      jsonRequest("https://app.test/api/attendance-forms", {
        session_id: "session-abc",
        session_label: "Morning Session",
        date: "2026-05-17",
        mode: "session",
        period: "full_day",
      }),
    );

    expect(response.status).toBe(401);
  });

  it("POST /api/attendance-forms returns 400 for missing session_id", async () => {
    const response = await createAttendanceFormRoute(
      jsonRequest("https://app.test/api/attendance-forms", {
        session_label: "Morning Session",
        date: "2026-05-17",
        mode: "session",
        period: "full_day",
      }),
    );

    expect(response.status).toBe(400);
    const body = await readJson(response);
    expect(body).toMatchObject({ message: "Validation failed" });
    expect(body.errors).toHaveProperty("session_id");
  });

  it("POST /api/attendance-forms returns 400 for date more than 1 day in the past", async () => {
    const response = await createAttendanceFormRoute(
      jsonRequest("https://app.test/api/attendance-forms", {
        session_id: "session-abc",
        session_label: "Morning Session",
        date: "2020-01-01",
        mode: "session",
        period: "full_day",
      }),
    );

    expect(response.status).toBe(400);
    const body = await readJson(response);
    expect(body.errors).toHaveProperty("date");
  });

  it("GET /api/attendance-forms returns only forms for the requesting mentor's email", async () => {
    sharedMocks.listFormsByMentor.mockResolvedValue([
      {
        id: "form-a",
        mentor_email: mockUser.email,
        session_id: "session-a",
        session_label: "Morning Session",
        date: "2026-05-17",
        mode: "session",
        period: "full_day",
        expires_at: "2026-05-17T10:00:00.000Z",
        created_at: "2026-05-17T08:00:00.000Z",
        is_active: true,
        submission_count: 2,
        topic_tags: "",
        duration_minutes: 0,
      },
    ]);

    const response = await getAttendanceForms(
      new Request("https://app.test/api/attendance-forms?date=2026-05-17"),
    );

    expect(response.status).toBe(200);
    expect(sharedMocks.listFormsByMentor).toHaveBeenCalledWith(
      mockUser.email,
      "2026-05-17",
    );
    const body = await readJson(response);
    expect(body.total).toBe(1);
    expect((body.data as Array<Record<string, unknown>>)[0]).toMatchObject({
      id: "form-a",
      mentor_email: mockUser.email,
      public_url: "https://app.test/attend/form-a",
    });
  });

  it("GET /api/attendance-forms filters by ?date query param", async () => {
    sharedMocks.listFormsByMentor.mockResolvedValue([]);

    await getAttendanceForms(
      new Request("https://app.test/api/attendance-forms?date=2026-05-18"),
    );

    expect(sharedMocks.listFormsByMentor).toHaveBeenCalledWith(
      mockUser.email,
      "2026-05-18",
    );
  });

  it("PATCH /api/attendance-forms/[id] sets is_active to false", async () => {
    sharedMocks.getAttendanceFormById.mockResolvedValue({
      id: "form-a",
      mentor_email: mockUser.email,
      session_id: "session-a",
      session_label: "Morning Session",
      date: "2026-05-17",
      mode: "session",
      period: "full_day",
      expires_at: "2026-05-17T10:00:00.000Z",
      created_at: "2026-05-17T08:00:00.000Z",
      is_active: true,
      submission_count: 2,
      topic_tags: "",
      duration_minutes: 0,
    });

    const response = await patchAttendanceFormById(
      jsonRequest(
        "https://app.test/api/attendance-forms/form-a",
        { is_active: false },
        { method: "PATCH" },
      ),
      { params: { id: "form-a" } },
    );

    expect(response.status).toBe(200);
    expect(sharedMocks.updateAttendanceForm).toHaveBeenCalledWith("form-a", {
      is_active: false,
    });
    const body = await readJson(response);
    expect(body).toEqual({ success: true });
  });

  it("PATCH /api/attendance-forms/[id] returns 403 if mentor does not own the form", async () => {
    sharedMocks.getAttendanceFormById.mockResolvedValue({
      id: "form-a",
      mentor_email: "other@example.com",
      session_id: "session-a",
      session_label: "Morning Session",
      date: "2026-05-17",
      mode: "session",
      period: "full_day",
      expires_at: "2026-05-17T10:00:00.000Z",
      created_at: "2026-05-17T08:00:00.000Z",
      is_active: true,
      submission_count: 2,
      topic_tags: "",
      duration_minutes: 0,
    });

    const response = await patchAttendanceFormById(
      jsonRequest(
        "https://app.test/api/attendance-forms/form-a",
        { is_active: false },
        { method: "PATCH" },
      ),
      { params: { id: "form-a" } },
    );

    expect(response.status).toBe(403);
    expect(sharedMocks.updateAttendanceForm).not.toHaveBeenCalled();
  });

  it("GET /api/attendance-forms/[id] returns safe public fields (no mentor_email)", async () => {
    sharedMocks.getAttendanceFormById.mockResolvedValue({
      id: "form-public",
      mentor_email: mockUser.email,
      session_id: "session-public",
      session_label: "Morning Session",
      date: "2099-05-17",
      mode: "session",
      period: "full_day",
      expires_at: "2099-05-17T10:00:00.000Z",
      created_at: "2099-05-17T08:00:00.000Z",
      is_active: true,
      submission_count: 3,
      topic_tags: "",
      duration_minutes: 0,
    });

    const response = await getAttendanceFormById(
      new Request("https://app.test/api/attendance-forms/form-public"),
      { params: { id: "form-public" } },
    );

    expect(response.status).toBe(200);
    const body = await readJson(response);
    expect(body).not.toHaveProperty("mentor_email");
    expect(body).toMatchObject({
      id: "form-public",
      session_label: "Morning Session",
      date: "2099-05-17",
      mode: "session",
      period: "full_day",
      expires_at: "2099-05-17T10:00:00.000Z",
      is_active: true,
      is_expired: false,
      submission_count: 3,
      public_url: "https://app.test/attend/form-public",
    });
  });
});
