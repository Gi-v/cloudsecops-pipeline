import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartSkeleton, KpiSkeleton, Skeleton, TableRowSkeleton } from "./Skeleton";

describe("Skeleton", () => {
  it("applies the given width and height as inline styles", () => {
    const { container } = render(<Skeleton width={120} height={20} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe("120px");
    expect(el.style.height).toBe("20px");
  });

  it("defaults to 100% width when none is given", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe("100%");
  });
});

describe("KpiSkeleton", () => {
  it("renders two shimmer blocks inside a glass card", () => {
    const { container } = render(<KpiSkeleton />);
    expect(container.querySelectorAll(".skeleton").length).toBe(2);
    expect(container.querySelector(".glass")).toBeInTheDocument();
  });
});

describe("TableRowSkeleton", () => {
  it("renders the requested number of columns", () => {
    const { container } = render(
      <table>
        <tbody>
          <TableRowSkeleton cols={4} />
        </tbody>
      </table>,
    );
    expect(container.querySelectorAll("td").length).toBe(4);
  });

  it("defaults to 5 columns", () => {
    const { container } = render(
      <table>
        <tbody>
          <TableRowSkeleton />
        </tbody>
      </table>,
    );
    expect(container.querySelectorAll("td").length).toBe(5);
  });
});

describe("ChartSkeleton", () => {
  it("renders a circular shimmer placeholder", () => {
    const { container } = render(<ChartSkeleton />);
    expect(container.querySelector(".skeleton")).toBeInTheDocument();
  });
});
