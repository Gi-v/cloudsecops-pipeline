import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import MagicCard from "./MagicCard";

export default function ControlsPassingCard({
  passing,
  total,
  index = 0,
}: {
  passing: number;
  total: number;
  index?: number;
}) {
  const [width, setWidth] = useState(0);
  const pct = total > 0 ? (passing / total) * 100 : 0;

  useEffect(() => {
    const t = setTimeout(() => setWidth(pct), 200);
    return () => clearTimeout(t);
  }, [pct]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06 }}
    >
      <MagicCard className="kpi-card">
        <div className="kpi-label">Controls Passing</div>
        <div className="controls-lockup">
          <span style={{ fontSize: 30, fontFamily: "var(--mono)", fontWeight: 400, color: "var(--success)" }}>
            {passing}
          </span>
          <span style={{ fontSize: 20, color: "var(--t3)", fontWeight: 300 }}>/</span>
          <span style={{ fontSize: 20, fontFamily: "var(--mono)", fontWeight: 300, color: "var(--t2)" }}>{total}</span>
        </div>
        <div
          style={{
            height: 2,
            background: "var(--b1)",
            borderRadius: 1,
            marginTop: 10,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              background: "var(--success)",
              borderRadius: 1,
              width: `${width}%`,
              transition: "width 900ms var(--ease)",
            }}
          />
        </div>
      </MagicCard>
    </motion.div>
  );
}
