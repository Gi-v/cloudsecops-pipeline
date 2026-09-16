import { Check, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { endpoints } from "@/api/client";
import type { CloudProvider } from "@/types";

type ScanState = "idle" | "scanning" | "done";

export default function ScanButton({
  provider,
  onDone,
}: {
  provider?: CloudProvider;
  onDone?: () => void;
}) {
  const [state, setState] = useState<ScanState>("idle");
  const [showRipple, setShowRipple] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  async function run() {
    if (state !== "idle") return;
    setState("scanning");
    // Tactile click confirmation — a single ripple that plays once and
    // self-removes, independent of how long the real scan takes.
    setShowRipple(true);
    timers.current.push(setTimeout(() => setShowRipple(false), 600));
    // toast.promise(p, opts) returns a toast ID, not a Promise tied to p's
    // outcome — only calling .unwrap() on it would give a Promise that
    // actually settles with p. Awaiting the call directly (as an earlier
    // version of this did) resolves immediately regardless of success or
    // failure, so onDone used to fire unconditionally ~900ms after every
    // click, even after a failed or rate-limited scan. Awaiting the
    // original promise separately — while still handing it to
    // toast.promise for the loading/success/error UI — fixes that: onDone
    // now only fires once the scan actually succeeded.
    const scanPromise = endpoints.triggerScan(provider);
    toast.promise(scanPromise, {
      loading: `Scanning${provider ? ` ${provider}` : " AWS + GCP + Azure"}…`,
      success: (res) =>
        `Scanned ${res.data.resources_scanned} resource(s) in ${res.data.duration_ms}ms`,
      error: (err) =>
        err?.response?.status === 429
          ? "Rate limited — try again in a moment."
          : "Scan failed — is the backend running?",
    });
    try {
      await scanPromise;
      setState("done");
      // Give the async evaluator a moment to persist findings before refresh.
      timers.current.push(setTimeout(() => onDone?.(), 900));
      timers.current.push(setTimeout(() => setState("idle"), 1600));
    } catch {
      // toast.promise's error callback above already surfaced this.
      setState("idle");
    }
  }

  const label =
    state === "scanning" ? "Scanning…" : state === "done" ? "Scan complete" : `Run Scan${provider ? ` (${provider})` : ""}`;

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      {showRipple && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--brand)",
            animation: "cs-ripple 600ms ease-out forwards",
            pointerEvents: "none",
          }}
        />
      )}
      <button
        className={`btn btn-scan btn-scan-${state}`}
        onClick={run}
        disabled={state === "scanning"}
      >
        {state === "done" ? (
          <Check size={14} style={{ animation: "cs-scale-in 200ms ease-out" }} />
        ) : (
          <RefreshCw size={14} className={state === "scanning" ? "spin" : undefined} />
        )}
        {label}
      </button>
    </div>
  );
}
