import { SEVERITY_COLORS } from "./charts";

const LABELS: Record<string, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  INFO: "Info",
};

export default function SeverityList({
  breakdown,
  labels,
  activeIndex,
  onHoverIndex,
}: {
  breakdown: Record<string, number>;
  labels: string[];
  activeIndex: number | null;
  onHoverIndex: (index: number | null) => void;
}) {
  const total = labels.reduce((sum, l) => sum + (breakdown[l] ?? 0), 0) || 1;
  const max = Math.max(...labels.map((l) => breakdown[l] ?? 0), 1);

  return (
    <div className="severity-list">
      {labels.map((l, i) => {
        const value = breakdown[l] ?? 0;
        const color = SEVERITY_COLORS[l] || "var(--t2)";
        const dimmed = activeIndex !== null && activeIndex !== i;
        return (
          <div
            key={l}
            className="severity-row"
            style={{ opacity: dimmed ? 0.5 : 1, transition: "opacity 150ms" }}
            onMouseEnter={() => onHoverIndex(i)}
            onMouseLeave={() => onHoverIndex(null)}
          >
            <span className="severity-name">{LABELS[l] ?? l}</span>
            <span className="severity-bar-track">
              <span
                className="severity-bar-fill"
                style={{ width: `${(value / max) * 100}%`, background: color }}
              />
            </span>
            <span>
              <span className="severity-count">{value}</span>
              <span className="severity-pct">{Math.round((value / total) * 100)}%</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
