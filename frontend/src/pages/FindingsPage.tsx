import { motion } from "framer-motion";
import { CheckSquare, ChevronLeft, ChevronRight, Download, ShieldCheck, Square } from "lucide-react";
import type { CSSProperties } from "react";
import { api } from "@/api/client";
import EmptyState from "@/components/EmptyState";
import ScanButton from "@/components/ScanButton";
import SearchInput from "@/components/SearchInput";
import SeverityChip from "@/components/SeverityChip";
import { TableRowSkeleton } from "@/components/Skeleton";
import TextGenerateEffect from "@/components/TextGenerateEffect";
import { PAGE_SIZE, SEVERITIES, useFindingsQuery } from "@/hooks/useFindingsQuery";
import type { FindingStatus, Severity } from "@/types";

const STATUSES: FindingStatus[] = ["OPEN", "IN_REVIEW", "ASSIGNED", "RESOLVED", "SUPPRESSED"];
// Tab labels read as consistent title case regardless of the underlying
// enum value used for the actual filter/query-param.
const SEVERITY_LABELS: Record<Severity, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
  INFO: "Info",
};

export default function FindingsPage() {
  const {
    findings,
    total,
    loading,
    page,
    setPage,
    severity,
    setSeverity,
    search,
    setSearch,
    selected,
    toggleSelected,
    toggleSelectAll,
    clearSelection,
    bulkBusy,
    applyBulkStatus,
    changeStatus,
    reload,
  } = useFindingsQuery();

  function exportCsv() {
    const params = new URLSearchParams();
    if (severity !== "ALL") params.set("severity", severity);
    if (search) params.set("search", search);
    const qs = params.toString();
    window.open(`${api.defaults.baseURL}/api/findings/export.csv${qs ? `?${qs}` : ""}`, "_blank");
  }

  const allSelected = findings.length > 0 && selected.size === findings.length;

  return (
    <div>
      <div className="page-header">
        <div className="page-title-row">
          <span className="page-title-icon" style={{ "--page-accent": "var(--danger)" } as CSSProperties}>
            <ShieldCheck size={18} />
          </span>
          <div>
            <h1 className="page-title">
              <TextGenerateEffect text="Findings" />
            </h1>
            <p className="page-sub">Every open, resolved, and suppressed policy violation.</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <SearchInput value={search} onSearch={setSearch} placeholder="Search findings…" />
          <button className="btn btn-secondary" onClick={exportCsv}>
            <Download size={14} /> Export CSV
          </button>
          <ScanButton onDone={reload} />
        </div>
      </div>

      <div className="filter-bar">
        <button className={`filter-btn${severity === "ALL" ? " active" : ""}`} onClick={() => setSeverity("ALL")}>
          All Severity
        </button>
        {SEVERITIES.map((s) => (
          <button
            key={s}
            className={`filter-btn${severity === s ? " active" : ""}`}
            onClick={() => setSeverity(s)}
          >
            {SEVERITY_LABELS[s]}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {total > 0 && (
          <span
            style={{
              fontSize: 11,
              color: "var(--t2)",
              fontFamily: "var(--mono)",
              paddingLeft: 12,
              borderLeft: "1px solid var(--line)",
            }}
          >
            {total} total
          </span>
        )}
      </div>

      {
        // No AnimatePresence — its exit-completion tracking doesn't resolve
        // on this project's framer-motion + React 19 + react-router-dom v7
        // combination (see App.tsx), so an `exit`-animated element here
        // would never actually leave the DOM after deselecting. Plain
        // conditional rendering still fades the bar in on select via its
        // own `initial`/`animate`; it just unmounts immediately (no
        // fade-out) on deselect instead of leaking an invisible node.
        selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="glass"
            style={{
              padding: "10px 16px",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 12,
              overflow: "hidden",
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 600 }}>{selected.size} selected</span>
            <button className="filter-btn" disabled={bulkBusy} onClick={() => applyBulkStatus("RESOLVED")}>
              Mark Resolved
            </button>
            <button className="filter-btn" disabled={bulkBusy} onClick={() => applyBulkStatus("SUPPRESSED")}>
              Suppress
            </button>
            <button className="filter-btn" disabled={bulkBusy} onClick={() => applyBulkStatus("IN_REVIEW")}>
              Mark In Review
            </button>
            <button
              style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 12 }}
              onClick={clearSelection}
            >
              Clear
            </button>
          </motion.div>
        )
      }

      <div className="glass table-wrap" style={{ padding: 16 }}>
        {loading ? (
          <table>
            <tbody>
              {Array.from({ length: 6 }).map((_, i) => (
                <TableRowSkeleton key={i} cols={7} />
              ))}
            </tbody>
          </table>
        ) : findings.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No findings match this filter"
            subtitle="Run a scan to generate findings, or clear the severity/search filter."
            variant="findings"
          />
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 32 }}>
                  <button
                    onClick={toggleSelectAll}
                    aria-label="Select all"
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t2)", display: "flex" }}
                  >
                    {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                  </button>
                </th>
                <th>Control</th>
                <th>Framework</th>
                <th>Severity</th>
                <th>Title</th>
                <th>Status</th>
                <th>Evidence</th>
              </tr>
            </thead>
            {/* Keying tbody on the filter itself (not a separate counter)
                remounts it on every filter/search change, which replays
                the fade-in below — a collective fade for the whole set
                rather than a per-row stagger, which is reserved for the
                one-time initial page load. */}
            <tbody key={`${severity}|${search}`} style={{ animation: "cs-fade-in 150ms ease" }}>
              {findings.map((f) => (
                <tr key={f.id} className={selected.has(f.id) ? "row-active" : undefined}>
                  <td>
                    <button
                      onClick={() => toggleSelected(f.id)}
                      aria-label={`Select ${f.control_id}`}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t2)", display: "flex" }}
                    >
                      {selected.has(f.id) ? (
                        <CheckSquare size={15} style={{ animation: "cs-scale-in 150ms ease-out" }} />
                      ) : (
                        <Square size={15} />
                      )}
                    </button>
                  </td>
                  <td style={{ color: "var(--t2)" }}>{f.control_id}</td>
                  <td style={{ color: "var(--t3)" }}>{f.framework}</td>
                  <td>
                    <SeverityChip severity={f.severity} />
                  </td>
                  <td style={{ fontFamily: "var(--sans)", color: "var(--t1)" }}>{f.title}</td>
                  <td>
                    <select
                      className="status-select"
                      value={f.status}
                      onChange={(e) => changeStatus(f.id, e.target.value as FindingStatus)}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ fontSize: 11, color: "var(--t3)", letterSpacing: 0 }}>
                    {f.evidence_hash ? `${f.evidence_hash.slice(0, 8)}…` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {total > PAGE_SIZE && (
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 16, alignItems: "center" }}>
          <button className="icon-btn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            <ChevronLeft size={15} />
          </button>
          <span style={{ fontSize: 12, color: "var(--t2)", fontFamily: "var(--mono)" }}>
            Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
          </span>
          <button
            className="icon-btn"
            disabled={(page + 1) * PAGE_SIZE >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
