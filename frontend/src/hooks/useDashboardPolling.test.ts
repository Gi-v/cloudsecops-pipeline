import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { endpoints } from "@/api/client";
import { useDashboardPolling } from "./useDashboardPolling";

vi.mock("@/api/client", () => ({
  endpoints: {
    getDashboardMetrics: vi.fn(),
    getCisFamilies: vi.fn(),
    getScoreTrend: vi.fn(),
    getTopRiskResources: vi.fn(),
  },
}));

const METRICS = {
  security_score: 70,
  critical_findings: 2,
  controls_passing: 10,
  controls_total: 20,
  avg_mttr_hours: 1,
  resources_scanned: 40,
  last_scan_at: "2026-01-01T00:00:00Z",
  severity_breakdown: {},
  framework_coverage: {},
};
const FAMILIES = [{ family: "IAM", control_count: 5, passing: 4, percent: 80 }];
const TREND = [{ correlation_id: "a", completed_at: "2026-01-01T00:00:00Z", security_score: 70, controls_passing: 10, controls_total: 20, critical_findings: 2, resources_scanned: 40 }];
const TOP_RISK = [{ resource_id: "r1", resource_urn: "arn:aws:s3:::demo", provider: "AWS", resource_type: "aws_s3_bucket", open_findings: 3, risk_score: 15, worst_severity: "CRITICAL" }];

function mockAllEndpoints() {
  vi.mocked(endpoints.getDashboardMetrics).mockResolvedValue({ data: METRICS } as never);
  vi.mocked(endpoints.getCisFamilies).mockResolvedValue({ data: FAMILIES } as never);
  vi.mocked(endpoints.getScoreTrend).mockResolvedValue({ data: TREND } as never);
  vi.mocked(endpoints.getTopRiskResources).mockResolvedValue({ data: TOP_RISK } as never);
}

describe("useDashboardPolling", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("fetches metrics, families, trend, and top-risk resources on mount", async () => {
    mockAllEndpoints();

    const { result } = renderHook(() => useDashboardPolling());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.metrics).toEqual(METRICS);
    expect(result.current.families).toEqual(FAMILIES);
    expect(result.current.trend).toEqual(TREND);
    expect(result.current.topRisk).toEqual(TOP_RISK);
  });

  it("does not replace state when a poll returns an identical payload (dedupe)", async () => {
    mockAllEndpoints();

    const { result } = renderHook(() => useDashboardPolling());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const firstMetricsRef = result.current.metrics;
    const firstFamiliesRef = result.current.families;
    const firstTrendRef = result.current.trend;

    await act(() => result.current.refresh());

    // Same payload, byte-for-byte — the hook should keep the exact same
    // object/array references rather than setting new ones, which is what
    // stops every chart from rebuilding its whole dataset on a no-op poll.
    expect(result.current.metrics).toBe(firstMetricsRef);
    expect(result.current.families).toBe(firstFamiliesRef);
    expect(result.current.trend).toBe(firstTrendRef);
  });

  it("does replace state when a poll returns a changed payload", async () => {
    mockAllEndpoints();
    vi.mocked(endpoints.getDashboardMetrics).mockResolvedValueOnce({ data: METRICS } as never);

    const { result } = renderHook(() => useDashboardPolling());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const updatedMetrics = { ...METRICS, security_score: 85 };
    vi.mocked(endpoints.getDashboardMetrics).mockResolvedValueOnce({ data: updatedMetrics } as never);

    await act(() => result.current.refresh());

    await waitFor(() => expect(result.current.metrics?.security_score).toBe(85));
  });

  it("keeps loading false and swallows errors when the backend is unreachable", async () => {
    vi.mocked(endpoints.getDashboardMetrics).mockRejectedValue(new Error("network error"));
    vi.mocked(endpoints.getCisFamilies).mockRejectedValue(new Error("network error"));
    vi.mocked(endpoints.getScoreTrend).mockRejectedValue(new Error("network error"));
    vi.mocked(endpoints.getTopRiskResources).mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useDashboardPolling());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.metrics).toBeNull();
  });
});
