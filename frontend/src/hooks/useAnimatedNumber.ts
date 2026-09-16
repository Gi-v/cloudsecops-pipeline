import { useEffect, useState } from "react";
import { useMotionValue, useSpring } from "framer-motion";

/** Eases a displayed number toward `target` using a physics spring (same
 * technique as Magic UI's NumberTicker: useMotionValue + useSpring, with the
 * spring driving state on every tick) rather than a hand-rolled
 * requestAnimationFrame loop — no manual clock math, so there's no class of
 * bug where two different time sources (rAF's timestamp vs performance.now())
 * silently disagree. Damping/stiffness tuned for a quick, slightly bouncy
 * settle rather than a linear count.
 *
 * useMotionValue(target) already initializes at the target value, so the
 * mount-time `motionValue.set(target)` below is a no-op (no change event,
 * nothing animates) — the spring only actually moves when `target` changes
 * on a later render. */
export function useAnimatedNumber(
  target: number,
  springConfig?: { damping?: number; stiffness?: number },
): number {
  const motionValue = useMotionValue(target);
  const springValue = useSpring(motionValue, { damping: 30, stiffness: 100, ...springConfig });
  const [display, setDisplay] = useState(target);

  useEffect(() => {
    motionValue.set(target);
  }, [target, motionValue]);

  useEffect(() => springValue.on("change", (latest) => setDisplay(latest)), [springValue]);

  return display;
}
