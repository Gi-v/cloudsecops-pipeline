# ADR-007: JWT Login + Role-Based Access Control

**Status:** Accepted

## Context

`app/core/auth.py`'s own docstring already said the quiet part out loud: the single static
`X-API-Key` gate was "intentionally the minimum viable gate, not the final word on auth,"
with no `User` model, no password hashing, no roles anywhere in the codebase (confirmed via
exhaustive grep — zero hits for `class User`, `bcrypt`, `passlib`, `pyjwt`, `jose` as code
prior to this change). Every mutating endpoint (trigger a scan, change a finding's status)
was either wide open or gated by one shared secret with no notion of *who* did it or *what
they're allowed to do* — no viewer/admin distinction was possible at all.

## Decision

**`pyjwt`, not `python-jose`, again.** `app/core/auth.py`'s docstring already explains
`python-jose` was tried and dropped for pulling in `ecdsa`, whose Minerva-attack timing
vulnerability (CVE-2024-23342) its maintainers have no plans to fix. HS256 (a single shared
secret the backend uses to both sign and verify its own tokens) needs no asymmetric-crypto
dependency at all — `pyjwt` alone is sufficient, avoiding that exposure a second time. The
signing secret reuses the existing `APP_SECRET_KEY` setting rather than adding a second secret
to configure and rotate.

**Hybrid, not a replacement.** The existing `X-API-Key` path is kept alongside JWT rather than
deleted — real systems commonly need both interactive human auth (a person logged into the
dashboard) and a service-account path for automation (a cron job triggering scans with no
human present). `get_current_principal` (`app/core/security.py`) accepts either a valid
`Authorization: Bearer` JWT (resolved to a real database user, `role` re-read from the DB on
every request rather than trusted from the token claim — a role change or deactivation takes
effect immediately, not just after the token expires) or a valid `X-API-Key` (resolved to a
fixed `service-account` principal, admin-equivalent, matching the old gate's behavior exactly).
`require_role(*roles)` is a dependency factory built on top of this single entry point, so
every protected route accepts both auth paths uniformly.

**New `User` model** (`app/db/models.py`): `username`, `email`, `hashed_password` (bcrypt,
via the `bcrypt` package directly rather than `passlib` — already a transitive dependency and
avoids `passlib`'s own maintenance/deprecation-warning friction with newer bcrypt releases),
`role` (`viewer` | `admin`), `is_active`. A hand-written Alembic migration
(`0002_add_users_table.py`) follows the same convention `0001_initial_schema.py` set.

**Seed admin on first boot**, mirroring the existing `AUTO_SEED_ON_STARTUP` pattern for demo
scan data: if no users exist at startup, create one from `SEED_ADMIN_USERNAME`/
`SEED_ADMIN_PASSWORD`. Disabled in tests the same proven-safe way `auto_seed_on_startup`
already is — a plain statement at `conftest.py`'s *import time*, not a fixture (an autouse
fixture was tried first for the scan-seeding case earlier this project's history and wasn't
reliably ordered relative to other fixtures; the import-time statement has no such ambiguity
since pytest fully imports `conftest.py` before collecting or running anything).

**Rate-limited login** (`RATE_LIMIT_LOGIN_PER_MINUTE`, default 10/minute) via the same
`slowapi` limiter already used for the scan endpoint — brute-force protection on the one
endpoint that accepts a password.

## Consequences

**Positive**
- Real RBAC: a viewer account can browse everything but gets a genuine 403 on `POST /scan`,
  `PATCH /findings/*/status`, and `PATCH /findings/bulk-status` — not just a hidden button.
- Automation keeps working unmodified — a script using `X-API-Key` never needed to change.
- Password hashes never leave the database; JWTs carry only `sub`/`role`/`exp`, no PII.

**Negative**
- Two auth mechanisms to reason about instead of one — every protected route's behavior now
  depends on which credential was presented, documented in this ADR precisely so that isn't
  a surprise later.
- The default seeded admin password is a known, documented value
  (`SEED_ADMIN_PASSWORD=change-me-on-first-login`) — acceptable for a demo/portfolio
  deployment (the same posture as `API_AUTH_ENABLED=false` by default) but a real deployment
  must override it, exactly like it must override `API_KEY` and `APP_SECRET_KEY`.
