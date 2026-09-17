import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AlertOctagon } from "lucide-react";
import KpiCard from "./KpiCard";

describe("KpiCard", () => {
  it("renders the label and value", () => {
    render(<KpiCard label="Critical Findings" value={7} icon={AlertOctagon} color="var(--danger)" />);
    expect(screen.getByText("Critical Findings")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("renders no sparkline when no real series is given", () => {
    const { container } = render(<KpiCard label="Critical Findings" value={7} />);
    expect(container.querySelector(".kpi-sparkline")).not.toBeInTheDocument();
  });

  it("renders a dashed placeholder line (not a fake trend) when the series is too short", () => {
    const { container } = render(<KpiCard label="Resources Scanned" value={12} sparklineData={[12]} />);
    const svg = container.querySelector(".kpi-sparkline")!;
    expect(svg).toBeInTheDocument();
    expect(svg.querySelector("polyline")).not.toBeInTheDocument();
    expect(svg.querySelector("line")).toBeInTheDocument();
  });

  it("renders a real gradient sparkline from actual historical data", () => {
    const { container } = render(<KpiCard label="Resources Scanned" value={12} sparklineData={[4, 9, 6, 12]} />);
    const svg = container.querySelector(".kpi-sparkline")!;
    expect(svg.querySelector("polyline")).toBeInTheDocument();
    expect(svg.querySelector("circle.kpi-sparkline-dot")).toBeInTheDocument();
  });
});
