import { useState } from "react";
import SeverityDoughnut from "./SeverityDoughnut";
import SeverityList from "./SeverityList";

export default function SeverityPanel({ breakdown }: { breakdown: Record<string, number> }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const labels = Object.keys(breakdown);

  if (labels.length === 0) {
    return <SeverityDoughnut breakdown={breakdown} labels={[]} activeIndex={null} onHoverIndex={() => {}} />;
  }

  return (
    <div className="severity-panel">
      <SeverityDoughnut breakdown={breakdown} labels={labels} activeIndex={activeIndex} onHoverIndex={setActiveIndex} />
      <SeverityList breakdown={breakdown} labels={labels} activeIndex={activeIndex} onHoverIndex={setActiveIndex} />
    </div>
  );
}
