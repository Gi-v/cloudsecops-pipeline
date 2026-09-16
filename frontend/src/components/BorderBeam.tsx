import { motion } from "framer-motion";
import type { CSSProperties } from "react";

/** A small gradient dot that travels around a container's border, adapted
 * from Magic UI's BorderBeam
 * (https://magicui.design/docs/components/border-beam) — same technique:
 * a square div animated along `offsetPath: rect(...)` via its
 * `offsetDistance`, masked so it only ever shows a thin strip at the very
 * edge. Used here as a literal signal, not decoration: it only renders
 * while `active` is true, so a beam circling the Live Findings panel means
 * exactly what it looks like — this panel has a live connection right now. */
export default function BorderBeam({
  active = true,
  size = 60,
  duration = 5,
  colorFrom = "#22C55E",
  colorTo = "#82E6AC",
}: {
  active?: boolean;
  size?: number;
  duration?: number;
  colorFrom?: string;
  colorTo?: string;
}) {
  if (!active) return null;

  return (
    <div className="border-beam-mask" aria-hidden="true">
      <motion.div
        className="border-beam-dot"
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            background: `linear-gradient(90deg, transparent, ${colorFrom}, ${colorTo}, transparent)`,
          } as CSSProperties
        }
        initial={{ offsetDistance: "0%" }}
        animate={{ offsetDistance: "100%" }}
        transition={{ repeat: Infinity, ease: "linear", duration }}
      />
    </div>
  );
}
