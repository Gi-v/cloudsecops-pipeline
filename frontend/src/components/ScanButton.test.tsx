import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { endpoints } from "@/api/client";
import ScanButton from "./ScanButton";

vi.mock("sonner", () => ({
  toast: {
    // Mirrors real sonner behavior closely enough for these tests: calls
    // the loading/success/error callbacks and returns/rethrows based on
    // the underlying promise, without actually rendering any UI.
    // Sonner's real toast.promise doesn't reject the awaiter on failure —
    // it resolves either way after invoking the matching callback. An
    // earlier version of this mock re-threw on failure, which doesn't
    // match real sonner and produced a spurious unhandled-rejection
    // warning in the "scan fails" test below for no real bug.
    promise: async (
      p: Promise<unknown>,
      opts: { loading: string; success: (v: unknown) => string; error: (e: unknown) => string },
    ) => {
      try {
        const result = await p;
        opts.success(result);
        return result;
      } catch (err) {
        opts.error(err);
        return undefined;
      }
    },
  },
}));

vi.mock("@/api/client", () => ({
  endpoints: { triggerScan: vi.fn() },
}));

describe("ScanButton", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("shows the scanning label while a scan is in flight", async () => {
    vi.mocked(endpoints.triggerScan).mockReturnValue(
      new Promise(() => {}), // never resolves — keeps it in the "scanning" state
    );
    render(<ScanButton />);

    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => expect(screen.getByText("Scanning…")).toBeInTheDocument());
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("calls onDone shortly after a successful scan", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onDone = vi.fn();
    vi.mocked(endpoints.triggerScan).mockResolvedValue({
      data: { resources_scanned: 12, duration_ms: 340 },
    } as never);

    render(<ScanButton onDone={onDone} />);
    fireEvent.click(screen.getByRole("button"));

    await vi.waitFor(() => expect(endpoints.triggerScan).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(950);

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("does not call onDone when the scan fails", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const onDone = vi.fn();
    vi.mocked(endpoints.triggerScan).mockRejectedValue(new Error("network error"));

    render(<ScanButton onDone={onDone} />);
    fireEvent.click(screen.getByRole("button"));

    await vi.advanceTimersByTimeAsync(950);

    expect(onDone).not.toHaveBeenCalled();
  });

  it("passes the provider through to triggerScan and labels the button accordingly", () => {
    vi.mocked(endpoints.triggerScan).mockReturnValue(new Promise(() => {}));
    render(<ScanButton provider="AWS" />);

    expect(screen.getByText("Run Scan (AWS)")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));
    expect(endpoints.triggerScan).toHaveBeenCalledWith("AWS");
  });

  it("re-enables the button after the scan settles (loading resets in finally)", async () => {
    vi.mocked(endpoints.triggerScan).mockResolvedValue({
      data: { resources_scanned: 1, duration_ms: 10 },
    } as never);
    render(<ScanButton />);

    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
  });
});
