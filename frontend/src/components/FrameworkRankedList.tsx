import { useEffect, useState } from "react";
import EmptyState from "./EmptyState";
import { complianceColor } from "./charts";
import { BarChart3 } from "lucide-react";

/** Ranked list, not a bar chart — communicates each framework's score in
 * about half a second instead of requiring the reader to parse an axis. */
export default function FrameworkRankedList({ coverage }: { coverage: Record<string, number> }) {
  const ranked = Object.entries(coverage)
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);

  const [widths, setWidths] = useState<number[]>(() => ranked.map(() => 0));

  useEffect(() => {
    setWidths(ranked.map(() => 0));
    const timers = ranked.map((r, i) =>
      setTimeout(() => setWidths((w) => { const next = [...w]; next[i] = r.score; return next; }), 100 + i * 80),
    );
    return () => timers.forEach(clearTimeout);
    // Re-run only when the coverage data itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(coverage)]);

  if (ranked.length === 0) {
    return <EmptyState icon={BarChart3} title="No framework data yet" subtitle="Run a scan first." />;
  }

  return (
    <div className="framework-list">
      {ranked.map((r, i) => {
        const color = complianceColor(r.score);
        return (
          <div key={r.name} className="framework-row">
            <span className="framework-rank">{String(i + 1).padStart(2, "0")}</span>
            <span className="framework-name">{r.name}</span>
            <div className="framework-right">
              <span className="framework-score" style={{ color }}>
                {r.score}
              </span>
              <span className="framework-bar-track">
                <span
                  className="framework-bar-fill"
                  style={{ width: `${widths[i] ?? 0}%`, background: color }}
                />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
