import { motion } from "framer-motion";
import { ChevronDown, FileSearch, Play, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { endpoints } from "@/api/client";
import EmptyState from "@/components/EmptyState";
import JsonEditor from "@/components/JsonEditor";
import TextGenerateEffect from "@/components/TextGenerateEffect";
import { useAsync } from "@/hooks/useAsync";
import type { PolicyControl, PolicyEvalResult } from "@/types";

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "var(--danger)",
  HIGH: "var(--warn)",
  MEDIUM: "var(--medium)",
  LOW: "var(--success)",
  INFO: "var(--success)",
};

export default function PolicySimulatorPage() {
  const { data: controls = [] } = useAsync<PolicyControl[]>(
    () => endpoints.listPolicies().then((r) => r.data),
    [],
  );
  const { data: samples = {} } = useAsync<Record<string, unknown>>(
    () => endpoints.listSampleResources().then((r) => r.data),
    [],
  );

  const [input, setInput] = useState("");
  const [loadedFirstSample, setLoadedFirstSample] = useState(false);
  useEffect(() => {
    if (loadedFirstSample) return;
    const first = Object.values(samples)[0];
    if (!first) return;
    setInput(JSON.stringify(first, null, 2));
    setLoadedFirstSample(true);
  }, [samples, loadedFirstSample]);

  const [result, setResult] = useState<PolicyEvalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [sampleMenuOpen, setSampleMenuOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");

  async function evaluate() {
    setError(null);
    setEvaluating(true);
    try {
      const resource = JSON.parse(input);
      const { data } = await endpoints.evaluatePolicy(resource);
      setResult(data);
      if (data.violations.length > 0) {
        toast.warning(`${data.violations.length} violation(s) found`);
      } else {
        toast.success("All controls passing");
      }
    } catch (e) {
      const msg =
        e instanceof SyntaxError
          ? "Invalid JSON — check syntax."
          : "Evaluation failed — is the backend running?";
      setError(msg);
      setResult(null);
      toast.error(msg);
    } finally {
      setEvaluating(false);
    }
  }

  function loadSample(key: string) {
    const sample = samples[key];
    if (sample) setInput(JSON.stringify(sample, null, 2));
    setSampleMenuOpen(false);
  }

  const filteredControls = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return controls;
    return controls.filter(
      (c) =>
        c.control_id.toLowerCase().includes(q) ||
        c.framework.toLowerCase().includes(q) ||
        c.resource_type.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q),
    );
  }, [controls, catalogSearch]);

  return (
    <div>
      <div className="page-header">
        <div className="page-title-row">
          <span className="page-title-icon">
            <FileSearch size={18} />
          </span>
          <div>
            <h1 className="page-title">
              <TextGenerateEffect text="Policy Simulator" />
            </h1>
            <p className="page-sub">Paste a resource document and evaluate it against active Rego policies.</p>
          </div>
        </div>
      </div>

      <div className="policy-grid">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="glass" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 420 }}>
            <div
              style={{
                height: 40,
                padding: "0 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--line)",
                position: "relative",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--t2)" }}>Resource JSON</span>
              <div style={{ position: "relative" }}>
                <button
                  onClick={() => setSampleMenuOpen((o) => !o)}
                  style={{
                    fontSize: 11,
                    color: "var(--t2)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-sm)",
                    padding: "4px 10px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  Load Sample <ChevronDown size={12} />
                </button>
                {sampleMenuOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      right: 0,
                      background: "var(--surface-active)",
                      border: "1px solid var(--line-focus)",
                      borderRadius: "var(--radius-sm)",
                      zIndex: 30,
                      minWidth: 180,
                      overflow: "hidden",
                      transformOrigin: "top right",
                      animation: "cs-scale-in 150ms ease-out",
                    }}
                  >
                    {Object.keys(samples).map((k) => (
                      <div
                        key={k}
                        onClick={() => loadSample(k)}
                        style={{
                          height: 32,
                          padding: "0 12px",
                          display: "flex",
                          alignItems: "center",
                          fontSize: 12,
                          color: "var(--t2)",
                          fontFamily: "var(--mono)",
                          cursor: "pointer",
                          transition: "background 80ms ease, color 80ms ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "var(--t1)";
                          e.currentTarget.style.background = "var(--s5)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "var(--t2)";
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        {k}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <JsonEditor value={input} onChange={setInput} />
            <div
              style={{
                height: 48,
                padding: "0 16px",
                display: "flex",
                alignItems: "center",
                borderTop: "1px solid var(--line)",
              }}
            >
              <button
                className="btn"
                style={{ background: "var(--brand)", color: "#fff", borderColor: "var(--brand)" }}
                onClick={evaluate}
                disabled={evaluating}
              >
                <Play size={13} /> {evaluating ? "Evaluating…" : "Evaluate"}
              </button>
              {error && <p style={{ color: "var(--danger)", fontSize: 12, marginLeft: 12 }}>{error}</p>}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.06 }}
        >
          <div className="glass" style={{ display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 420 }}>
            <div
              style={{
                height: 40,
                padding: "0 16px",
                display: "flex",
                alignItems: "center",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--t2)" }}>Evaluation Results</span>
            </div>

            {
              // No AnimatePresence here — its exit-completion tracking
              // never resolves on this project's framer-motion + React 19 +
              // react-router-dom v7 combination (reproduced on both
              // framer-motion 12.43.0 and 13.4.0): a `motion.div`'s exit
              // animation visually finishes but AnimatePresence never
              // unmounts it or mounts the next child, so this panel got
              // stuck on "Evaluating…" forever after the first real
              // evaluation. Plain conditional rendering swaps panels
              // immediately (ordinary React unmount/mount, unrelated to
              // AnimatePresence) and each new panel still fades in via its
              // own enter-only `initial`/`animate` — it just no longer
              // waits on an exit fade that wasn't completing anyway.
              evaluating ? (
                <motion.div
                  key="evaluating"
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    position: "relative",
                    overflow: "hidden",
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {/* A left-to-right shimmer suggesting evaluation is scanning
                      through controls — the result rows below later enter
                      from the same direction (cs-result-enter), echoing it. */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(90deg, var(--s2) 25%, var(--s3) 50%, var(--s2) 75%)",
                      backgroundSize: "400px 100%",
                      animation: "cs-shimmer 1s ease infinite",
                    }}
                  />
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      border: "2px solid var(--line-strong)",
                      borderTopColor: "var(--t1)",
                      animation: "cs-spin 0.5s linear infinite",
                      position: "relative",
                    }}
                  />
                  <span style={{ fontSize: 13, color: "var(--t2)", position: "relative" }}>Evaluating…</span>
                </motion.div>
              ) : !result ? (
                <motion.div key="empty" style={{ flex: 1, display: "flex" }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <EmptyState
                    icon={FileSearch}
                    title="No evaluation yet"
                    subtitle="Evaluate a resource to see violations and passing controls."
                    variant="policy"
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="result"
                  style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div style={{ padding: "10px 16px", display: "flex", gap: 16, borderBottom: "1px solid var(--line)" }}>
                    <span style={{ fontSize: 12, fontFamily: "var(--mono)", color: "var(--danger)" }}>
                      {result.violations.length} violations
                    </span>
                    <span style={{ fontSize: 12, fontFamily: "var(--mono)", color: "var(--success)" }}>
                      {result.passed_controls.length} passing
                    </span>
                    <span style={{ fontSize: 11, color: "var(--t3)", marginLeft: "auto" }}>
                      {result.violations.length + result.passed_controls.length} controls evaluated
                    </span>
                  </div>
                  <div style={{ flex: 1, overflowY: "auto" }}>
                    {result.violations.map((v, i) => (
                      <motion.div
                        key={v.control_id}
                        style={{
                          padding: "10px 16px",
                          borderBottom: "1px solid var(--line)",
                          boxShadow: `inset 3px 0 0 ${SEVERITY_COLOR[v.severity] ?? "var(--danger)"}`,
                        }}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06, duration: 0.18 }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--t2)" }}>{v.control_id}</span>
                          <span style={{ fontSize: 10, fontFamily: "var(--mono)", fontWeight: 500, color: "var(--danger)" }}>
                            VIOLATION
                          </span>
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--t1)", marginTop: 4 }}>{v.title}</div>
                        <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 2 }}>{v.description}</div>
                      </motion.div>
                    ))}
                    {result.passed_controls.map((c, i) => (
                      <motion.div
                        key={c}
                        style={{
                          padding: "10px 16px",
                          borderBottom: "1px solid var(--line)",
                          boxShadow: "inset 3px 0 0 var(--success)",
                        }}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: (result.violations.length + i) * 0.06, duration: 0.18 }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--t2)" }}>{c}</span>
                          <span style={{ fontSize: 10, fontFamily: "var(--mono)", fontWeight: 500, color: "var(--success)" }}>
                            PASSING
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )
            }
          </div>
        </motion.div>
      </div>

      <div className="glass" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--t2)" }}>
            Active Control Catalog <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--t3)" }}>({controls.length})</span>
          </span>
          <div style={{ position: "relative", width: 160 }}>
            <Search size={13} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--t3)" }} />
            <input
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              placeholder="Filter controls…"
              style={{
                width: "100%",
                height: 28,
                background: "var(--surface-2)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-sm)",
                padding: "0 8px 0 26px",
                fontSize: 12,
                color: "var(--t1)",
                fontFamily: "var(--sans)",
              }}
            />
          </div>
        </div>
        <div className="table-wrap" style={{ maxHeight: 280, overflowY: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Control</th>
                <th>Framework</th>
                <th>Resource type</th>
                <th>Title</th>
              </tr>
            </thead>
            <tbody>
              {filteredControls.map((c) => (
                <tr key={c.control_id}>
                  <td style={{ color: "var(--brand)" }}>{c.control_id}</td>
                  <td style={{ color: "var(--t3)" }}>{c.framework}</td>
                  <td style={{ color: "var(--t2)" }}>{c.resource_type}</td>
                  <td style={{ fontFamily: "var(--sans)", color: "var(--t1)" }}>{c.title}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
