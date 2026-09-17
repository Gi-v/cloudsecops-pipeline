"""Shared pytest fixtures.

`client` boots the real FastAPI app (real routes, real middleware, real rate
limiter, real in-memory Kafka/local-disk evidence fallbacks) through
Starlette's TestClient, but patches `init_models` to a no-op so the app's
lifespan doesn't require a live Postgres connection just to exercise routes
that never touch the database (health, policy catalog, ad-hoc evaluation).

Scoped to the *session* (not module, not function) because several
app-level singletons — the Kafka producer's fallback `asyncio.Queue` in
particular — are bound to whichever event loop first creates them, and
`TestClient.__enter__` runs the app's lifespan inside its own portal
thread/loop, fresh every time it's entered. A module-scoped client looked
sufficient while only one test module used it (module- and session-scope
are identical with a single user) but broke the moment a second module
started using it too: each module got its own lifespan cycle — its own
portal loop — against the *same* producer_client singleton, so the second
module's Kafka consumer tried to read a fallback queue still bound to the
first module's already-closed loop ("Queue ... is bound to a different
event loop", surfacing at that first module's teardown). Session scope
means exactly one lifespan cycle, one portal loop, for the whole run —
which is also just correct: "a real deployment has exactly one event loop
for the app's lifetime" was already this file's own stated ideal.

`db_client`/`db_session` below add a *real* Postgres-backed path for routes
that do touch the database (findings/resources/evidence/scan/metrics) — see
their own docstrings for why this didn't exist until now and what it needed.
"""
import os
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

# The app's own startup hook (AUTO_SEED_ON_STARTUP, default True in
# app/core/config.py) fires a real scan against the *production*
# DATABASE_URL on every lifespan startup. Locally that DB is usually
# unreachable from a bare `pytest` run, so it just fails silently — but in
# CI (a real reachable Postgres, and no Kafka at all so the producer/
# consumer fall back to an in-process queue) it actually runs end to end:
# the seeded scan's synthetic resources get published, and this same test
# process's own consumer immediately tries to persist them against a
# database whose tables were never created, spamming
# `UndefinedTableError: relation "resources" does not exist` for the rest
# of the run. An autouse fixture that flips this off was tried first and
# wasn't reliable — CI's coverage run showed the leak still happening
# despite it (session-scoped autouse fixtures are only *documented* to run
# before other fixtures of the same test, not guaranteed independent of
# module import order). Doing it here instead, as a plain statement at
# conftest.py's own import time, has no such ordering question: pytest
# always fully imports conftest.py before collecting or running a single
# test, so this line has already run by the time anything else in this
# file — `client` included — gets a chance to import app.main and start
# its lifespan.
from app.core.config import get_settings  # noqa: E402

get_settings().auto_seed_on_startup = False


@pytest.fixture(scope="session")
def client():
    with patch("app.db.database.init_models", new=AsyncMock()):
        from app.main import app

        with TestClient(app) as c:
            yield c


# ── Real-database fixtures ──────────────────────────────────────────────
# The rest of this suite (test_api_policy_routes.py and friends) covers
# every route that *doesn't* need a database. Everything that does —
# filtering/paginating findings, resource listing, the evidence hash-chain,
# scan-run persistence, the trend/top-resources analytics — was previously
# "verified live instead" (see this project's own commit history) because
# no DB fixture existed. It exists now: a dedicated `cloudsecops_test`
# database on the same Postgres server the dev stack already runs (default
# TEST_DATABASE_URL matches docker-compose.yml's own credentials, so the
# already-running dev container works with zero extra setup locally; CI
# gets a fresh `postgres:16-alpine` service — see ci.yml), tables created
# once per test session, truncated clean after every single test.
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://cloudsecops:cloudsecops_dev_password@localhost:5432/cloudsecops_test",
)

_test_engine = create_async_engine(
    TEST_DATABASE_URL,
    # NullPool: a pooled asyncpg connection is bound to whichever event loop
    # created it, and this suite has two — pytest-asyncio's per-test loop
    # (where db_session/seeding runs) and Starlette TestClient's own portal
    # thread/loop (where db_client's requests actually execute). A pooled
    # connection checked in from one and handed back out in the other
    # raises "Future attached to a different loop". NullPool makes every
    # checkout a brand-new connection instead of a reused one, so no
    # connection ever crosses loops — the same fix SQLAlchemy's own docs
    # give for async engines used under a test client like this.
    poolclass=NullPool,
)
TestSessionLocal = async_sessionmaker(bind=_test_engine, expire_on_commit=False)


@pytest.fixture(scope="session")
async def _db_schema():
    from app.db.database import Base

    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await _test_engine.dispose()


@pytest.fixture
async def db_session(_db_schema):
    """A real session against the test database, for a test to seed its own
    fixture rows directly (bypassing the async Kafka pipeline entirely —
    see test_scan_routes.py's module docstring for why). Truncated after
    every test so no test ever sees another test's leftover rows; CASCADE
    handles FK order (findings -> resources, evidence_records -> findings)
    without needing to hardcode a truncation order."""
    async with TestSessionLocal() as session:
        yield session
    async with _test_engine.begin() as conn:
        await conn.execute(
            text(
                "TRUNCATE resources, findings, evidence_records, scan_runs "
                "RESTART IDENTITY CASCADE"
            )
        )


@pytest.fixture
def db_client(client, _db_schema):
    """The same session-scoped `client`/app/lifespan as above (exactly one
    per test run, so it can't hit the "bound to a different event loop"
    issue its own docstring documents), with `get_db`
    overridden per-test to hand out sessions against the test database
    instead of the production one — a fresh session per request, exactly
    like `app.db.database.get_db` does for real, just pointed elsewhere.
    Function-scoped so the override is added and removed around each test
    without needing a second TestClient/lifespan (which would restart the
    Kafka consumers and re-trigger the exact event-loop issue `client`'s
    own docstring documents)."""
    from app.db.database import get_db
    from app.main import app

    async def _override_get_db():
        async with TestSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = _override_get_db
    yield client
    app.dependency_overrides.pop(get_db, None)
