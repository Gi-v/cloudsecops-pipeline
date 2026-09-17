import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SecurityScoreCard, { criticalDelta, formatRelativeTime } from "./SecurityScoreCard";
import type { ScoreTrendPoint } from "@/types";

function point(overrides: Partial<ScoreTrendPoint>): ScoreTrendPoint {
  return {
    correlation_id: "a",
    completed_at: "2026-01-01T00:00:00Z",
    security_score: 70,
    controls_passing: 10,
    controls_total: 20,
    critical_findings: 2,
    resources_scanned: 12,
    ...overrides,
  };
}

describe("formatRelativeTime", () => {
  const now = new Date("2026-01-01T12:00:00Z").getTime();

  it("says there's no scan yet when the timestamp is null", () => {
    expect(formatRelativeTime(null, now)).toBe("No scans yet");
  });

  it("says just now for anything under a minute old", () => {
    expect(formatRelativeTime(new Date(now - 30_000).toISOString(), now)).toBe("Just now");
  });

  it("formats minutes, hours, and days correctly", () => {
    expect(formatRelativeTime(new Date(now - 5 * 60_000).toISOString(), now)).toBe("5 min ago");
    expect(formatRelativeTime(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe("3 hrs ago");
    expect(formatRelativeTime(new Date(now - 25 * 3_600_000).toISOString(), now)).toBe("1 day ago");
  });
});

describe("criticalDelta", () => {
  it("returns null with fewer than two trend points — nothing to compare against", () => {
    expect(criticalDelta(3, [])).toBeNull();
    expect(criticalDelta(3, [point({})])).toBeNull();
  });

  it("returns the real difference against the previous scan (trend[length-2])", () => {
    // Previous scan (second-to-last point) had 5 open criticals.
    const trend = [point({ critical_findings: 5 }), point({ critical_findings: 999 })];
    expect(criticalDelta(5, trend)).toBe(0); // unchanged
    expect(criticalDelta(7, trend)).toBe(2); // regressed (+2)
    expect(criticalDelta(2, trend)).toBe(-3); // improved (-3)
  });
});

describe("SecurityScoreCard", () => {
  const baseProps = {
    controlsPassing: 10,
    controlsTotal: 20,
    criticalFindings: 2,
    resourcesScanned: 8,
    lastScanAt: "2026-01-01T11:58:00Z",
  };

  it("shows real elapsed time instead of a hardcoded string", () => {
    render(<SecurityScoreCard {...baseProps} score={70} trend={[]} />);
    expect(screen.queryByText(/Last scan 4 min ago/)).not.toBeInTheDocument();
    expect(screen.getByText(/Last scan/)).toBeInTheDocument();
  });

  it("hides the critical-trend chip when there's no prior scan to compare against", () => {
    render(<SecurityScoreCard {...baseProps} score={70} trend={[]} />);
    expect(screen.queryByText(/Critical/)).not.toBeInTheDocument();
  });

  it("shows a real up/down chip once there's a previous scan", () => {
    const trend = [point({ critical_findings: 5 }), point({ critical_findings: 2 })];
    render(<SecurityScoreCard {...baseProps} criticalFindings={2} score={70} trend={trend} />);
    expect(screen.getByText(/↓ 3 Critical/)).toBeInTheDocument();
  });
});
