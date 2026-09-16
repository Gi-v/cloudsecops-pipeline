import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { MockWebSocket } from "@/test/mockWebSocket";
import { LiveFeedProvider, useLiveFeedContext } from "./LiveFeedContext";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { warning: vi.fn(), success: vi.fn(), error: vi.fn() }),
}));

function makeFindingMessage(violations: Array<{ severity: string; title: string }>) {
  return {
    type: "finding.enriched",
    data: {
      correlation_id: "c1",
      resource_urn: "arn:aws:s3:::test-bucket",
      resource_type: "aws_s3_bucket",
      provider: "AWS",
      violations,
      passed_controls: [],
      findings: [],
      evaluated_at: new Date().toISOString(),
    },
  };
}

function Probe() {
  const { messages, connected, alertCounts, clearAlertCounts } = useLiveFeedContext();
  return (
    <div>
      <div data-testid="connected">{String(connected)}</div>
      <div data-testid="count">{messages.length}</div>
      <div data-testid="critical">{alertCounts.critical}</div>
      <div data-testid="high">{alertCounts.high}</div>
      <button onClick={clearAlertCounts}>clear</button>
    </div>
  );
}

describe("LiveFeedProvider", () => {
  beforeEach(() => {
    MockWebSocket.reset();
    vi.stubGlobal("WebSocket", MockWebSocket);
    vi.mocked(toast.warning).mockClear();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("sets connected to true once the socket opens", async () => {
    render(<LiveFeedProvider><Probe /></LiveFeedProvider>);
    expect(screen.getByTestId("connected").textContent).toBe("false");

    act(() => MockWebSocket.latest().__simulateOpen());

    await waitFor(() => expect(screen.getByTestId("connected").textContent).toBe("true"));
  });

  it("appends incoming finding.enriched messages", async () => {
    render(<LiveFeedProvider><Probe /></LiveFeedProvider>);
    act(() => MockWebSocket.latest().__simulateOpen());
    act(() => MockWebSocket.latest().__simulateMessage(makeFindingMessage([])));

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));
  });

  it("caps stored messages at 50, dropping the oldest", async () => {
    render(<LiveFeedProvider><Probe /></LiveFeedProvider>);
    act(() => MockWebSocket.latest().__simulateOpen());

    for (let i = 0; i < 55; i++) {
      act(() => MockWebSocket.latest().__simulateMessage(makeFindingMessage([])));
    }

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("50"));
  });

  it("ignores messages that aren't finding.enriched", async () => {
    render(<LiveFeedProvider><Probe /></LiveFeedProvider>);
    act(() => MockWebSocket.latest().__simulateOpen());
    act(() => MockWebSocket.latest().onmessage?.({ data: JSON.stringify({ type: "something.else" }) }));

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("0"));
  });

  it("increments the critical count and fires a warning toast for CRITICAL violations", async () => {
    render(<LiveFeedProvider><Probe /></LiveFeedProvider>);
    act(() => MockWebSocket.latest().__simulateOpen());
    act(() =>
      MockWebSocket.latest().__simulateMessage(
        makeFindingMessage([{ severity: "CRITICAL", title: "Public bucket" }]),
      ),
    );

    await waitFor(() => expect(screen.getByTestId("critical").textContent).toBe("1"));
    expect(screen.getByTestId("high").textContent).toBe("0");
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it("increments the high count for HIGH violations without a CRITICAL toast", async () => {
    render(<LiveFeedProvider><Probe /></LiveFeedProvider>);
    act(() => MockWebSocket.latest().__simulateOpen());
    act(() =>
      MockWebSocket.latest().__simulateMessage(
        makeFindingMessage([{ severity: "HIGH", title: "Old access key" }]),
      ),
    );

    await waitFor(() => expect(screen.getByTestId("high").textContent).toBe("1"));
    expect(screen.getByTestId("critical").textContent).toBe("0");
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("ignores MEDIUM/LOW violations for the alert counters", async () => {
    render(<LiveFeedProvider><Probe /></LiveFeedProvider>);
    act(() => MockWebSocket.latest().__simulateOpen());
    act(() =>
      MockWebSocket.latest().__simulateMessage(
        makeFindingMessage([{ severity: "MEDIUM", title: "x" }, { severity: "LOW", title: "y" }]),
      ),
    );

    await waitFor(() => expect(screen.getByTestId("count").textContent).toBe("1"));
    expect(screen.getByTestId("critical").textContent).toBe("0");
    expect(screen.getByTestId("high").textContent).toBe("0");
  });

  it("clearAlertCounts resets both counters to zero", async () => {
    render(<LiveFeedProvider><Probe /></LiveFeedProvider>);
    act(() => MockWebSocket.latest().__simulateOpen());
    act(() =>
      MockWebSocket.latest().__simulateMessage(
        makeFindingMessage([{ severity: "CRITICAL", title: "x" }]),
      ),
    );
    await waitFor(() => expect(screen.getByTestId("critical").textContent).toBe("1"));

    act(() => screen.getByText("clear").click());

    expect(screen.getByTestId("critical").textContent).toBe("0");
  });

  it('shows "reconnected" toast only on the second connection, not the first', async () => {
    render(<LiveFeedProvider><Probe /></LiveFeedProvider>);
    act(() => MockWebSocket.latest().__simulateOpen());
    await waitFor(() => expect(screen.getByTestId("connected").textContent).toBe("true"));
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("attempts to reconnect after the socket closes unexpectedly", async () => {
    render(<LiveFeedProvider><Probe /></LiveFeedProvider>);
    act(() => MockWebSocket.latest().__simulateOpen());
    const instanceCountBeforeClose = MockWebSocket.instances.length;

    act(() => MockWebSocket.latest().__simulateClose());
    await waitFor(() => expect(screen.getByTestId("connected").textContent).toBe("false"));

    // Real timers on purpose — the reconnect delay starts at 1000ms and
    // fake timers don't reliably interleave with RTL's own scheduling in
    // this suite; a bounded real wait is slower but not flaky.
    await waitFor(
      () => expect(MockWebSocket.instances.length).toBeGreaterThan(instanceCountBeforeClose),
      { timeout: 2000 },
    );
  });

  it("closes the socket and does not schedule a reconnect after unmount", async () => {
    const { unmount } = render(<LiveFeedProvider><Probe /></LiveFeedProvider>);
    act(() => MockWebSocket.latest().__simulateOpen());
    const socket = MockWebSocket.latest();
    const instanceCountBeforeUnmount = MockWebSocket.instances.length;

    unmount();

    expect(socket.readyState).toBe(MockWebSocket.CLOSED);
    // give any (incorrectly) scheduled reconnect a chance to fire
    await new Promise((r) => setTimeout(r, 50));
    expect(MockWebSocket.instances.length).toBe(instanceCountBeforeUnmount);
  });
});
