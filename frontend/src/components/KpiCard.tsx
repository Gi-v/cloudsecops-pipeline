import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import AnimatedNumber from "./AnimatedNumber";
import MagicCard from "./MagicCard";

const SPARK_POINTS = [38, 52, 44, 61, 56, 68, 65, 72];

function Sparkline() {
  const w = 64;
  const h = 20;
  const points = SPARK_POINTS.map((v, i) => `${(i / (SPARK_POINTS.length - 1)) * w},${h - (v / 100) * h}`).join(" ");
  return (
    <svg width={w} height={h} className="kpi-sparkline" viewBox={`0 0 ${w} ${h}`}>
      <polyline points={points} fill="none" stroke="var(--b3)" strokeWidth="1.5" />
    </svg>
  );
}

export default function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  suffix = "",
  index = 0,
  pulseDot = false,
  footerNote,
  sparkline = false,
}: {
  label: string;
  value: number;
  icon?: LucideIcon;
  color?: string;
  suffix?: string;
  index?: number;
  /** Small pulsing dot next to the number — a real status signal
   * (currently-open critical count), not decoration. */
  pulseDot?: boolean;
  /** Small muted note pinned to the card's bottom-right corner. */
  footerNote?: string;
  /** Barely-visible sparkline pinned to the card's bottom-right corner —
   * texture, not data. */
  sparkline?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
    >
      <MagicCard
        className="kpi-card"
        gradientColor={color ? `color-mix(in srgb, ${color} 45%, transparent)` : undefined}
      >
        {Icon && (
          <div className="kpi-card-icon" style={{ color }}>
            <Icon size={18} strokeWidth={1.75} />
          </div>
        )}
        <div className="kpi-label">{label}</div>
        <div className="kpi-accessory-row">
          <div className="kpi-value" style={color ? { color } : undefined}>
            <AnimatedNumber value={value} suffix={suffix} />
          </div>
          {pulseDot && <span className="kpi-pulse-dot" style={{ background: color }} />}
        </div>
        {footerNote && (
          <div className="kpi-footer-note" style={{ color }}>
            {footerNote}
          </div>
        )}
        {sparkline && <Sparkline />}
      </MagicCard>
    </motion.div>
  );
}
