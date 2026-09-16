"""Shared pytest fixtures.

`client` boots the real FastAPI app (real routes, real middleware, real rate
limiter, real in-memory Kafka/local-disk evidence fallbacks) through
Starlette's TestClient, but patches `init_models` to a no-op so the app's
lifespan doesn't require a live Postgres connection just to exercise routes
that never touch the database (health, policy catalog, ad-hoc evaluation).

Scoped to the module (not function) because several app-level singletons —
the Kafka producer's fallback `asyncio.Queue`, in particular — are bound to
whichever event loop first creates them. A function-scoped client spins up a
fresh event loop per test while those singletons persist across tests,
producing spurious "bound to a different event loop" errors that are a test
artifact, not a real bug (a real deployment has exactly one event loop for
the app's lifetime).
"""
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client():
    with patch("app.db.database.init_models", new=AsyncMock()):
        from app.main import app

        with TestClient(app) as c:
            yield c
