import { motion } from "framer-motion";
import {
  FileSearch,
  LayoutDashboard,
  type LucideIcon,
  RefreshCw,
  Search,
  ServerCog,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { endpoints } from "@/api/client";
import type { Finding, Resource } from "@/types";

interface StaticCommand {
  kind: "static";
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}
interface FindingResult {
  kind: "finding";
  id: string;
  finding: Finding;
  run: () => void;
}
interface ResourceResult {
  kind: "resource";
  id: string;
  resource: Resource;
  run: () => void;
}
type ResultItem = StaticCommand | FindingResult | ResourceResult;

const SEARCH_DEBOUNCE_MS = 180;

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [findingResults, setFindingResults] = useState<Finding[]>([]);
  const [resourceResults, setResourceResults] = useState<Resource[]>([]);
  const navigate = useNavigate();

  const staticCommands = useMemo<StaticCommand[]>(
    () => [
      { kind: "static", id: "dashboard", label: "Go to Dashboard", icon: LayoutDashboard, run: () => navigate("/") },
      { kind: "static", id: "findings", label: "Go to Findings", icon: ShieldCheck, run: () => navigate("/findings") },
      { kind: "static", id: "resources", label: "Go to Resources", icon: ServerCog, run: () => navigate("/resources") },
      { kind: "static", id: "policies", label: "Go to Policy Simulator", icon: FileSearch, run: () => navigate("/policies") },
      { kind: "static", id: "evidence", label: "Go to Evidence Chain", icon: FileSearch, run: () => navigate("/evidence") },
      {
        kind: "static",
        id: "scan",
        label: "Run a full scan",
        hint: "AWS + GCP + Azure",
        icon: RefreshCw,
        run: () => {
          toast.promise(endpoints.triggerScan(), {
            loading: "Scanning cloud resources…",
            success: (res) => `Scanned ${res.data.resources_scanned} resources in ${res.data.duration_ms}ms`,
            error: "Scan failed — is the backend running?",
          });
        },
      },
    ],
    [navigate],
  );

  const filteredStatic = useMemo(
    () => staticCommands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase())),
    [staticCommands, query],
  );

  // Debounced live search across findings/resources — reuses the same
  // endpoints Findings/Resources pages already call, so results here match
  // exactly what typing the same query into either page's own search box
  // would surface. Skipped entirely when the query is empty so the palette
  // doesn't fire two network calls on every open.
  useEffect(() => {
    if (!query.trim()) {
      setFindingResults([]);
      setResourceResults([]);
      return;
    }
    const timer = setTimeout(() => {
      endpoints
        .listFindings({ search: query, limit: 5 })
        .then((r) => setFindingResults(r.data))
        .catch(() => setFindingResults([]));
      endpoints
        .listResources({ search: query, limit: 5 })
        .then((r) => setResourceResults(r.data))
        .catch(() => setResourceResults([]));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useMemo<ResultItem[]>(() => {
    const findingItems: FindingResult[] = findingResults.map((f) => ({
      kind: "finding",
      id: `finding-${f.id}`,
      finding: f,
      run: () => navigate(`/findings?search=${encodeURIComponent(f.control_id)}`),
    }));
    const resourceItems: ResourceResult[] = resourceResults.map((r) => ({
      kind: "resource",
      id: `resource-${r.id}`,
      resource: r,
      run: () => navigate(`/resources?search=${encodeURIComponent(r.resource_urn)}`),
    }));
    return [...filteredStatic, ...findingItems, ...resourceItems];
  }, [filteredStatic, findingResults, resourceResults, navigate]);

  useEffect(() => setActiveIdx(0), [query, open]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function runResult(item: ResultItem) {
    item.run();
    setOpen(false);
    setQuery("");
  }

  function handleListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIdx]) {
      runResult(results[activeIdx]);
    }
  }

  // No AnimatePresence — its exit-completion tracking doesn't resolve on
  // this project's framer-motion + React 19 + react-router-dom v7
  // combination (see App.tsx). That matters a lot more here than elsewhere:
  // an `exit`-animated backdrop that never actually unmounts is a
  // full-viewport, invisible (opacity 0) `<div>` left sitting over the
  // entire app, silently eating every click after the palette is closed
  // once. Plain conditional rendering removes it immediately on close.
  return (
    <>
      {open && (
        <>
          <motion.div
            className="cmdk-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            className="cmdk-box"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.18 }}
          >
            <div className="cmdk-input-row">
              <Search size={15} />
              <input
                autoFocus
                placeholder="Jump to a page, run a command, or search findings/resources…"
                aria-label="Jump to a page, run a command, or search findings/resources"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleListKeyDown}
              />
              <kbd>ESC</kbd>
            </div>
            <div className="cmdk-list">
              {results.length === 0 ? (
                <div className="cmdk-empty">No matching commands or results.</div>
              ) : (
                results.map((item, i) => (
                  <div
                    key={item.id}
                    className={`cmdk-item${i === activeIdx ? " active" : ""}`}
                    onMouseEnter={() => setActiveIdx(i)}
                    onClick={() => runResult(item)}
                  >
                    {item.kind === "static" && (
                      <>
                        <item.icon size={15} />
                        <span style={{ flex: 1 }}>{item.label}</span>
                        {item.hint && <span style={{ fontSize: 11, color: "var(--t3)" }}>{item.hint}</span>}
                      </>
                    )}
                    {item.kind === "finding" && (
                      <>
                        <ShieldCheck size={15} />
                        <span style={{ flex: 1 }}>{item.finding.control_id} — {item.finding.title}</span>
                        <span style={{ fontSize: 11, color: "var(--t3)" }}>{item.finding.severity}</span>
                      </>
                    )}
                    {item.kind === "resource" && (
                      <>
                        <ServerCog size={15} />
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.resource.resource_urn}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--t3)" }}>{item.resource.provider}</span>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </>
  );
}
