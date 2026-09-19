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
| **API** | REST endpoints (`/api/v1`) + WebSocket live feed, rate-limited scan triggers, JWT/RBAC auth | FastAPI, SQLAlchemy (async), aiokafka, Redis (via `slowapi`), `pyjwt` |
| **Dashboard** | Real-time compliance visualization + historical trend/risk analytics, login, Admin/Analytics pages | React 19, TypeScript, Vite |
| **Observability** | HTTP + domain metrics, dashboards | `prometheus_client`, Prometheus, Grafana (ADR-006) |
| **CI/CD** | Lint, test, scan-the-scanner, build, deploy | GitHub Actions, conftest, Helm |

## 4. Data Flow

1. **Collection.** Each collector runs on a schedule (or on-demand via `POST /api/v1/scan`,
   which requires an admin principal — either a logged-in admin's JWT or the legacy
   `X-API-Key`, see ADR-007), fans out concurrently across resource types using
   `asyncio.TaskGroup`, and publishes one message per resource to `findings.raw`.
2. **Evaluation.** The policy engine consumer reads `findings.raw`, calls OPA's REST API
   (`POST /v1/data/cloudsecops/evaluate`) with the resource as input, and receives back a
   list of violated rules with severity, framework mapping, and remediation text.
3. **Enrichment.** Evaluated findings (violations + passing controls) are published to
   `findings.enriched` and simultaneously written to Postgres + archived to MinIO.
4. **Evidence chaining.** Each evidence blob's SHA-256 hash includes the previous record's
   hash, forming an append-only chain per resource. Altering historical evidence breaks the
   chain — verifiable during `GET /api/v1/evidence/{resource_id}/verify`.
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
   so `GET /api/v1/metrics/trend` replays the same severity-weighted score the dashboard's
   headline number uses, once per historical scan — a compliance-over-time chart computed
   from data the pipeline was already writing, not a new table. Each trend point also
   carries a distinct-resource count for that scan (`COUNT(DISTINCT resource_id)` grouped by
   `correlation_id`), so the dashboard's "Resources Scanned" tile can plot a real sparkline
   instead of decorative placeholder numbers. `GET /api/v1/metrics/top-resources` ranks
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
- **ADR-005 — service layer + `/api/v1` versioning.** Route handlers had grown real business
  logic inline (query-building, scoring math, the scan pipeline itself), making it
  untestable without an HTTP round-trip and unreachable from the startup auto-seed hook
  except by importing a route module directly. A `services/` layer per domain fixed both;
  versioning came along for the same reason — an API contract with dependents (the frontend,
  eventually external clients) needs room to change without breaking them.
- **ADR-006 — Prometheus + Grafana observability.** The only instrumentation anywhere was
  automatic HTTP metrics with nothing scraping them. Custom counters/gauges on the
  scan/evaluation/evidence paths, plus a fully provisioned (zero-click-through) Grafana
  dashboard, give real operational visibility into the pipeline's own health.
- **ADR-007 — JWT login + RBAC.** A single shared API key had no notion of *who* triggered a
  scan or changed a finding's status, and no way to express "this person can view but not
  mutate." JWT-based login with a viewer/admin role closes that gap while keeping the
  existing API-key path alive for automation with no human logged in.

## 6. Repository Layout

