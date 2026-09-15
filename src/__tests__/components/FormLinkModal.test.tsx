// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  toCanvas: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  useAttendanceFormDetail: vi.fn(),
  deactivate: vi.fn(),
}));

vi.mock("qrcode", () => ({
  default: {
    toCanvas: mocks.toCanvas,
  },
}));

vi.mock("@/hooks/use-attendance-forms", () => ({
  useAttendanceFormDetail: mocks.useAttendanceFormDetail,
  useDeactivateForm: () => ({
    mutate: mocks.deactivate,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

import { FormLinkModal } from "@/components/attendance/FormLinkModal";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mocks.toCanvas.mockResolvedValue(undefined);
  mocks.deactivate.mockImplementation((_payload, options) => {
    options?.onSuccess?.();
  });
  mocks.useAttendanceFormDetail.mockReturnValue({
    data: {
      submission_count: 7,
    },
  });
  Object.defineProperty(navigator, "clipboard", {
    value: {
      writeText: vi.fn().mockResolvedValue(undefined),
    },
    configurable: true,
  });
});

function renderModal(expiresAt = "2099-05-17T10:00:00.000Z") {
  return render(
    <FormLinkModal
      open
      onOpenChange={vi.fn()}
      formId="form-123"
      publicUrl="https://app.test/attend/form-123"
      expiresAt={expiresAt}
      sessionLabel="Morning Session"
    />,
  );
}

describe("FormLinkModal", () => {
  it("Renders public_url in the Input", () => {
    renderModal();

    expect(
      screen.getByDisplayValue("https://app.test/attend/form-123"),
    ).toBeInTheDocument();
  });

  it("Copy button calls navigator.clipboard.writeText", async () => {
    renderModal();

    const writeText = vi.mocked(navigator.clipboard.writeText);
    fireEvent.click(screen.getByRole("button", { name: /copy public link/i }));

    expect(writeText).toHaveBeenCalledWith("https://app.test/attend/form-123");
    await waitFor(() => {
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Link copied to clipboard",
      );
    });
  });

  it("Shows submission count from useAttendanceFormDetail", () => {
    renderModal();

    expect(screen.getByText(/7 submissions/i)).toBeInTheDocument();
  });

  it("Close Form Early button calls useDeactivateForm mutate", () => {
    renderModal();

    fireEvent.click(screen.getByRole("button", { name: /close form early/i }));

    expect(mocks.deactivate).toHaveBeenCalledWith(
      { id: "form-123" },
      expect.any(Object),
    );
  });

  it("Close Form Early button is hidden when form is expired", () => {
    renderModal("2020-01-01T00:00:00.000Z");

    expect(
      screen.queryByRole("button", { name: /close form early/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/Expired/i)).toBeInTheDocument();
  });
});
