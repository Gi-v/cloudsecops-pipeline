# CloudSecOps Pipeline — Architecture

Hareem Ahmad · ArZens Security Engineering Internship

## 1. Problem

Manual cloud security audits don't scale: an engineer walking through the AWS/GCP/Azure
consoles, screenshotting configs, and cross-referencing them against CIS/NIST/ISO 27001
checklists by hand takes hours per pass and days to get feedback on. This project replaces
that loop with an event-driven pipeline that continuously collects cloud resource state,
evaluates it against policy-as-code, and produces a tamper-evident audit trail.

## 2. System Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│ Cloud         │     │ Kafka         │     │ Policy Engine     │
│ Collectors    │────▶│ findings.raw  │────▶│ (OPA / Rego)      │
│ AWS/GCP/Azure │     └──────────────┘     └──────────────────┘
└──────────────┘                                    │
                                                      ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│ React         │◀────│ Kafka         │◀────│ Evaluation result │
│ Dashboard     │ WS  │ findings.     │     │ + violations      │
│ (live)        │     │ enriched      │     └──────────────────┘
└──────────────┘     └──────────────┘               │
       ▲                                             ▼
       │              ┌──────────────┐     ┌──────────────────┐
       └──────────────│ FastAPI       │◀────│ Evidence Store    │
                       │ REST + WS API │     │ Postgres + MinIO  │
                       └──────────────┘     │ SHA-256 hash chain│
                                             └──────────────────┘
