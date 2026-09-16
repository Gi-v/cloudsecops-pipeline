import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TrendChart from "./TrendChart";
import type { ScoreTrendPoint } from "@/types";

function point(overrides: Partial<ScoreTrendPoint>): ScoreTrendPoint {
  return {
    correlation_id: "a",
    completed_at: "2026-01-01T00:00:00Z",
    security_score: 70,
    controls_passing: 10,
    controls_total: 20,
    critical_findings: 2,
    ...overrides,
  };
}

describe("TrendChart", () => {
  it("shows an empty state with zero points", () => {
    render(<TrendChart points={[]} />);
    expect(screen.getByText("Not enough scan history yet")).toBeInTheDocument();
  });

  it("shows the same empty state with only one point — a single score isn't a trend", () => {
    render(<TrendChart points={[point({})]} />);
    expect(screen.getByText("Not enough scan history yet")).toBeInTheDocument();
  });

  it("renders the chart once there are at least two points", () => {
    const points = [point({ security_score: 60 }), point({ correlation_id: "b", security_score: 75 })];
    const { container } = render(<TrendChart points={points} />);
    expect(container.querySelector("canvas")).toBeInTheDocument();
    expect(screen.queryByText("Not enough scan history yet")).not.toBeInTheDocument();
  });
});
