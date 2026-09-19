# CloudSecOps Backend

FastAPI service implementing the collect → evaluate → enrich → serve pipeline described in
[`ARCHITECTURE.md`](../ARCHITECTURE.md).

## Quickstart (no Docker)

Every external dependency (Kafka, OPA, MinIO) has a graceful in-process/local-disk fallback,
so the full pipeline runs with just Python:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt

# Postgres is the one hard dependency — either run it via Docker...
docker run -d --name cloudsecops-pg -p 5432:5432 \
  -e POSTGRES_DB=cloudsecops -e POSTGRES_USER=cloudsecops -e POSTGRES_PASSWORD=cloudsecops_dev_password \
  postgres:16-alpine
# ...or point DATABASE_URL at any Postgres instance you already have.

cp ../.env.example ../.env   # edit if your Postgres isn't on localhost:5432

uvicorn app.main:app --reload
```

Then:

- Swagger UI: http://localhost:8000/docs
- Trigger a scan: `POST /api/v1/scan` with `{}` (all providers) or `{"provider": "AWS"}`
- Watch findings land: `GET /api/v1/findings`
- Live feed: connect a WebSocket client to `ws://localhost:8000/ws/live`

Without Kafka/OPA/MinIO running, you'll see log lines like
`kafka_unavailable_using_in_memory_fallback` and `opa_unreachable_using_local_fallback` —
that's expected and the pipeline still functions correctly end-to-end (see
`app/kafka/producer.py`, `app/policy_engine/opa_client.py`, `app/evidence/store.py`).

## Full stack (with Docker)

```bash
cd ..
docker compose up --build
```

This runs real Kafka, OPA (hot-reloading `policies/`), MinIO, Postgres, Redis, and the
backend + frontend together.

## What's in this version

- **Auto-seed on startup** (`AUTO_SEED_ON_STARTUP=true`, default) — the backend runs one
  full scan a couple seconds after boot, so the dashboard has real data the moment you
  open it. Disable for a clean-slate demo.
- **Rate limiting** on `POST /api/v1/scan` (`RATE_LIMIT_SCAN_PER_MINUTE`, default 6/min),
  backed by Redis when reachable, in-memory otherwise (`app/core/rate_limit.py`).
- **CSV export** — `GET /api/v1/findings/export.csv` streams every matching finding
  (respects the same filters as the list endpoint) as an audit-ready CSV, evidence hash
  included per row.
- **Pagination headers** — `GET /api/v1/findings` and `GET /api/v1/resources` return an
  `X-Total-Count` response header alongside the page of results.
- **Global exception handling** — unhandled errors return clean JSON
  (`{"error": "internal_error", "detail": "..."}`) instead of a stack trace; rate-limit
  hits return a structured 429.
- **Alembic migrations** (`alembic/`) — wired to the app's own `Settings.database_url`,
  so migrations and the running app can never point at different databases. Run
  `alembic upgrade head` against a real Postgres instead of relying on
  `init_models()`'s dev-only `create_all`.

## More recent additions

- **Critical alert pipeline** — every evaluation with a CRITICAL violation gets fanned out
  to the `alerts.critical` Kafka topic (previously defined but never consumed) and
  delivered via a generic JSON webhook (`ALERT_WEBHOOK_URL`, Slack/Discord-incoming-webhook
  compatible) — or just logged structurally if no webhook is configured, so alerts are
  never silently dropped. See `app/alerting/notifier.py`.
- **Request tracing** — every response carries `X-Request-ID` (echoed back if the caller
  supplied one), bound into structlog's contextvars so every log line for that request
  — including deep inside the evaluator — carries the same ID. See `app/core/middleware.py`.
- **Prometheus metrics** at `GET /metrics` (request counts/latency histograms per route),
  via `prometheus-fastapi-instrumentator`.
- **Optional API-key auth** on mutating endpoints only (`POST /api/v1/scan`,
  `PATCH /api/v1/findings/*/status`, `PATCH /api/v1/findings/bulk-status`) — off by default
  (`API_AUTH_ENABLED=false`), set it + `API_KEY` for anything resembling a real
  deployment. Read endpoints stay open either way (see `app/core/auth.py` for the
  reasoning). Send the key as `X-API-Key: <key>`.
- **Bulk finding updates** — `PATCH /api/v1/findings/bulk-status` with `{finding_ids, status}`.
- **Free-text search** — `?search=` on `GET /api/v1/findings` (title/control_id/description)
  and `GET /api/v1/resources` (resource URN).
- **Scan history** — `GET /api/v1/scan` lists recent runs (previously only fetchable by
  correlation ID).

## Running tests

```bash
pip install -e ".[dev]"
pytest -v --cov=app
```

Tests cover the pure-Python policy fallback, the evidence hash-chain math, and the
collectors — all runnable with zero external services.

## Project layout

```
app/
├── main.py              FastAPI app, lifespan (Kafka producer/consumer startup), WS route
├── core/                 Settings (pydantic-settings), structured logging
├── api/routes/            scan, resources, findings, policies, evidence, metrics, health
├── collectors/            AWS/GCP/Azure — simulate.py (synthetic data) + live-mode boto3 example
├── kafka/                 Producer/consumer wrappers with in-memory fallback
├── policy_engine/         OPA HTTP client + local pure-Python fallback + evaluator orchestration
├── evidence/              MinIO + SHA-256 hash-chain store with local-disk fallback
├── db/                    SQLAlchemy async models + session
├── schemas/                Pydantic request/response models
└── websocket/              Live findings broadcast to dashboard clients
```

## Adding a collector for a new resource type

1. Add a synthetic generator to `app/collectors/simulate.py` (see the existing
   `gen_aws_*` functions for the shape).
2. Call it from the relevant collector's `_collect_simulated` under the existing
   `asyncio.TaskGroup`.
3. Add matching Rego policies in `../policies/<framework>/` and a Python mirror in
   `app/policy_engine/local_fallback.py`.
4. Add the control to `app/policy_engine/catalog.py` so it shows up in `GET /api/v1/policies`.
