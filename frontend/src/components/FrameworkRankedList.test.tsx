import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FrameworkRankedList from "./FrameworkRankedList";

describe("FrameworkRankedList", () => {
  it("shows an empty state when there's no coverage data yet", () => {
    render(<FrameworkRankedList coverage={{}} />);
    expect(screen.getByText("No framework data yet")).toBeInTheDocument();
  });

  it("ranks frameworks highest score first, numbered from 01", () => {
    const { container } = render(
      <FrameworkRankedList coverage={{ "CIS v2": 60, "NIST CSF": 90, "ISO 27001": 75 }} />,
    );
    const names = [...container.querySelectorAll(".framework-name")].map((n) => n.textContent);
    expect(names).toEqual(["NIST CSF", "ISO 27001", "CIS v2"]);

    const ranks = [...container.querySelectorAll(".framework-rank")].map((n) => n.textContent);
    expect(ranks).toEqual(["01", "02", "03"]);
  });

  it("colors each score by the same compliance bands used everywhere else", () => {
    const { container } = render(
      <FrameworkRankedList coverage={{ high: 90, mid: 70, low: 40 }} />,
    );
    const scores = [...container.querySelectorAll(".framework-score")];
    const colorFor = (text: string) =>
      (scores.find((s) => s.textContent === text) as HTMLElement).style.color;

    expect(colorFor("90")).toBe("var(--success)");
    expect(colorFor("70")).toBe("var(--warn)");
    expect(colorFor("40")).toBe("var(--danger)");
  });
});
