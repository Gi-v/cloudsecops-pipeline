import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties } from "react";
import AnimatedNumber from "./AnimatedNumber";
import MagicCard from "./MagicCard";

/** Gradient-filled sparkline with a glowing endpoint dot. Renders real
 * historical `data` when given one (e.g. resources-scanned per past scan);
 * falls back to a flat mid-line when there isn't enough history yet rather
 * than inventing a shape, so an empty series doesn't masquerade as data. */
function Sparkline({ data, color = "var(--brand)" }: { data: number[]; color?: string }) {
  // A fixed internal coordinate system, scaled to the card's actual content
  // width by width="100%" + preserveAspectRatio="none" below — so the same
  // viewBox math works whether it's rendered in a narrow KPI tile or a
  // wider one, instead of a hardcoded pixel width that only ever fit one
  // card size.
  const w = 100;
  const h = 22;
  const gradientId = `spark-grad-${color.replace(/[^a-z0-9]/gi, "")}`;

  if (data.length < 2) {
    return (
      <svg width="100%" height={h} className="kpi-sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <line x1="0" y1={h - 2} x2={w} y2={h - 2} stroke="var(--b3)" strokeWidth="1.5" strokeDasharray="2 3" />
      </svg>
    );
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const coords = data.map((v, i) => [(i / (data.length - 1)) * w, h - 2 - ((v - min) / span) * (h - 4)]);
  const linePoints = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const areaPoints = `0,${h} ${linePoints} ${w},${h}`;
  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <svg width="100%" height={h} className="kpi-sparkline" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradientId})`} />
      <polyline
        points={linePoints}
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} style={{ color }} className="kpi-sparkline-dot" />
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
  sparklineData,
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
  /** Real historical series (e.g. resources scanned per past scan, oldest
   * first) rendered as a gradient sparkline — omit entirely when there's no
   * real series to show rather than passing fake placeholder numbers. */
  sparklineData?: number[];
}) {
  const accentStyle = color ? ({ "--kpi-accent": color } as CSSProperties) : undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
    >
      <MagicCard
        className="kpi-card"
        style={accentStyle}
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
        {/* Its own row below the value, not squeezed beside it or
            absolute-positioned over it — a real 4-digit value at 44px
            already fills most of a narrow 1fr KPI column, so a 72px-wide
            sparkline only has room as a full-width strip underneath. */}
        {sparklineData && <Sparkline data={sparklineData} color={color} />}
      </MagicCard>
    </motion.div>
  );
}
