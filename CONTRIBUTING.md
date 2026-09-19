# Contributing

## Local setup

```bash
cp .env.example .env
make up          # full stack via Docker
# or, without Docker:
make backend-dev   # in one terminal
make frontend-dev  # in another
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the system design and
[`backend/README.md`](backend/README.md) / [`frontend/README.md`](frontend/README.md) for
service-specific detail.

## Before opening a PR

```bash
make lint    # ruff (backend) + tsc (frontend)
make test    # pytest + opa test
```

CI (`.github/workflows/ci.yml`) runs the same checks plus a frontend production build and
a container security scan (Trivy + Checkov) — see that file for the full pipeline.

## Adding a compliance control

1. Add the Rego rule under `policies/<framework>/` (see [`policies/README.md`](policies/README.md)).
2. Mirror it in `backend/app/policy_engine/local_fallback.py` (the Python fallback used
   when OPA isn't reachable).
3. Add it to `backend/app/policy_engine/catalog.py` so it appears in `GET /api/v1/policies`.
4. Add a passing + failing test case in `policies/tests/`.

No backend redeploy is required for policy changes alone — OPA hot-reloads the mounted
`policies/` directory (see ADR-002).

## Adding a database migration

```bash
cd backend
alembic revision -m "add some_column to findings"
# hand-edit the generated file — autogenerate needs a live DB connection,
# see alembic/versions/0001_initial_schema.py for the pattern used so far
alembic upgrade head
```

## Commit style

Conventional, imperative subject lines (`add X`, `fix Y`, `refactor Z`) — no strict
enforcement, just keep it readable in `git log`.
