import { BarChart3 } from "lucide-react";
import { useMemo } from "react";
import type { CSSProperties } from "react";
import { Bar, Line } from "react-chartjs-2";
import { endpoints } from "@/api/client";
import { SEVERITY_COLORS, chartTextColor } from "@/components/charts";
import { ChartSkeleton } from "@/components/Skeleton";
import EmptyState from "@/components/EmptyState";
import TextGenerateEffect from "@/components/TextGenerateEffect";
import TrendChart from "@/components/TrendChart";
import { useAsync } from "@/hooks/useAsync";
import type { ScoreTrendPoint } from "@/types";

const PROVIDER_COLORS: Record<string, string> = {
  AWS: "#F59E0B",
  GCP: "#4285F4",
  AZURE: "#00A4EF",
};

interface ProviderTrendPoint {
  correlation_id: string;
  provider: string | null;
  completed_at: string | null;
  security_score: number;
}

function ProviderTrendChart({ points }: { points: ProviderTrendPoint[] }) {
  const byProvider = useMemo(() => {
    const grouped: Record<string, ProviderTrendPoint[]> = {};
    for (const p of points) {
      if (!p.provider) continue;
      (grouped[p.provider] ??= []).push(p);
    }
    return grouped;
  }, [points]);

  const providers = Object.keys(byProvider);
  if (providers.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No per-provider scan history yet"
        subtitle="Run a scan against a specific provider (not all-providers) to see this comparison."
      />
    );
  }

  const maxLen = Math.max(...providers.map((p) => byProvider[p].length));
  const textColor = chartTextColor();

  return (
    <div style={{ height: 220 }}>
      <Line
        data={{
          labels: Array.from({ length: maxLen }, (_, i) => `Scan ${i + 1}`),
          datasets: providers.map((provider) => ({
            label: provider,
            data: byProvider[provider].map((p) => p.security_score),
            borderColor: PROVIDER_COLORS[provider] ?? "#5b6af0",
            backgroundColor: "transparent",
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 2,
            tension: 0.3,
          })),
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: "top", labels: { color: textColor, boxWidth: 10, font: { size: 11 } } },
          },
          scales: {
            x: { ticks: { color: textColor, maxRotation: 0 }, grid: { display: false } },
            y: { min: 0, max: 100, ticks: { color: textColor, stepSize: 25 }, grid: { color: "rgba(122,122,140,0.12)" } },
          },
        }}
      />
    </div>
  );
}

interface TimelinePoint {
  date: string;
  severities: Record<string, number>;
}

const TIMELINE_SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

function FindingsTimelineChart({ points }: { points: TimelinePoint[] }) {
  if (points.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No findings yet"
        subtitle="Run a scan to start building history for this chart."
      />
    );
  }
  const textColor = chartTextColor();

  return (
    <div style={{ height: 220 }}>
      <Bar
        data={{
          labels: points.map((p) => p.date.slice(5)),
          datasets: TIMELINE_SEVERITIES.map((sev) => ({
            label: sev,
            data: points.map((p) => p.severities[sev] ?? 0),
            backgroundColor: SEVERITY_COLORS[sev],
          })),
        }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: true, position: "top", labels: { color: textColor, boxWidth: 10, font: { size: 11 } } },
          },
          scales: {
            x: { stacked: true, ticks: { color: textColor, maxRotation: 0 }, grid: { display: false } },
            y: { stacked: true, ticks: { color: textColor }, grid: { color: "rgba(122,122,140,0.12)" } },
          },
        }}
      />
    </div>
  );
}

export default function AnalyticsPage() {
  const trend = useAsync<ScoreTrendPoint[]>(() => endpoints.getScoreTrend(60).then((r) => r.data), []);
  const byProvider = useAsync<ProviderTrendPoint[]>(
    () => endpoints.getTrendByProvider(60).then((r) => r.data),
    [],
  );
  const timeline = useAsync<TimelinePoint[]>(
    () => endpoints.getFindingsTimeline(30).then((r) => r.data),
    [],
  );

  return (
    <div>
      <div className="page-header">
        <div className="page-title-row">
          <span className="page-title-icon" style={{ "--page-accent": "var(--brand)" } as CSSProperties}>
            <BarChart3 size={18} />
          </span>
          <div>
            <h1 className="page-title">
              <TextGenerateEffect text="Analytics" />
            </h1>
            <p className="page-sub">Longer-range trends, computed from every scan's own history.</p>
          </div>
        </div>
      </div>

      <div className="glass" style={{ padding: 20, marginBottom: 20 }}>
        <div className="chart-label">Security Score — last 60 scans</div>
        {trend.loading ? <ChartSkeleton /> : <TrendChart points={trend.data ?? []} />}
      </div>

      <div className="analytics-grid">
        <div className="glass" style={{ padding: 20 }}>
          <div className="chart-label">Score by Provider</div>
          {byProvider.loading ? <ChartSkeleton /> : <ProviderTrendChart points={byProvider.data ?? []} />}
        </div>
        <div className="glass" style={{ padding: 20 }}>
          <div className="chart-label">Findings Timeline — last 30 days</div>
          {timeline.loading ? <ChartSkeleton /> : <FindingsTimelineChart points={timeline.data ?? []} />}
        </div>
      </div>
    </div>
  );
}
