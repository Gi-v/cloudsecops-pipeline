import { Doughnut } from "react-chartjs-2";
import "./charts";
import { SEVERITY_COLORS } from "./charts";
import EmptyState from "./EmptyState";
import { PieChart } from "lucide-react";

export default function SeverityDoughnut({
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
  const data = labels.map((l) => breakdown[l] ?? 0);

  if (labels.length === 0) {
    return <EmptyState icon={PieChart} title="No findings yet" subtitle="Run a scan first." />;
  }

  const baseColors = labels.map((l) => SEVERITY_COLORS[l] || "#7A7A8C");
  // Dim peers to 0.4 opacity when a row/sector is hovered — the donut is a
  // supporting visual now, not the centerpiece, so the highlight lives
  // mostly in the list; this keeps the two in sync.
  const colors = baseColors.map((c, i) =>
    activeIndex === null || activeIndex === i ? c : `${c}66`,
  );

  return (
    <div className="severity-donut-wrap">
      <Doughnut
        data={{
          labels,
          datasets: [
            {
              data,
              backgroundColor: colors,
              borderWidth: 0,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          onHover: (_event, elements) => {
            onHoverIndex(elements.length > 0 ? elements[0].index : null);
          },
        }}
      />
    </div>
  );
}
