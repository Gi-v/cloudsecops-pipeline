import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("canvas-confetti", () => ({ default: vi.fn() }));

import confetti from "canvas-confetti";
import { celebrateScoreImprovement } from "./confetti";

function mockReducedMotion(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches } as MediaQueryList);
}

describe("celebrateScoreImprovement", () => {
  afterEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error — jsdom doesn't define this by default; restore that.
    delete window.matchMedia;
  });

  it("fires confetti when motion isn't reduced", () => {
    mockReducedMotion(false);
    celebrateScoreImprovement();
    expect(confetti).toHaveBeenCalledTimes(1);
  });

  it("stays quiet under prefers-reduced-motion", () => {
    mockReducedMotion(true);
    celebrateScoreImprovement();
    expect(confetti).not.toHaveBeenCalled();
  });

  it("does not throw when matchMedia is unavailable (jsdom without it)", () => {
    expect(() => celebrateScoreImprovement()).not.toThrow();
  });
});
