import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MagicCard from "./MagicCard";

describe("MagicCard", () => {
  it("renders its children", () => {
    render(
      <MagicCard>
        <span>Security Score</span>
      </MagicCard>,
    );
    expect(screen.getByText("Security Score")).toBeInTheDocument();
  });

  it("applies a custom className alongside the base magic-card class", () => {
    const { container } = render(<MagicCard className="kpi-card">content</MagicCard>);
    const card = container.querySelector(".magic-card");
    expect(card).toHaveClass("magic-card", "kpi-card");
  });

  it("renders a glow layer and a content wrapper", () => {
    const { container } = render(<MagicCard>content</MagicCard>);
    expect(container.querySelector(".magic-card-glow")).toBeInTheDocument();
    expect(container.querySelector(".magic-card-content")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    let clicked = false;
    render(<MagicCard onClick={() => (clicked = true)}>content</MagicCard>);
    fireEvent.click(screen.getByText("content"));
    expect(clicked).toBe(true);
  });

  it("does not throw when the pointer moves over or leaves the card", () => {
    const { container } = render(<MagicCard>content</MagicCard>);
    const card = container.querySelector(".magic-card")!;
    expect(() => {
      fireEvent.pointerMove(card, { clientX: 50, clientY: 40 });
      fireEvent.pointerLeave(card);
    }).not.toThrow();
  });
});
