import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TextGenerateEffect from "./TextGenerateEffect";

describe("TextGenerateEffect", () => {
  it("renders every word of the input text", () => {
    render(<TextGenerateEffect text="Compliance Dashboard" />);
    expect(screen.getByText("Compliance")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("gives every word but the last a right margin, so words don't visually", () => {
    // Regression test for a real bug: an earlier version put a literal
    // space character *inside* each word's inline-block span. Browsers
    // trim trailing whitespace at the edge of an inline-block box even
    // though the space is genuinely present in the DOM, which rendered
    // "ComplianceDashboard" with zero gap despite textContent reading out
    // correctly. Spacing must come from margin, not an in-box text space.
    const { container } = render(<TextGenerateEffect text="Compliance Dashboard" />);
    const words = container.querySelectorAll("span span");
    expect(words).toHaveLength(2);
    expect((words[0] as HTMLElement).style.marginRight).not.toBe("");
    expect((words[0] as HTMLElement).style.marginRight).not.toBe("0px");
    expect((words[1] as HTMLElement).style.marginRight).toBe("0px");
  });

  it("handles a single word without a trailing margin", () => {
    const { container } = render(<TextGenerateEffect text="Findings" />);
    expect(container.textContent).toBe("Findings");
    const word = container.querySelector("span span") as HTMLElement;
    expect(word.style.marginRight).toBe("0px");
  });

  it("applies the given className to the outer wrapper", () => {
    const { container } = render(<TextGenerateEffect text="Resources" className="page-title-text" />);
    expect(container.querySelector(".page-title-text")).toBeInTheDocument();
  });
});
