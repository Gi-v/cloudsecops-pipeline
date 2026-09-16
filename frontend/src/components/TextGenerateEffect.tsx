import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useMemo } from "react";

/** Word-by-word blur+fade text reveal — adapted from Aceternity UI's
 * Text Generate Effect (https://ui.aceternity.com/components/text-generate-effect),
 * one of their most-copied components: each word animates in individually
 * via `filter: blur(Npx) → blur(0)` alongside opacity, staggered through a
 * parent variant rather than manual per-word delay math. Reserved for page
 * titles — a handful of words, once per page load — since `filter: blur()`
 * doesn't composite as cheaply as transform/opacity and isn't worth the
 * cost on anything that repeats or runs on long text. */
export default function TextGenerateEffect({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const words = useMemo(() => text.split(" "), [text]);
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <span className={className}>{text}</span>;
  }

  const container: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
  };
  const word: Variants = {
    hidden: { opacity: 0, filter: "blur(9px)", y: 4 },
    visible: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" },
    },
  };

  return (
    <motion.span
      className={className}
      variants={container}
      initial="hidden"
      animate="visible"
      style={{ display: "inline-block" }}
    >
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          variants={word}
          style={{
            display: "inline-block",
            willChange: "filter, opacity, transform",
            // A trailing text-space *inside* an inline-block box sits right
            // at the edge of that box's own content — which browsers trim
            // as if it were trailing whitespace on a line, even though the
            // space genuinely exists in the DOM (this rendered
            // "ComplianceDashboard" with the words fused together, no gap,
            // even though textContent read out correctly with a space).
            // A real margin can't be collapsed away like that.
            marginRight: i < words.length - 1 ? "0.25em" : 0,
          }}
        >
          {w}
        </motion.span>
      ))}
    </motion.span>
  );
}
