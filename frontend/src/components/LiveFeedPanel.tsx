import { motion } from "framer-motion";
import { Radio, Wifi, WifiOff } from "lucide-react";
import BorderBeam from "./BorderBeam";
import { useLiveFeedContext } from "@/context/LiveFeedContext";
import EmptyState from "./EmptyState";
import type { PolicyViolation } from "@/types";

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const SEVERITY_COLOR_VAR: Record<string, string> = {
  CRITICAL: "var(--danger)",
  HIGH: "var(--warn)",
  MEDIUM: "var(--medium)",
  LOW: "var(--success)",
};

function worstSeverity(violations: PolicyViolation[]): string {
  if (violations.length === 0) return "LOW";
  return violations.reduce((worst, v) => (SEVERITY_RANK[v.severity] > SEVERITY_RANK[worst] ? v.severity : worst), violations[0].severity);
}

function fmtHHMM(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function fmtFull(ts: number) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

export default function LiveFeedPanel() {
  const { messages, connected } = useLiveFeedContext();

  return (
    <div className="glass" style={{ padding: 20 }}>
      <BorderBeam active={connected} />
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <div className="chart-label" style={{ margin: 0 }}>
          <Radio size={14} /> Live Findings Feed
        </div>
        <span className="connection-pill">
          {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span className={`connection-dot${connected ? " connected" : ""}`} />
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>

      {messages.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No live findings yet"
          subtitle="Trigger a scan to see events stream in here in real time."
        />
      ) : (
        <div style={{ maxHeight: 320, overflowY: "auto" }}>
          {
            // No AnimatePresence — its exit-completion tracking doesn't
            // resolve on this project's framer-motion + React 19 +
            // react-router-dom v7 combination (see App.tsx). That's
            // especially costly on a live-updating list like this one: an
            // `exit`-animated row that never actually unmounts would pile
            // up invisible DOM nodes for as long as the feed keeps
            // receiving events. Plain rendering removes a dropped row
            // immediately once it falls out of `messages`; each new row
            // still animates in via its own `initial`/`animate`.
            messages.map((item) => {
              const { data } = item.message;
              const severity = worstSeverity(data.violations);
              const color = SEVERITY_COLOR_VAR[severity];
              const desc =
                data.violations.length > 0
                  ? `${data.violations.length} violation(s) — ${data.violations[0].title}`
                  : "All controls passing";
              // A new CRITICAL/HIGH entry gets a one-time "new alert" flash
              // layered on top of the framer-managed enter transition —
              // since item.id is a stable key, React only mounts this once
              // per real entry, so the animation string being identical
              // across re-renders means it never re-fires on unrelated
              // state updates (e.g. a sibling row arriving).
              const flash = ["CRITICAL", "HIGH"].includes(severity)
                ? ", cs-row-flash 1200ms 220ms ease-out forwards"
                : "";
              return (
                <motion.div
                  key={item.id}
                  className="live-feed-item"
                  style={{ boxShadow: `inset 3px 0 0 ${color}`, animation: `cs-fade-in 1ms${flash}` }}
                  initial={{ opacity: 0, y: -4, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 40 }}
                  transition={{ duration: 0.18 }}
                >
                  <span className="live-feed-tooltip">{fmtFull(item.receivedAt)}</span>
                  <span style={{ color: "var(--t3)", flexShrink: 0 }}>{fmtHHMM(item.receivedAt)}</span>
                  <span style={{ color, fontWeight: 500, flexShrink: 0, width: 62 }}>{severity}</span>
                  <span className="live-feed-desc" style={{ color: "var(--t1)" }} title={data.resource_urn}>
                    {desc}
                  </span>
                  <span style={{ color: "var(--t3)", marginLeft: "auto", flexShrink: 0 }}>{data.provider}</span>
                </motion.div>
              );
            })
          }
        </div>
      )}
    </div>
  );
}
