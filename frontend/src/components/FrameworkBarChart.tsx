import { Bar } from "react-chartjs-2";
import "./charts";
import { chartTextColor } from "./charts";
import EmptyState from "./EmptyState";
import { BarChart3 } from "lucide-react";

export default function FrameworkBarChart({
  coverage,
}: {
  coverage: Record<string, number>;
}) {
  const labels = Object.keys(coverage);
  const data = Object.values(coverage);

  if (labels.length === 0) {
    return <EmptyState icon={BarChart3} title="No framework data yet" subtitle="Run a scan first." />;
  }

  const textColor = chartTextColor();

  return (
    <div className="chart-canvas-wrap">
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: "% controls passing",
              data,
              backgroundColor: "#404040",
              hoverBackgroundColor: "#606060",
              borderRadius: 6,
              maxBarThickness: 40,
            },
          ],
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: { color: textColor, font: { size: 10 } },
              grid: { color: "rgba(255,255,255,0.05)" },
            },
            x: {
              ticks: { color: textColor, font: { size: 10 } },
              grid: { display: false },
            },
          },
        }}
      />
    </div>
  );
}
