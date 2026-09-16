import { render, screen } from "@testing-library/react";
import { ShieldCheck } from "lucide-react";
import { describe, expect, it } from "vitest";
import EmptyState from "./EmptyState";

describe("EmptyState", () => {
  it("renders the title", () => {
    render(<EmptyState title="No findings match this filter" />);
    expect(screen.getByText("No findings match this filter")).toBeInTheDocument();
  });

  it("renders the subtitle when provided", () => {
    render(<EmptyState title="Nothing here" subtitle="Run a scan first." />);
    expect(screen.getByText("Run a scan first.")).toBeInTheDocument();
  });

  it("omits the subtitle element when not provided", () => {
    const { container } = render(<EmptyState title="Nothing here" />);
    expect(container.querySelector(".empty-state-sub")).toBeNull();
  });

  it("falls back to the default Inbox icon when none is given", () => {
    const { container } = render(<EmptyState title="Nothing here" />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("uses a custom icon when provided", () => {
    const { container } = render(<EmptyState title="No findings" icon={ShieldCheck} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders custom action content", () => {
    render(<EmptyState title="Nothing here" action={<button>Run Scan</button>} />);
    expect(screen.getByRole("button", { name: "Run Scan" })).toBeInTheDocument();
  });
});
