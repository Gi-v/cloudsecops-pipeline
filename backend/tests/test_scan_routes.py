"""HTTP-level tests for /api/scan against a real Postgres database.

Scoped deliberately: trigger_scan's own job is collecting resources and
publishing them to Kafka's findings.raw (see run_scan in
app/api/routes/scan.py) — it does not write Resource/Finding rows itself,
those come from a separate consumer (handle_raw_finding in app/main.py)
that runs as an in-process asyncio background task. Asserting on
Resource/Finding rows after a scan would mean sleep-based synchronization
with that background task — exactly the kind of flaky, timing-dependent
test this suite avoids elsewhere. What's tested here is trigger_scan's own
real, synchronous contract: a ScanRun row gets created and persisted with
real fields, independent of whatever the consumer does afterward.
"""
import pytest

from app.core.rate_limit import limiter
from app.db.models import ScanRun


@pytest.fixture(autouse=True)
def _reset_scan_rate_limit():
    """POST /api/scan is rate-limited (default 6/minute), backed by Redis
    when it's reachable — which it is here, since it's the same Redis the
    dev stack's live demo uses. Redis-backed limiter state persists across
    separate pytest invocations within the same real-world minute (unlike
    an in-memory limiter, which would reset with the process), so a second
    test run shortly after the first starts already partway through its
    quota. Resetting before each test in this module keeps these tests
    deterministic regardless of what ran before them, in this process or
    the last one."""
    limiter.reset()


async def test_trigger_scan_persists_a_scan_run(db_client):
    resp = db_client.post("/api/scan", json={"provider": "AWS"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["provider"] == "AWS"
    assert body["status"] == "PUBLISHED"
    assert body["resources_scanned"] > 0
    assert body["completed_at"] is not None


async def test_get_scan_run_by_correlation_id(db_client):
    triggered = db_client.post("/api/scan", json={"provider": "AWS"}).json()

    resp = db_client.get(f"/api/scan/{triggered['correlation_id']}")
    assert resp.status_code == 200
    assert resp.json()["id"] == triggered["id"]


async def test_get_scan_run_404_for_unknown_correlation_id(db_client):
    resp = db_client.get("/api/scan/does-not-exist")
    assert resp.status_code == 404


async def test_list_scan_runs_orders_most_recent_first(db_session, db_client):
    first = ScanRun(correlation_id="corr-older", status="PUBLISHED", resources_scanned=1)
    db_session.add(first)
    await db_session.commit()

    triggered = db_client.post("/api/scan", json={"provider": "AWS"}).json()

    resp = db_client.get("/api/scan", params={"limit": 5})
    assert resp.status_code == 200
    correlation_ids = [r["correlation_id"] for r in resp.json()]
    assert correlation_ids[0] == triggered["correlation_id"]
    assert "corr-older" in correlation_ids
