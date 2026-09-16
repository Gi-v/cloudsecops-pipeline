import { useEffect, useRef } from "react";
import MagicCard from "./MagicCard";

const R = 36;
const CIRCUMFERENCE = 2 * Math.PI * R;

/** The dashboard's hero metric — wider than the other 3 KPI cards (see
 * `.kpi-row`'s 1.4fr column), with a 3-row micro-breakdown that turns this
 * card into a summary of the whole dashboard. All values come from the
 * same `metrics` object the other cards read — nothing here is
 * independently hardcoded. */
export default function SecurityScoreCard({
  score,
  controlsPassing,
  controlsTotal,
  criticalFindings,
  resourcesScanned,
}: {
  score: number;
  controlsPassing: number;
  controlsTotal: number;
  criticalFindings: number;
  resourcesScanned: number;
}) {
  const arcRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    const el = arcRef.current;
    if (!el) return;
    const offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(100, score)) / 100);
    const t = setTimeout(() => {
      el.style.transition = "stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1)";
      el.style.strokeDashoffset = String(offset);
    }, 50);
    return () => clearTimeout(t);
  }, [score]);

  return (
    <MagicCard className="kpi-card score-card">
      <div className="score-chip">↓ Critical</div>
      <svg width="88" height="88" viewBox="0 0 88 88" style={{ flexShrink: 0 }}>
        <circle cx="44" cy="44" r={R} stroke="var(--b2)" strokeWidth="5" fill="none" />
        <circle
          ref={arcRef}
          cx="44"
          cy="44"
          r={R}
          stroke="var(--t1)"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE}
          transform="rotate(-90 44 44)"
        />
        <text x="44" y="48" textAnchor="middle" fontSize="20" fontFamily="var(--mono)" fontWeight={400} fill="var(--t1)">
          {Math.round(score)}
        </text>
      </svg>
      <div>
        <div className="score-label">Security Score</div>
        <div className="score-meta">Last scan 4 min ago</div>
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