```

Six independently deployable services communicate exclusively through Kafka topics or the
REST/WebSocket API — no service calls another service's internals directly. This is the
architectural decision the ADR panel on the portfolio site documents as ADR-001.

## 3. Services

| Service | Responsibility | Tech |
|---|---|---|
| **Collectors** | Enumerate cloud resources (EC2, S3, IAM, KMS, GCE, GCS, Azure VMs/Storage) and publish raw inventory | Python 3.13, asyncio, boto3/google-cloud/azure-sdk (or simulated) |
| **Policy Engine** | Evaluate every resource against Rego policies (CIS, NIST CSF 2.0, ISO 27001) | Open Policy Agent, Rego |
| **Evidence Store** | Persist every finding with a SHA-256 hash chain for tamper-evident audit history | MinIO (S3-compatible blobs) + Postgres (metadata/index) |
| **API** | REST endpoints + WebSocket live feed, rate-limited scan triggers | FastAPI, SQLAlchemy (async), aiokafka, Redis (via `slowapi`) |
| **Dashboard** | Real-time compliance visualization + historical trend/risk analytics | React 19, TypeScript, Vite |
| **CI/CD** | Lint, test, scan-the-scanner, build, deploy | GitHub Actions, conftest, Helm |

## 4. Data Flow

1. **Collection.** Each collector runs on a schedule (or on-demand via `POST /api/scan`),
   fans out concurrently across resource types using `asyncio.TaskGroup`, and publishes one
   message per resource to `findings.raw`.
2. **Evaluation.** The policy engine consumer reads `findings.raw`, calls OPA's REST API
   (`POST /v1/data/cloudsecops/evaluate`) with the resource as input, and receives back a
   list of violated rules with severity, framework mapping, and remediation text.
3. **Enrichment.** Evaluated findings (violations + passing controls) are published to
   `findings.enriched` and simultaneously written to Postgres + archived to MinIO.
4. **Evidence chaining.** Each evidence blob's SHA-256 hash includes the previous record's
   hash, forming an append-only chain per resource. Altering historical evidence breaks the
   chain — verifiable during `GET /api/evidence/{resource_id}/verify`.
5. **Live delivery.** The API's WebSocket endpoint (`/ws/live`) subscribes to
   `findings.enriched` and pushes new findings to connected dashboard clients with no
   polling.
6. **Critical alerting.** Every `findings.enriched` message is also scanned for CRITICAL
   violations; each one is published to `alerts.critical` and delivered by a separate
   consumer via a generic JSON webhook (Slack/Discord-incoming-webhook compatible), or
   just logged structurally if no webhook is configured. This is a second, independent
   consumer group on the same topic as the dashboard broadcaster — proof in practice of
   ADR-001's claim that Kafka lets new consumers attach without touching producers.
7. **Trend & risk analytics.** Every scan's findings stay tied to it via `correlation_id`,
   so `GET /api/metrics/trend` replays the same severity-weighted score the dashboard's
   headline number uses, once per historical scan — a compliance-over-time chart computed
   from data the pipeline was already writing, not a new table. Each trend point also
   carries a distinct-resource count for that scan (`COUNT(DISTINCT resource_id)` grouped by
   `correlation_id`), so the dashboard's "Resources Scanned" tile can plot a real sparkline
   instead of decorative placeholder numbers. `GET /api/metrics/top-resources` ranks
   resources by that same weighting applied to their open findings, surfacing which one to
   fix first instead of just a flat violation count.

## 5. Why These Choices (ADRs)

Full ADRs live in [`docs/adr/`](docs/adr). Summary:

- **ADR-001 — Kafka as the event backbone.** Six collectors and one policy engine would
  otherwise require N×M point-to-point integrations. A topic-based pub/sub layer means a
  new collector ships by adding a producer; nothing else changes.
- **ADR-002 — OPA/Rego for policy-as-code.** Compliance rules change independently of
  application code. Rego policies are hot-reloaded by OPA from the `policies/` directory —
  no backend redeploy needed to ship a new control.
- **ADR-003 — MinIO + SHA-256 for evidence.** Audit evidence must be provably unaltered.
  Content-addressed storage with a hash chain makes tampering detectable, not just
  policy-forbidden.
- **ADR-004 — asyncio for collection.** Sequential per-resource API calls made a full scan
  take ~42s. `asyncio.TaskGroup` batching brought that to ~4s.

## 6. Repository Layout

```
intern/
├── backend/             FastAPI service — collectors, Kafka clients, evidence store, REST/WS API
│   ├── app/
│   │   ├── api/routes/      REST endpoints (scan, findings, resources, policies, evidence, metrics, health)
│   │   ├── collectors/      AWS / GCP / Azure resource collectors (simulate or live mode)
│   │   ├── kafka/           Producer/consumer wrappers + topic definitions
│   │   ├── policy_engine/   OPA HTTP client + local Python fallback + evaluation orchestration
│   │   ├── evidence/        MinIO archival + SHA-256 hash-chain store
│   │   ├── alerting/        Critical-finding webhook/log delivery (alerts.critical consumer)
│   │   ├── db/              SQLAlchemy models, async session, init SQL
│   │   ├── schemas/         Pydantic request/response models
│   │   ├── websocket/       Live findings feed (WS)
│   │   └── core/            Settings, logging, request-ID middleware, rate limiting, API-key auth
│   ├── alembic/             DB migrations, wired to the app's own Settings.database_url
│   └── tests/               pytest — 41 tests, all runnable with zero external services
├── policies/             Rego policy source, organized by framework
│   ├── cis/ nist/ iso27001/
│   └── tests/            opa test / conftest policy unit tests
├── frontend/             React + TypeScript dashboard (Vite) — dark UI with gradient/glow
│                         accents (ambient background, card glow, per-page colors) layered
│                         over the same severity/compliance color semantics used everywhere
│   ├── src/
│   │   ├── components/       Sidebar, CommandPalette, SearchInput, charts, TrendChart, TopRiskResources, skeletons, empty states
│   │   ├── context/           Shared WebSocket connection (LiveFeedContext)
│   │   ├── hooks/              useDashboardPolling, useFindingsQuery, useAsync, useAnimatedNumber
│   │   ├── lib/                 confetti — a tasteful, reduced-motion-aware celebration fired
│   │   │                        only when a user-triggered scan actually improves the score
│   │   └── pages/               Dashboard, Findings, Resources, Policy Simulator, Evidence Chain
│   ├── nginx.conf            SPA static-file config for the production Docker image
│   └── Dockerfile            multi-stage: dev (vite --host) / build / prod (nginx)
├── infra/
│   ├── k8s/               Helm chart for production deployment
│   └── github-actions/    CI/CD workflow (mirrored to .github/workflows/ci.yml)
├── docs/adr/              Architecture Decision Records
├── portfolio/             Standalone marketing/portfolio single-page site (index.html)
├── Makefile               make up / test / lint / migrate / seed
└── docker-compose.yml    Full local stack: Kafka, OPA, Postgres, MinIO, Redis, API, dashboard
```

## 7. Running Locally

```bash
cp .env.example .env
docker compose up --build
```

- Dashboard: http://localhost:5173
- API docs (Swagger): http://localhost:8000/docs
- OPA console: http://localhost:8181
- MinIO console: http://localhost:9001

See [`backend/README.md`](backend/README.md) and [`frontend/README.md`](frontend/README.md)
for service-specific development instructions without Docker.

## 8. Observability

- Every HTTP response carries `X-Request-ID`; the FastAPI app binds it into structlog's
  contextvars for the request's lifetime, so every log line — including ones emitted deep
  inside the evaluator or evidence store — carries the same ID without threading it
  through every function signature.
- `GET /metrics` exposes Prometheus-format request count/latency histograms per route.
- Every consumer callback logs structurally on both success and failure paths; a failed
  evaluation rolls back its DB session and logs the exception rather than crashing the
  consumer loop, so one bad message doesn't take down the pipeline.

## 9. Security Notes

- Collectors default to `COLLECTOR_MODE=simulate` and require no real cloud credentials —
  they generate a realistic, deterministic synthetic resource inventory so the whole
  pipeline is runnable and demoable without any cloud account. Set `COLLECTOR_MODE=live`
  and supply credentials in `.env` to point at a real AWS/GCP/Azure account.
- The backend's own container image and Helm chart are scanned in CI (Trivy for the image,
  Checkov for the Kubernetes manifests — see the `self-scan` job in
  `.github/workflows/ci.yml`) — the tool that audits your infrastructure should not be
  exempt from audit. This uses dedicated IaC scanners rather than the OPA policy engine
  itself, since the Rego policies in `policies/` are written against the collectors'
  resource-document shape (cloud API responses), not against Dockerfiles or Helm templates.
- Mutating endpoints (scan trigger, finding status changes) support an optional API-key
  gate (`API_AUTH_ENABLED` + `API_KEY`, off by default) — see `backend/app/core/auth.py`.
- No secrets are committed. `.env` is gitignored; `.env.example` documents every variable.
