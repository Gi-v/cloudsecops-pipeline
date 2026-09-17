import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ControlsPassingCard from "./ControlsPassingCard";

/** Regression coverage for a real bug fixed this session: the passing
 * count used to always render in --success green regardless of the actual
 * pass rate, the same "same visual language, different rule" bug this
 * project already fixed once for CIS vs Framework Coverage. It must track
 * complianceColor's real bands (>=80 success, >=65 warn, else danger). */
describe("ControlsPassingCard", () => {
  it("renders success green at a high pass rate", () => {
    render(<ControlsPassingCard passing={90} total={100} />);
    expect(screen.getByText("90")).toHaveStyle({ color: "var(--success)" });
  });

  it("renders warn amber at a mid pass rate — not hardcoded green", () => {
    render(<ControlsPassingCard passing={70} total={100} />);
    expect(screen.getByText("70")).toHaveStyle({ color: "var(--warn)" });
  });

  it("renders danger red at a low pass rate — not hardcoded green", () => {
    render(<ControlsPassingCard passing={30} total={100} />);
    expect(screen.getByText("30")).toHaveStyle({ color: "var(--danger)" });
  });

  it("treats zero total controls evaluated as 100%, not a misleading 0%", () => {
    const { container } = render(<ControlsPassingCard passing={0} total={0} />);
    const passingSpan = container.querySelector(".controls-lockup span:first-child");
    expect(passingSpan).toHaveStyle({ color: "var(--success)" });
  });

  it("renders the raw passing/total counts", () => {
    render(<ControlsPassingCard passing={42} total={50} />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
  });
});
