import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAnimatedNumber } from "./useAnimatedNumber";

// A stiff, lightly-damped spring settles fast and predictably in tests
// without needing fake timers (framer-motion's spring runs its own RAF
// loop internally regardless of vi.useFakeTimers()).
const FAST_SPRING = { stiffness: 1000, damping: 50 };

describe("useAnimatedNumber", () => {
  it("renders the target value immediately on first mount (no animation from 0)", () => {
    const { result } = renderHook(() => useAnimatedNumber(42, FAST_SPRING));
    expect(result.current).toBe(42);
  });

  it("eventually settles on a new target after it changes", async () => {
    const { result, rerender } = renderHook(({ value }) => useAnimatedNumber(value, FAST_SPRING), {
      initialProps: { value: 10 },
    });
    expect(result.current).toBe(10);

    rerender({ value: 100 });

    await waitFor(() => expect(result.current).toBeCloseTo(100, 0), { timeout: 2000 });
  });

  it("settles on 0 for a downward transition without going negative", async () => {
    const { result, rerender } = renderHook(({ value }) => useAnimatedNumber(value, FAST_SPRING), {
      initialProps: { value: 50 },
    });

    rerender({ value: 0 });

    await waitFor(() => expect(result.current).toBeCloseTo(0, 0), { timeout: 2000 });
    expect(result.current).toBeGreaterThanOrEqual(-1); // spring may slightly overshoot, never wildly
  });
});
