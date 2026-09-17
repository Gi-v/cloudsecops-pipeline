"""Tests for evaluate_and_persist — the actual "evaluate one resource and
write the results" logic the Kafka consumer calls per message (see
app/main.py's handle_raw_finding). Called directly against the real test
database rather than through Kafka: this is the same scope decision
test_scan_routes.py documents (don't sleep-synchronize with a background
consumer task) applied from the other direction — test the consumer's own
callback logic directly instead of trying to trigger it asynchronously.

Uses a public-read S3 bucket payload, the same one test_local_policy_
fallback.py and the Policy Simulator's own "Load Sample" button use — a
known, realistic violation shape (public ACL + versioning disabled +
encryption disabled = 3 CIS v2 violations) regardless of whether this
process's opa_client reaches a real OPA server or falls back to
evaluate_local (both exist specifically to agree on cases like this one —
see ADR-002).
"""
import uuid

from sqlalchemy import select

from app.db.models import Finding, Resource, ScanRun
from app.policy_engine.evaluator import evaluate_and_persist

PUBLIC_BUCKET = {
    "resource_urn": "arn:aws:s3:::evaluator-test-bucket",
    "provider": "AWS",
    "resource_type": "aws_s3_bucket",
    "region": "us-east-1",
    "account_id": "111111111111",
    "config": {
        "bucket_name": "evaluator-test-bucket",
        "acl": "public-read",
        "versioning_enabled": False,
        "encryption_enabled": False,
    },
}

PRIVATE_BUCKET = {
    **PUBLIC_BUCKET,
    "resource_urn": "arn:aws:s3:::evaluator-test-bucket-private",
    "config": {
        "bucket_name": "evaluator-test-bucket-private",
        "acl": "private",
        "versioning_enabled": True,
        "encryption_enabled": True,
    },
}


def _unique_bucket() -> dict:
    return {**PUBLIC_BUCKET, "resource_urn": f"arn:aws:s3:::eval-test-{uuid.uuid4().hex[:8]}"}


async def test_creates_resource_and_findings_for_violations(db_session):
    raw = _unique_bucket()
    correlation_id = uuid.uuid4().hex

    enriched = await evaluate_and_persist(db_session, raw, correlation_id)

    assert len(enriched["violations"]) == 3
    assert enriched["resource_urn"] == raw["resource_urn"]

    resource = (
        await db_session.execute(
            select(Resource).where(Resource.resource_urn == raw["resource_urn"])
        )
    ).scalar_one()
    findings = (
        await db_session.execute(select(Finding).where(Finding.resource_id == resource.id))
    ).scalars().all()

    violation_findings = [f for f in findings if not f.passed]
    assert len(violation_findings) == 3
    assert all(f.correlation_id == correlation_id for f in violation_findings)
    assert all(f.evidence_hash is not None for f in violation_findings)


async def test_creates_passing_findings_not_just_enriched_payload(db_session):
    """Regression coverage for the exact bug evaluate_and_persist's own
    inline comment documents: passed controls used to only exist in the
    Kafka message, never as real rows, permanently stranding "Controls
    Passing" and every framework's coverage % at 0."""
    raw = {**PRIVATE_BUCKET, "resource_urn": f"arn:aws:s3:::eval-test-{uuid.uuid4().hex[:8]}"}
    correlation_id = uuid.uuid4().hex

    enriched = await evaluate_and_persist(db_session, raw, correlation_id)
    assert len(enriched["violations"]) == 0
    assert len(enriched["passed_controls"]) > 0

    resource = (
        await db_session.execute(
            select(Resource).where(Resource.resource_urn == raw["resource_urn"])
        )
    ).scalar_one()
    passing = (
        await db_session.execute(
            select(Finding).where(Finding.resource_id == resource.id, Finding.passed == True)  # noqa: E712
        )
    ).scalars().all()

    assert len(passing) == len(enriched["passed_controls"])
    assert all(f.status.value == "RESOLVED" for f in passing)


async def test_upserts_existing_resource_instead_of_duplicating(db_session):
    raw = _unique_bucket()

    await evaluate_and_persist(db_session, raw, uuid.uuid4().hex)
    await evaluate_and_persist(db_session, raw, uuid.uuid4().hex)

    resources = (
        await db_session.execute(
            select(Resource).where(Resource.resource_urn == raw["resource_urn"])
        )
    ).scalars().all()
    assert len(resources) == 1


async def test_updates_scan_run_running_totals(db_session):
    correlation_id = uuid.uuid4().hex
    scan_run = ScanRun(correlation_id=correlation_id, status="PUBLISHED", resources_scanned=1)
    db_session.add(scan_run)
    await db_session.commit()

    await evaluate_and_persist(db_session, _unique_bucket(), correlation_id)

    await db_session.refresh(scan_run)
    assert scan_run.violations_found == 3
    assert scan_run.findings_created == 3


async def test_enriched_findings_payload_shape_matches_websocket_contract(db_session):
    """The dict this returns is published as-is to findings.enriched and
    consumed by the dashboard's live feed (see LiveFindingMessage in the
    frontend's types) — every key the frontend reads must be present."""
    enriched = await evaluate_and_persist(db_session, _unique_bucket(), uuid.uuid4().hex)

    top_level_keys = (
        "correlation_id", "resource_urn", "resource_type", "provider",
        "violations", "passed_controls", "findings", "evaluated_at",
    )
    for key in top_level_keys:
        assert key in enriched

    finding_payload = enriched["findings"][0]
    finding_keys = (
        "id", "resource_urn", "control_id", "framework",
        "severity", "title", "passed", "evidence_hash",
    )
    for key in finding_keys:
        assert key in finding_payload
