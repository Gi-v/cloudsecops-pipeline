import { useEffect, useRef, useState } from "react";
import { complianceColor } from "./charts";
import MagicCard from "./MagicCard";
import type { ScoreTrendPoint } from "@/types";

const R = 36;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** Pure so it's independently testable — no scan yet, under a minute, and
 * the usual minute/hour/day bands. Recomputed on every render rather than
 * memoized so the card's periodic re-render tick (below) actually advances
 * the displayed text instead of freezing at whatever it said on mount. */
export function formatRelativeTime(iso: string | null, now: number = Date.now()): string {
  if (!iso) return "No scans yet";
  const diffMin = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

/** Compares the current critical count against the previous scan in
 * `trend`, so the chip reports a real direction instead of a fixed
 * "↓ Critical" no matter what actually happened. Returns null when there's
 * no prior scan to compare against (mirrors TrendChart's own "need 2+
 * points" rule for the same reason). */
export function criticalDelta(criticalFindings: number, trend: ScoreTrendPoint[]): number | null {
  if (trend.length < 2) return null;
  return criticalFindings - trend[trend.length - 2].critical_findings;
}

/** The dashboard's hero metric — wider than the other 3 KPI cards (see
 * `.kpi-row`'s 1.4fr column), with a 3-row micro-breakdown that turns this
 * card into a summary of the whole dashboard. All values come from the
 * same `metrics`/`trend` the other cards read — nothing here is
 * independently hardcoded. */
export default function SecurityScoreCard({
  score,
  controlsPassing,
  controlsTotal,
  criticalFindings,
  resourcesScanned,
  lastScanAt,
  trend,
}: {
  score: number;
  controlsPassing: number;
  controlsTotal: number;
  criticalFindings: number;
  resourcesScanned: number;
  lastScanAt: string | null;
  trend: ScoreTrendPoint[];
}) {
  const arcRef = useRef<SVGCircleElement>(null);
  const color = complianceColor(score);
  const delta = criticalDelta(criticalFindings, trend);
  // Forces a re-render every 30s purely so formatRelativeTime's own output
  // advances ("2 min ago" -> "3 min ago") without needing a data refetch.
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const el = arcRef.current;
    if (!el) return;
    const offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(100, score)) / 100);
    const t = setTimeout(() => {
      el.style.transition = "stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1), stroke 0.4s ease";
      el.style.strokeDashoffset = String(offset);
    }, 50);
    return () => clearTimeout(t);
  }, [score]);

  return (
    <MagicCard
      className="kpi-card score-card"
      style={{ "--kpi-accent": color } as React.CSSProperties}
      gradientColor={`color-mix(in srgb, ${color} 45%, transparent)`}
    >
      <svg width="88" height="88" viewBox="0 0 88 88" style={{ flexShrink: 0, filter: `drop-shadow(0 0 10px color-mix(in srgb, ${color} 55%, transparent))` }}>
        <circle cx="44" cy="44" r={R} stroke="var(--b2)" strokeWidth="5" fill="none" />
        <circle
          ref={arcRef}
          cx="44"
          cy="44"
          r={R}
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE}
          transform="rotate(-90 44 44)"
        />
        <text x="44" y="48" textAnchor="middle" fontSize="20" fontFamily="var(--mono)" fontWeight={500} fill={color}>
          {Math.round(score)}
        </text>
      </svg>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="score-label-row">
          <span className="score-label">Security Score</span>
          {delta !== null && (
            <span className={`score-chip score-chip-${delta > 0 ? "up" : delta < 0 ? "down" : "flat"}`}>
              {delta > 0 ? `↑ ${delta}` : delta < 0 ? `↓ ${Math.abs(delta)}` : "→"} Critical
            </span>
          )}
        </div>
        <div className="score-meta">Last scan {formatRelativeTime(lastScanAt)}</div>
        <div className="score-micro">
          <div className="score-micro-row">
            <span>Controls passed</span>
            <span>
              {controlsPassing} / {controlsTotal}
            </span>
          </div>
          <div className="score-micro-row">
            <span>Open findings</span>
            <span>{criticalFindings}</span>
          </div>
          <div className="score-micro-row">
            <span>Resources</span>
            <span>{resourcesScanned}</span>
          </div>
        </div>
      </div>
    </MagicCard>
  );
}
