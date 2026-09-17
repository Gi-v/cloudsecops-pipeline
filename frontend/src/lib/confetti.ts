import confetti from "canvas-confetti";

/** A short, tasteful confetti burst — reserved for a genuine milestone (the
 * security score improved into the "good" band on a scan the user just
 * triggered themselves), never fired from a routine background poll. Skips
 * entirely under prefers-reduced-motion since it conveys no information a
 * screen reader or a still frame would miss, only delight. */
export function celebrateScoreImprovement() {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;

  confetti({
    particleCount: 90,
    spread: 75,
    startVelocity: 38,
    origin: { x: 0.5, y: 0.25 },
    colors: ["#5b6af0", "#9b6bf5", "#1db954"],
    disableForReducedMotion: true,
  });
}
