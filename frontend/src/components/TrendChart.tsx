import { Line } from "react-chartjs-2";
import "./charts";
import { chartTextColor, complianceColor, resolveThemeColor } from "./charts";
import EmptyState from "./EmptyState";
import { TrendingUp } from "lucide-react";
import type { ScoreTrendPoint } from "@/types";

function fmtHHMM(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** The dashboard's headline score is one number, right now — this is the
 * same score plotted per scan, so a viewer can tell "we're improving" from
 * "we just got lucky this scan" at a glance. Needs at least two points to
 * mean anything as a trend; one point is just today's score again. */
export default function TrendChart({ points }: { points: ScoreTrendPoint[] }) {
  if (points.length < 2) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="Not enough scan history yet"
        subtitle="Run a couple more scans to see the trend."
      />
    );
  }

  const latest = points[points.length - 1].security_score;
  const lineColor = resolveThemeColor(complianceColor(latest));
  const textColor = chartTextColor();

  return (
    <div style={{ height: 180 }}>
      <Line
        data={{
          labels: points.map((p) => fmtHHMM(p.completed_at)),
          datasets: [
            {
              label: "Security score",
              data: points.map((p) => p.security_score),
              borderColor: lineColor,
              backgroundColor: `${lineColor}22`,
              pointBackgroundColor: lineColor,
              pointRadius: 3,
              pointHoverRadius: 5,
              borderWidth: 2,
              fill: true,
              tension: 0.3,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `Score ${ctx.parsed.y} · scan #${ctx.dataIndex + 1}`,
              },
            },
          },
          scales: {
            x: { ticks: { color: textColor, maxRotation: 0 }, grid: { display: false } },
            y: {
              min: 0,
              max: 100,
              ticks: { color: textColor, stepSize: 25 },
              grid: { color: "rgba(122,122,140,0.12)" },
            },
          },
        }}
      />
    </div>
  );
}
