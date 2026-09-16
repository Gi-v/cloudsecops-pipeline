import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { endpoints } from "@/api/client";
import { tokenize } from "./JsonEditor";
import type { EvidenceRecord, EvidenceVerifyResult } from "@/types";

/** A faster path than navigating to /evidence?urn=... — fetches the same
 * real data (endpoints.listEvidence/verifyEvidence) that the Evidence
 * Chain page uses, rendered inline as read-only syntax-highlighted JSON. */
export default function EvidenceDrawer({ urn, onClose }: { urn: string; onClose: () => void }) {
  const [records, setRecords] = useState<EvidenceRecord[] | null>(null);
  const [verify, setVerify] = useState<EvidenceVerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  function requestClose() {
    setClosing(true);
    setTimeout(onClose, 220);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([endpoints.listEvidence(urn), endpoints.verifyEvidence(urn)])
      .then(([recs, ver]) => {
        if (cancelled) return;
        setRecords(recs.data);
        setVerify(ver.data);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load evidence for this resource.");
      });
    return () => {
      cancelled = true;
    };
  }, [urn]);

  return (
    <>
      <div
        className="evidence-drawer-backdrop"
        onClick={requestClose}
        style={{ animation: closing ? "cs-fade-in 150ms ease reverse forwards" : "cs-fade-in 200ms ease" }}
      />
      <div
        className="evidence-drawer"
        style={{ animation: closing ? "cs-drawer-exit 220ms ease-in forwards" : "cs-drawer-enter 280ms cubic-bezier(0.16,1,0.3,1) forwards" }}
      >
        <div className="evidence-drawer-header">
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--t1)" }}>Evidence</span>
          <button className="icon-btn" onClick={requestClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>
        <div className="evidence-drawer-body" style={{ animation: "cs-fade-in 150ms ease 200ms both" }}>
          <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--t3)", marginBottom: 12, wordBreak: "break-all" }}>
            {urn}
          </div>
          {error && <p style={{ color: "var(--danger)", fontSize: 12 }}>{error}</p>}
          {verify && typeof verify.valid === "boolean" && (
            <div
              className={`verify-result ${verify.valid ? "valid" : "invalid"}`}
              style={{ fontSize: 12, padding: "10px 12px" }}
            >
              {verify.message}
            </div>
          )}
          {records === null && !error ? (
            <p style={{ fontSize: 12, color: "var(--t3)" }}>Loading…</p>
          ) : records && records.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--t3)" }}>No evidence recorded for this resource yet.</p>
          ) : records ? (
            <pre
              style={{
                fontFamily: "var(--mono)",
                fontSize: 11.5,
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
              }}
            >
              {tokenize(JSON.stringify(records, null, 2)).map((t, i) => (
                <span key={i} className={t.className}>
                  {t.text}
                </span>
              ))}
            </pre>
          ) : null}
        </div>
      </div>
    </>
  );
}
