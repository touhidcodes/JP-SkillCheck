// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  useCreateAttendanceForm: vi.fn(),
  formLinkModal: vi.fn(),
}));

vi.mock("@/hooks/use-attendance-forms", () => ({
  useCreateAttendanceForm: mocks.useCreateAttendanceForm,
}));

vi.mock("@/components/attendance/FormLinkModal", () => ({
  FormLinkModal: (props: { open: boolean; publicUrl: string }) =>
    mocks.formLinkModal(props),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

import { CreateFormButton } from "@/components/attendance/CreateFormButton";

type ButtonProps = {
  sessionId: string;
  sessionLabel: string;
  date: string;
  mode: "session" | "daily";
  period: "full_day" | "morning" | "afternoon";
  topicTags: string;
  durationMinutes: number;
  expiryMinutes?: number;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderButton(props?: Partial<ButtonProps>) {
  return render(
    <CreateFormButton
      sessionId="session-abc"
      sessionLabel="Morning Session"
      date="2099-05-17"
      mode="session"
      period="full_day"
      topicTags="React, Placement"
      durationMinutes={90}
      expiryMinutes={120}
      {...props}
    />,
  );
}

describe("CreateFormButton", () => {
  beforeEach(() => {
    mocks.useCreateAttendanceForm.mockReturnValue({
      mutate: mocks.mutate,
      isPending: false,
    });
    mocks.formLinkModal.mockImplementation(
      ({ open, publicUrl }: { open: boolean; publicUrl: string }) =>
        open ? <div data-testid="form-link-modal">{publicUrl}</div> : null,
    );
  });

  it("Button is disabled when sessionId is empty string", () => {
    renderButton({ sessionId: "" });

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
  });

  it('Button label shows "Create Attendance Form" on desktop breakpoint', () => {
    renderButton();

    expect(screen.getByText("Create Attendance Form")).toHaveClass(
      "hidden",
      "sm:inline",
    );
    expect(screen.getByText("Form")).toHaveClass("sm:hidden");
  });

  it("Clicking button calls useCreateAttendanceForm mutate with correct payload", async () => {
    mocks.mutate.mockImplementation((payload, options) => {
      options?.onSuccess?.({
        id: "form-123",
        public_url: "https://app.test/attend/form-123",
        expires_at: "2099-05-17T10:00:00.000Z",
        session_label: "Morning Session",
        date: "2099-05-17",
      });
    });

    renderButton();

    fireEvent.click(
      screen.getByRole("button", { name: /create attendance form/i }),
    );

    expect(mocks.mutate).toHaveBeenCalledWith(
      {
        session_id: "session-abc",
        session_label: "Morning Session",
        date: "2099-05-17",
        mode: "session",
        period: "full_day",
        topic_tags: "React, Placement",
        duration_minutes: 90,
        expiry_minutes: 120,
      },
      expect.any(Object),
    );

    expect(await screen.findByTestId("form-link-modal")).toHaveTextContent(
      "https://app.test/attend/form-123",
    );
  });

  it("Error toast fires on mutation error", () => {
    mocks.mutate.mockImplementation((payload, options) => {
      options?.onError?.(new Error("Could not create form"));
    });

    renderButton();

    fireEvent.click(
      screen.getByRole("button", { name: /create attendance form/i }),
    );

    expect(mocks.toastError).toHaveBeenCalledWith("Could not create form");
  });
});
