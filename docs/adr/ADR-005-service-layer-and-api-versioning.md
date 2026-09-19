# ADR-005: Service Layer + API Versioning

**Status:** Accepted

## Context

Every route handler in `app/api/routes/` built SQLAlchemy queries and business logic
directly inline — `findings.py` had a 35-line `_build_filtered_stmt`, `metrics.py` had the
severity-weighted scoring math and CIS-family bucketing, `scan.py` had the entire
collect-then-publish pipeline, all living inside `async def` HTTP handlers. This made the
business logic untestable without going through FastAPI's request/response cycle, and
impossible to reuse (the auto-seed startup hook in `app.main` had to import a route module
and call its handler function directly to trigger a scan outside of a request).

There was also no API versioning (`/api/findings`, not `/api/v1/findings`) and inconsistent
error shapes — a plain `raise HTTPException(...)` returned FastAPI's default
`{"detail": ...}`, while the two global handlers already in `main.py` returned a different
one-off `{"error": ..., "detail": ...}`. Neither shape carried a request ID for correlating
a client-reported error with the structured log line RequestContextMiddleware already
produces for every request.

## Decision

**Service layer.** One module per domain in `app/services/` (`findings_service.py`,
`resources_service.py`, `evidence_service.py`, `scan_service.py`, `metrics_service.py`,
`auth_service.py`). Route handlers do exactly three things: parse the request, call a
service function, shape the HTTP response. All query-building and business logic moved
into the matching service function, taking an `AsyncSession` and plain parameters, and
returning ORM objects or plain dicts — no FastAPI types leak into the service layer, so
every service function is callable (and testable) with nothing but a database session.

**API versioning.** Every route module's prefix changed from `/api/<domain>` to
`/<domain>`; `app/main.py` aggregates them under one `APIRouter(prefix="/api/v1")`. Health
checks, the Prometheus `/metrics` scrape endpoint, and `/ws/live` stay unversioned — they're
infra-level contracts (Docker healthchecks, k8s probes, a scraper's static config), not part
of the versioned API surface a frontend or external client depends on.

**Consistent errors.** Every error response, whatever raises it, now serializes as
`{"error": {"code", "message", "request_id"}}`: new `StarletteHTTPException`,
`RequestValidationError`, `RateLimitExceeded`, and catch-all `Exception` handlers in
`main.py` all build this same shape, with `request_id` read back from the same structlog
contextvar `RequestContextMiddleware` already binds — so a client-visible error and its
corresponding server log line share one ID with no extra plumbing.

## Consequences

**Positive**
- Business logic is unit-testable without an HTTP round-trip; `test_metrics_scoring.py`
  imports `weighted_score` directly from `metrics_service`.
- The startup auto-seed hook now imports `run_scan_standalone` from `scan_service` — a
  normal function import, not a route-module reach-around.
- One error shape everywhere means the frontend (and any future API client) checks
  `response.error.code` in exactly one place, and a support request quoting a `request_id`
  is one `grep` away from the exact log line that produced it.
- `/api/v1` gives room to introduce `/api/v2` later without breaking existing clients.

**Negative**
- Every route file, every backend test's request URLs, and the frontend's `client.ts` all
  needed updating in the same change — a large, mechanical diff, though a low-risk one since
  it's almost entirely find-and-replace on URL prefixes plus moving function bodies verbatim.
- One more layer to navigate for a newcomer reading the codebase top-down (route → service →
  model, instead of route → model) — judged worth it once a second consumer of the same
  logic existed (the auto-seed hook, then later the seeded-admin startup hook).
