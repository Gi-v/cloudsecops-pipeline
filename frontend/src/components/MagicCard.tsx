import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import type { CSSProperties, PointerEvent, ReactNode } from "react";
import { useCallback } from "react";

/** A glass card whose border traces a soft gradient that follows the
 * cursor — adapted from Magic UI's MagicCard
 * (https://magicui.design/docs/components/magic-card), which layers two
 * backgrounds (a solid padding-box fill + a radial-gradient border-box
 * ring) and drives the gradient's center with framer-motion's
 * useMotionValue/useMotionTemplate instead of React state, so the cursor
 * position never triggers a re-render — only a CSS custom property update.
 *
 * Reworked here onto this app's own design tokens (var(--surface),
 * var(--glass-b)) instead of Tailwind's bg-background/border-border, and
 * simplified to the single "gradient border" mode (Magic UI's "orb" mode
 * fits a marketing hero better than a data-dense dashboard).
 */
export default function MagicCard({
  children,
  className,
  style,
  gradientSize = 220,
  gradientColor = "rgba(240, 240, 240, 0.06)",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  gradientSize?: number;
  gradientColor?: string;
  onClick?: () => void;
}) {
  const mouseX = useMotionValue(-gradientSize);
  const mouseY = useMotionValue(-gradientSize);

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
    },
    [mouseX, mouseY],
  );

  const handlePointerLeave = useCallback(() => {
    mouseX.set(-gradientSize);
    mouseY.set(-gradientSize);
  }, [mouseX, mouseY, gradientSize]);

  const borderBackground = useMotionTemplate`
    linear-gradient(var(--surface), var(--surface)) padding-box,
    radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
      var(--line-focus), var(--glass-b) 100%
    ) border-box
  `;

  const glowBackground = useMotionTemplate`
    radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
      ${gradientColor}, transparent 100%
    )
  `;

  return (
    <motion.div
      className={`magic-card${className ? ` ${className}` : ""}`}
      style={{ background: borderBackground, ...style }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={onClick}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.15 }}
    >
      <motion.div className="magic-card-glow" style={{ background: glowBackground }} />
      <div className="magic-card-content">{children}</div>
    </motion.div>
  );
}
