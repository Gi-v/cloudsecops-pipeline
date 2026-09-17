import { motion } from "framer-motion";
import { CheckCircle2, FileSearch, Search, XCircle } from "lucide-react";
import { useState } from "react";
import type { CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { endpoints } from "@/api/client";
import EmptyState from "@/components/EmptyState";
import TextGenerateEffect from "@/components/TextGenerateEffect";
import type { EvidenceRecord, EvidenceVerifyResult } from "@/types";

export default function EvidencePage() {
  const [searchParams] = useSearchParams();
  const [urn, setUrn] = useState(searchParams.get("urn") || "");
  const [records, setRecords] = useState<EvidenceRecord[]>([]);
  const [verify, setVerify] = useState<EvidenceVerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup() {
    if (!urn.trim()) return;
    setLoading(true);
    setError(null);
    setVerify(null);
    try {
      const [recs, ver] = await Promise.all([
        endpoints.listEvidence(urn),
        endpoints.verifyEvidence(urn),
      ]);
      setRecords(recs.data);
      setVerify(ver.data);
      if (recs.data.length > 0) {
        toast(ver.data.valid ? "Chain verified — no tampering detected" : "Chain broken!", {
          icon: ver.data.valid ? undefined : "⚠️",
        });
      }
    } catch {
      const msg = "Lookup failed — check the resource URN and that the backend is running.";
      setError(msg);
      setRecords([]);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title-row">
          <span className="page-title-icon" style={{ "--page-accent": "var(--success)" } as CSSProperties}>
            <FileSearch size={18} />
          </span>
          <div>
            <h1 className="page-title">
              <TextGenerateEffect text="Evidence Chain" />
            </h1>
            <p className="page-sub">
              Every evaluated finding for a resource, hash-chained for tamper detection.
            </p>
          </div>
        </div>
      </div>

      <div className="glass" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            className="code-input"
            placeholder="Resource URN, e.g. arn:aws:s3:::prod-data-lake"
            value={urn}
            onChange={(e) => setUrn(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookup()}
          />
          <button className="btn" onClick={lookup} disabled={loading}>
            <Search size={13} /> {loading ? "Looking up…" : "Lookup"}
          </button>
        </div>
        {error && <p style={{ color: "var(--danger)", fontSize: 12, marginTop: 10 }}>{error}</p>}
      </div>

      {verify && (
        <motion.div
          className={`verify-result ${verify.valid ? "valid" : "invalid"}`}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {verify.valid ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {verify.message}
        </motion.div>
      )}

      <div className="glass" style={{ padding: 20 }}>
        <div className="chart-label">
          Chain ({records.length} record{records.length !== 1 ? "s" : ""})
        </div>
        {records.length === 0 ? (
          <EmptyState
            icon={FileSearch}
            title="No evidence to show"
            subtitle="Run a scan, then enter a resource URN above to view its hash chain."
            variant="evidence"
          />
        ) : (
          records.map((r, i) => (
            <motion.div
              key={r.id}
              className="evidence-chain-item"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <span style={{ color: "var(--t3)" }}>#{r.sequence}</span>
              <div style={{ flex: 1 }}>
                <div>{new Date(r.created_at).toLocaleString()}</div>
                <div className="hash-pill">hash: {r.content_hash.slice(0, 16)}…</div>
                <div className="hash-pill">
                  prev: {r.prev_hash ? `${r.prev_hash.slice(0, 16)}…` : "genesis"}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
