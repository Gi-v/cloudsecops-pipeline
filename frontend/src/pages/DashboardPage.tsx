import { motion } from "framer-motion";
import { AlertOctagon, BarChart3, LayoutDashboard, Server, TrendingUp } from "lucide-react";
import { ChartSkeleton, KpiSkeleton } from "@/components/Skeleton";
import { complianceColor } from "@/components/charts";
import ControlsPassingCard from "@/components/ControlsPassingCard";
import EmptyState from "@/components/EmptyState";
import FrameworkRankedList from "@/components/FrameworkRankedList";
import KpiCard from "@/components/KpiCard";
import LiveFeedPanel from "@/components/LiveFeedPanel";
import MagicCard from "@/components/MagicCard";
import ScanButton from "@/components/ScanButton";
import SecurityScoreCard from "@/components/SecurityScoreCard";
import SeverityPanel from "@/components/SeverityPanel";
import TextGenerateEffect from "@/components/TextGenerateEffect";
import TopRiskResources from "@/components/TopRiskResources";
import TrendChart from "@/components/TrendChart";
import { useDashboardPolling } from "@/hooks/useDashboardPolling";

export default function DashboardPage() {
  const { metrics, families, trend, topRisk, loading, refresh } = useDashboardPolling();

  return (
    <div>
      <div className="page-header">
        <div className="page-title-row">
          <span className="page-title-icon">
            <LayoutDashboard size={18} />
          </span>
          <div>
            <h1 className="page-title">
              <TextGenerateEffect text="Compliance Dashboard" />
            </h1>
            <p className="page-sub-mono">AWS · GCP · Azure</p>
          </div>
        </div>
        <ScanButton onDone={refresh} />
      </div>

      <div className="kpi-row">
        {loading ? (
          <>
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
            <KpiSkeleton />
          </>
        ) : (
          <>
            <SecurityScoreCard
              score={metrics?.security_score ?? 0}
              controlsPassing={metrics?.controls_passing ?? 0}
              controlsTotal={metrics?.controls_total ?? 0}
              criticalFindings={metrics?.critical_findings ?? 0}
              resourcesScanned={metrics?.resources_scanned ?? 0}
            />
            <KpiCard
              index={1}
              label="Critical Findings"
              value={metrics?.critical_findings ?? 0}
              icon={AlertOctagon}
              color="var(--danger)"
              pulseDot
            />
            <ControlsPassingCard
              index={2}
              passing={metrics?.controls_passing ?? 0}
              total={metrics?.controls_total ?? 0}
            />
            <KpiCard
              index={3}
              label="Resources Scanned"
              value={metrics?.resources_scanned ?? 0}
              icon={Server}
              color="var(--t2)"
              sparkline
            />
          </>
        )}
      </div>

      <div className="charts-row">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <MagicCard className="chart-card">
            <div className="chart-label">
              <BarChart3 size={13} /> Finding Severity Distribution
            </div>
            {loading ? <ChartSkeleton /> : <SeverityPanel breakdown={metrics?.severity_breakdown ?? {}} />}
          </MagicCard>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.06 }}
        >
          <MagicCard className="chart-card">
            <div className="chart-label">
              <BarChart3 size={13} /> Framework Coverage
            </div>
            {loading ? <ChartSkeleton /> : <FrameworkRankedList coverage={metrics?.framework_coverage ?? {}} />}
          </MagicCard>
        </motion.div>
      </div>

      <motion.div
        style={{ marginBottom: 24 }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <MagicCard style={{ padding: "20px 24px" }}>
          <div className="chart-label">
            <BarChart3 size={13} /> CIS Benchmark v2 — Control Family Compliance
          </div>
          {families.length === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="No CIS findings yet"
              subtitle="Run a scan to populate control-family compliance."
            />
          ) : (
            families.map((f, i) => {
              const color = complianceColor(f.percent);
              return (
                <motion.div
                  key={f.family}
                  className="cis-row"
                  style={{ boxShadow: `inset 4px 0 0 ${color}` }}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.05 }}
                >
                  <span className="cis-label">{f.family}</span>
                  <div className="cis-bar-track">
                    <motion.div
                      className="cis-bar-fill"
                      style={{ background: color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${f.percent}%` }}
                      transition={{ duration: 0.6, delay: i * 0.05 + 0.1, ease: "easeOut" }}
                    />
                  </div>
                  <span className="cis-pct" style={{ color }}>
                    {f.percent}%
                  </span>
                </motion.div>
              );
            })
          )}
        </MagicCard>
      </motion.div>

      <div className="charts-row">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
        >
          <MagicCard className="chart-card">
            <div className="chart-label">
              <TrendingUp size={13} /> Security Score Trend
            </div>
            {loading ? <ChartSkeleton /> : <TrendChart points={trend} />}
          </MagicCard>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
        >
          <MagicCard className="chart-card">
            <div className="chart-label">
              <AlertOctagon size={13} /> Top Risk Resources
            </div>
            {loading ? <ChartSkeleton /> : <TopRiskResources resources={topRisk} />}
          </MagicCard>
        </motion.div>
      </div>

      <LiveFeedPanel />
    </div>
  );
}
