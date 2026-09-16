import { AlertOctagon } from "lucide-react";
import EmptyState from "./EmptyState";
import ProviderBadge from "./ProviderBadge";
import SeverityChip from "./SeverityChip";
import type { TopRiskResource } from "@/types";

/** "Which resource should someone fix first" — ranked by severity-weighted
 * open-finding count (see backend/app/api/routes/metrics.py's
 * SEVERITY_WEIGHT), the same weighting the headline score itself uses, so
 * "risky" means the same thing here as it does everywhere else on the
 * dashboard. Reuses the framework-list row layout (rank · name · right-
 * aligned value) rather than inventing a second list style for the same
 * "ranked things" shape. */
export default function TopRiskResources({ resources }: { resources: TopRiskResource[] }) {
  if (resources.length === 0) {
    return (
      <EmptyState
        icon={AlertOctagon}
        title="No open findings"
        subtitle="Every scanned resource is currently clean."
      />
    );
  }

  return (
    <div className="framework-list">
      {resources.map((r, i) => (
        <div key={r.resource_id} className="framework-row">
          <span className="framework-rank">{String(i + 1).padStart(2, "0")}</span>
          <ProviderBadge provider={r.provider} />
          <span
            className="framework-name"
            style={{ fontFamily: "var(--mono)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={r.resource_urn}
          >
            {r.resource_urn}
          </span>
          <div className="framework-right" style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: "var(--t3)", fontFamily: "var(--mono)" }}>
              {r.open_findings} open
            </span>
            <SeverityChip severity={r.worst_severity} />
          </div>
        </div>
      ))}
    </div>
  );
}
