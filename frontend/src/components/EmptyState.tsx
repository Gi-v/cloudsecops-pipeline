import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";

type Variant = "findings" | "resources" | "policy" | "evidence";

function GhostBody({ variant }: { variant: Variant }) {
  if (variant === "findings") {
    return (
      <>
        <div className="ghost-table">
          <div className="ghost-block ghost-table-row" style={{ width: "100%" }} />
          <div className="ghost-block ghost-table-row" style={{ width: "82%" }} />
          <div className="ghost-block ghost-table-row" style={{ width: "90%" }} />
        </div>
      </>
    );
  }
  if (variant === "resources") {
    return (
      <div className="ghost-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="ghost-block ghost-card" />
        ))}
      </div>
    );
  }
  if (variant === "policy") {
    return (
      <div className="ghost-columns">
        <div className="ghost-block ghost-panel" />
        <div className="ghost-block ghost-panel" />
      </div>
    );
  }
  // evidence
  return (
    <div className="ghost-timeline">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div className="ghost-timeline-node" />
          {i < 3 && <div className="ghost-timeline-line" />}
        </div>
      ))}
    </div>
  );
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  subtitle,
  action,
  variant,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Renders a small ghost preview of the populated layout above the
   * icon/text, so the empty state reads as "filtered/not connected yet"
   * rather than "this feature doesn't exist". Omit for generic panels
   * (dashboard sub-panels, live feed) where a distinct layout isn't worth
   * the extra markup. */
  variant?: Variant;
}) {
  return (
    <motion.div
      className="empty-state"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {variant && <GhostBody variant={variant} />}
      <Icon size={variant ? 22 : 34} strokeWidth={1.5} />
      <div className="empty-state-title">{title}</div>
      {subtitle && <div className="empty-state-sub">{subtitle}</div>}
      {variant === "findings" && (
        <div className="ghost-chips">
          <div className="ghost-block ghost-chip" />
          <div className="ghost-block ghost-chip" />
        </div>
      )}
      {action}
    </motion.div>
  );
}
