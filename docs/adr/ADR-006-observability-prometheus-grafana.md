# ADR-006: Prometheus + Grafana Observability

**Status:** Accepted

## Context

The only instrumentation anywhere in the codebase was one line —
`Instrumentator().instrument(app).expose(app, endpoint="/metrics")` — giving free HTTP
request-rate/latency/size metrics, but nothing scraped `/metrics` and nothing existed to
visualize it. There were zero custom metrics: no way to see scan volume, findings created
by severity, evidence-chain verification activity, or the security score over time except
by polling the dashboard API directly. For a product whose entire premise is "give visibility
into infrastructure security posture," having no operational visibility into its own pipeline
was a real gap.

## Decision

**Custom metrics**, defined once in `app/core/metrics.py` (avoids `prometheus_client`'s
"Duplicated timeseries in CollectorRegistry" error on module re-import during tests) and
incremented from the service layer introduced in ADR-005:
- `scans_triggered_total{provider}` — incremented in `scan_service.run_scan`
- `findings_created_total{severity}` — incremented in `policy_engine/evaluator.py`'s
  `evaluate_and_persist`, once per finding (violation or passing control)
- `evidence_chain_verifications_total{result}` — incremented in `evidence_service.verify_chain`
- `security_score_current` (gauge) — set in `metrics_service.dashboard_metrics` every time the
  dashboard's headline score is recomputed

**Prometheus + Grafana in docker-compose**, both provisioned as code — no manual click-through
setup on first run:
- `prometheus` scrapes `backend:8000/metrics` every 10s (`infra/observability/prometheus.yml`).
- `grafana` auto-configures its Prometheus datasource
  (`infra/observability/grafana/provisioning/datasources/datasource.yml`, fixed
  `uid: prometheus-ds` so dashboard JSON can reference it deterministically) and auto-loads
  one dashboard (`infra/observability/grafana/dashboards/cloudsecops-overview.json`) covering
  HTTP request rate/error-rate/p95 latency by handler, scans triggered, findings by severity,
  the security score over time, and evidence verifications.
- Anonymous viewer access is enabled on the Grafana container (`GF_AUTH_ANONYMOUS_ENABLED=true`)
  — consistent with this project's existing "frictionless demo by default" posture
  (`API_AUTH_ENABLED=false` out of the box) — while `admin`/`admin` still exists for anyone who
  wants to edit a panel.

**Frontend tie-in:** a "Grafana" link in the Sidebar's nav list, opening
`VITE_GRAFANA_URL` in a new tab — shown only when that env var is set, so a deployment without
the observability stack (or one that hasn't set the var) doesn't show a dead link.

## Consequences

**Positive**
- Real operational visibility: request latency/error spikes, scan throughput, and findings
  volume are all visible without touching application code or the database directly.
- Zero manual setup — `docker compose up` produces a fully wired Grafana dashboard, matching
  the project's existing "works the moment you open it" philosophy (the same reasoning behind
  `AUTO_SEED_ON_STARTUP`).
- Metrics are cheap: four counters/one gauge, incremented at points the service layer already
  passes through — no new hot paths, no additional database load.

**Negative**
- Two more containers in local dev (`prometheus`, `grafana`) — a real memory/startup-time cost
  on a laptop already running Kafka+Zookeeper+Postgres+Redis+MinIO+OPA.
- The dashboard JSON is hand-written and will drift from the metrics it queries if a metric
  name or label changes without a corresponding dashboard update — no automated check ties
  them together (a `promtool check rules`-style CI step would close this gap, left as a
  follow-up rather than blocking this pass).
- Anonymous Grafana access is a deliberate demo-only choice — a real deployment with this
  chart (see the Helm work) should disable `GF_AUTH_ANONYMOUS_ENABLED` and set a real admin
  password via a Secret, not the container's hardcoded default.