```
intern/
├── backend/             FastAPI service — collectors, Kafka clients, evidence store, REST/WS API
│   ├── app/
│   │   ├── api/routes/      REST endpoints (auth, scan, findings, resources, policies,
│   │   │                    evidence, metrics, health) — thin: parse request, call a
│   │   │                    service, shape the response (ADR-005)
│   │   ├── services/        Business logic per domain (findings, resources, evidence, scan,
│   │   │                    metrics, auth) — the layer routes used to embed inline (ADR-005)
│   │   ├── collectors/      AWS / GCP / Azure resource collectors (simulate or live mode)
│   │   ├── kafka/           Producer/consumer wrappers + topic definitions
│   │   ├── policy_engine/   OPA HTTP client + local Python fallback + evaluation orchestration
│   │   ├── evidence/        MinIO archival + SHA-256 hash-chain store
│   │   ├── alerting/        Critical-finding webhook/log delivery (alerts.critical consumer)
│   │   ├── db/              SQLAlchemy models (incl. User/UserRole), async session, init SQL
│   │   ├── schemas/         Pydantic request/response models, incl. the shared error shape
│   │   ├── websocket/       Live findings feed (WS)
│   │   └── core/            Settings, logging, request-ID + security-headers middleware,
│   │                        rate limiting, JWT/RBAC + hybrid API-key auth (security.py,
│   │                        ADR-007), custom Prometheus metrics (metrics.py, ADR-006),
│   │                        shared error-response helpers (errors.py, ADR-005)
│   ├── alembic/             DB migrations, wired to the app's own Settings.database_url
│   └── tests/               pytest — 124 tests (CI gate: --cov-fail-under=78, see
│                             ci.yml): most need nothing external (mocked DB lifespan,
│                             pure-logic units, mocked httpx for OPA/webhook delivery);
│                             the rest exercise findings/resources/evidence/scan/metrics/
│                             auth+RBAC/the evaluator against a real cloudsecops_test
│                             Postgres database (own db_client/db_session fixtures — see
│                             tests/conftest.py)
├── policies/             Rego policy source, organized by framework
│   ├── cis/ nist/ iso27001/
│   └── tests/            opa test / conftest policy unit tests
├── frontend/             React + TypeScript dashboard (Vite) — dark UI with gradient/glow
│                         accents (ambient background, card glow, per-page colors) layered
│                         over the same severity/compliance color semantics used everywhere
│   ├── src/
│   │   ├── components/       Sidebar, CommandPalette, SearchInput, charts, TrendChart, TopRiskResources, skeletons, empty states
│   │   ├── context/           AuthContext (login/logout/role), shared WebSocket connection (LiveFeedContext)
│   │   ├── hooks/              useDashboardPolling, useFindingsQuery, useAsync, useAnimatedNumber
│   │   ├── lib/                 confetti — a tasteful, reduced-motion-aware celebration fired
│   │   │                        only when a user-triggered scan actually improves the score
│   │   └── pages/               Login, Dashboard, Findings, Resources, Policy Simulator,
│   │                            Evidence Chain, Analytics, Admin (admin-only)
│   ├── nginx.conf            SPA static-file config for the production Docker image
│   └── Dockerfile            multi-stage: dev (vite --host) / build / prod (nginx)
├── infra/
│   ├── k8s/               Self-contained Helm chart — every dependency templated
│   │                      (Postgres, Redis, Kafka+Zookeeper, OPA, MinIO,
│   │                      Prometheus+Grafana); see infra/k8s/README.md
│   ├── observability/     Prometheus scrape config + Grafana provisioning/dashboards
│   │                      for the local docker-compose stack (ADR-006)
│   ├── terraform/         AWS reference module — validated (fmt/validate), never applied
│   └── github-actions/    CI/CD workflow (mirrored to .github/workflows/ci.yml)
├── docs/adr/              Architecture Decision Records
├── portfolio/             Standalone marketing/portfolio single-page site (index.html)
├── Makefile               make up / test / lint / migrate / seed / k8s-up / k8s-down
└── docker-compose.yml    Full local stack: Kafka, OPA, Postgres, MinIO, Redis, Prometheus,
                          Grafana, API, dashboard
```

## 7. Running Locally

```bash
cp .env.example .env
docker compose up --build
```

- Dashboard: http://localhost:5173 (log in as `admin` / `change-me-on-first-login`, seeded on first boot)
- API docs (Swagger): http://localhost:8000/docs
- Grafana: http://localhost:3001 (anonymous viewer access)
- Prometheus: http://localhost:9090
- OPA console: http://localhost:8181
- MinIO console: http://localhost:9001

See [`backend/README.md`](backend/README.md) and [`frontend/README.md`](frontend/README.md)
for service-specific development instructions without Docker.

## 8. Observability

- Every HTTP response carries `X-Request-ID`; the FastAPI app binds it into structlog's
  contextvars for the request's lifetime, so every log line — including ones emitted deep
  inside the evaluator or evidence store — carries the same ID without threading it
  through every function signature. It's also embedded in every error response's
  `{"error": {"request_id": ...}}` field, so a client-reported error and its server-side
  log line are one `grep` apart.
- `GET /metrics` exposes Prometheus-format request count/latency histograms per route
  (via `prometheus-fastapi-instrumentator`), plus custom counters/gauges wired into the
  service layer: `scans_triggered_total{provider}`, `findings_created_total{severity}`,
  `evidence_chain_verifications_total{result}`, and a `security_score_current` gauge
  (ADR-006).
- Prometheus (`docker-compose.yml`'s `prometheus` service) scrapes that endpoint every 10s;
  Grafana auto-provisions its datasource and one dashboard covering all of the above with
  zero manual setup — see `infra/observability/` and the "Grafana" link in the app's own
  Sidebar.
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
- Mutating endpoints (scan trigger, finding status changes) require an admin principal via
  `app/core/security.py`'s hybrid design: either a logged-in admin's JWT (real users, roles
  `viewer`/`admin`, re-checked against the database on every request) or the legacy
  `X-API-Key` (`API_AUTH_ENABLED` + `API_KEY`, off by default — service-account/automation
  use, admin-equivalent). See ADR-007 for why both paths exist rather than one replacing
  the other.
- `POST /api/v1/auth/login` is rate-limited (`RATE_LIMIT_LOGIN_PER_MINUTE`, default
  10/minute) — the one endpoint that accepts a password gets the same brute-force
  protection the scan endpoint already had.
- A default admin account is seeded on first boot if no users exist yet
  (`SEED_ADMIN_USERNAME`/`SEED_ADMIN_PASSWORD`) — change the password immediately in any
  real deployment, exactly like `API_KEY` and `APP_SECRET_KEY` (also the JWT signing
  secret) must be.
- No secrets are committed. `.env` is gitignored; `.env.example` documents every variable.
