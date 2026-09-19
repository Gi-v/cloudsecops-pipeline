import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { endpoints } from "@/api/client";
import AnalyticsPage from "./AnalyticsPage";

vi.mock("@/api/client", () => ({
  endpoints: {
    getScoreTrend: vi.fn(),
    getTrendByProvider: vi.fn(),
    getFindingsTimeline: vi.fn(),
  },
}));

describe("AnalyticsPage", () => {
  afterEach(() => vi.clearAllMocks());

  it("shows empty states for every chart when there's no history yet", async () => {
    vi.mocked(endpoints.getScoreTrend).mockResolvedValue({ data: [] } as never);
    vi.mocked(endpoints.getTrendByProvider).mockResolvedValue({ data: [] } as never);
    vi.mocked(endpoints.getFindingsTimeline).mockResolvedValue({ data: [] } as never);

    render(<AnalyticsPage />);

    await waitFor(() => expect(screen.getByText("Not enough scan history yet")).toBeInTheDocument());
    expect(screen.getByText("No per-provider scan history yet")).toBeInTheDocument();
    expect(screen.getByText("No findings yet")).toBeInTheDocument();
  });

  it("renders real charts once data exists", async () => {
    vi.mocked(endpoints.getScoreTrend).mockResolvedValue({
      data: [
        { correlation_id: "a", completed_at: "2026-01-01T00:00:00Z", security_score: 60, controls_passing: 5, controls_total: 10, critical_findings: 1, resources_scanned: 5 },
        { correlation_id: "b", completed_at: "2026-01-02T00:00:00Z", security_score: 75, controls_passing: 8, controls_total: 10, critical_findings: 0, resources_scanned: 6 },
      ],
    } as never);
    vi.mocked(endpoints.getTrendByProvider).mockResolvedValue({
      data: [{ correlation_id: "a", provider: "AWS", completed_at: "2026-01-01T00:00:00Z", security_score: 60 }],
    } as never);
    vi.mocked(endpoints.getFindingsTimeline).mockResolvedValue({
      data: [{ date: "2026-01-01", severities: { CRITICAL: 2, LOW: 1 } }],
    } as never);

    const { container } = render(<AnalyticsPage />);

    await waitFor(() => expect(container.querySelectorAll("canvas").length).toBe(3));
  });
});
