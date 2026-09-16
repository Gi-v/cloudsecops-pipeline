import { afterEach, describe, expect, it } from "vitest";
import { chartTextColor, SEVERITY_COLORS } from "./charts";

describe("chartTextColor", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--t2");
  });

  it("reads the live --t2 custom property from the document root", () => {
    document.documentElement.style.setProperty("--t2", "#123456");
    expect(chartTextColor()).toBe("#123456");
  });

  it("falls back to a default when --t2 isn't set", () => {
    document.documentElement.style.removeProperty("--t2");
    expect(chartTextColor()).toBe("#9498A3");
  });
});

describe("SEVERITY_COLORS", () => {
  it("defines a color for every severity level", () => {
    expect(Object.keys(SEVERITY_COLORS).sort()).toEqual(
      ["CRITICAL", "HIGH", "INFO", "LOW", "MEDIUM"].sort(),
    );
  });

  it("uses the shared danger/warn tokens for CRITICAL/HIGH, not a separate palette", () => {
    expect(SEVERITY_COLORS.CRITICAL.toUpperCase()).toBe("#EF4444");
    expect(SEVERITY_COLORS.HIGH.toUpperCase()).toBe("#F59E0B");
  });
});
