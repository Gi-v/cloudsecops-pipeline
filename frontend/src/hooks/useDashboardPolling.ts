import { useCallback, useEffect, useRef, useState } from "react";
import { endpoints } from "@/api/client";
import type { CISFamilyCompliance, DashboardMetrics, ScoreTrendPoint, TopRiskResource } from "@/types";

const POLL_INTERVAL_MS = 10000;

/** Polls dashboard metrics + CIS family compliance + score trend + top-risk
 * resources every 10s, skipping the state update (and therefore every
 * downstream chart/KPI re-render) when the payload is byte-for-byte
 * identical to last time — extracted from DashboardPage.tsx, see that
 * file's history for why this dedupe exists: without it, Chart.js rebuilds
 * its whole dataset on every poll tick even when nothing changed, which
 * reads as constant low-level jank. */
export function useDashboardPolling() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [families, setFamilies] = useState<CISFamilyCompliance[]>([]);
  const [trend, setTrend] = useState<ScoreTrendPoint[]>([]);
  const [topRisk, setTopRisk] = useState<TopRiskResource[]>([]);
  const [loading, setLoading] = useState(true);
  const lastPayload = useRef<string>("");

  const refresh = useCallback(async () => {
    try {
      const [m, f, t, r] = await Promise.all([
        endpoints.getDashboardMetrics(),
        endpoints.getCisFamilies(),
        endpoints.getScoreTrend(),
        endpoints.getTopRiskResources(),
      ]);
      const serialized = JSON.stringify({ m: m.data, f: f.data, t: t.data, r: r.data });
      if (serialized !== lastPayload.current) {
        lastPayload.current = serialized;
        setMetrics(m.data);
        setFamilies(f.data);
        setTrend(t.data);
        setTopRisk(r.data);
      }
    } catch {
      // backend not reachable yet — surfaced via empty states in the page
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { metrics, families, trend, topRisk, loading, refresh };
}
