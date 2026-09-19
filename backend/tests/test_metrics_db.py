"""HTTP-level tests for /api/metrics against real seeded data — closes the
gap this project's own git history calls out explicitly: "no DB fixture
exists in this suite yet, so trend/top-resources are verified live
instead" (test_metrics_scoring.py still covers the pure _weighted_score
helper directly; this file covers the endpoints that assemble real rows
around it, including the two analytics endpoints added later)."""
import uuid
from datetime import UTC, datetime, timedelta

from app.db.models import CloudProvider, Finding, Resource, ScanRun, Severity


async def _seed_resource(db_session, **overrides) -> Resource:
    defaults = dict(
        resource_urn=f"arn:aws:s3:::test-{uuid.uuid4().hex[:8]}",
        provider=CloudProvider.AWS,
        resource_type="aws_s3_bucket",
        region="us-east-1",
        account_id="111111111111",
        raw_config={},
    )
    defaults.update(overrides)
    resource = Resource(**defaults)
    db_session.add(resource)
    await db_session.flush()
    return resource


async def _seed_finding(
    db_session, resource: Resource, correlation_id: str, **overrides
) -> Finding:
    defaults = dict(
        resource_id=resource.id,
        control_id="CIS-2.1.2",
        framework="CIS v2",
        severity=Severity.HIGH,
        title="Test finding",
        description="d",
        remediation="r",
        passed=False,
        correlation_id=correlation_id,
    )
    defaults.update(overrides)
    finding = Finding(**defaults)
    db_session.add(finding)
    await db_session.flush()
    return finding


async def _seed_scan_run(db_session, correlation_id: str, completed_at: datetime) -> ScanRun:
    run = ScanRun(
        correlation_id=correlation_id,
        status="PUBLISHED",
        resources_scanned=1,
        completed_at=completed_at,
    )
    db_session.add(run)
    await db_session.flush()
    return run


async def test_dashboard_metrics_reflects_real_findings(db_session, db_client):
    resource = await _seed_resource(db_session)
    corr = uuid.uuid4().hex
    await _seed_scan_run(db_session, corr, datetime.now(UTC))
    await _seed_finding(db_session, resource, corr, severity=Severity.CRITICAL, passed=False)
    await _seed_finding(db_session, resource, corr, severity=Severity.LOW, passed=True)
    await db_session.commit()

    resp = db_client.get("/api/v1/metrics/dashboard")
    assert resp.status_code == 200
    body = resp.json()
    assert body["critical_findings"] == 1
    assert body["controls_passing"] == 1
    assert body["controls_total"] == 2
    assert body["severity_breakdown"]["CRITICAL"] == 1
    assert body["last_scan_at"] is not None
    # One failing CRITICAL should pull the weighted score well below a
    # naive 50% pass rate — this is the exact severity-weighting behavior
    # _weighted_score's own unit tests check in isolation; here it's
    # checked end-to-end through the real endpoint.
    assert body["security_score"] < 50


async def test_cis_family_compliance_groups_by_family_prefix(db_session, db_client):
    resource = await _seed_resource(db_session)
    corr = uuid.uuid4().hex
    await _seed_finding(
        db_session, resource, corr, framework="CIS v2", control_id="CIS-1.4", passed=True
    )
    await _seed_finding(
        db_session, resource, corr, framework="CIS v2", control_id="CIS-1.2", passed=False
    )
    await db_session.commit()

    resp = db_client.get("/api/v1/metrics/cis-families")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["control_count"] == 2
    assert body[0]["passing"] == 1
    assert body[0]["percent"] == 50.0


async def test_score_trend_orders_oldest_first_with_real_resource_counts(db_session, db_client):
    resource_a = await _seed_resource(db_session)
    resource_b = await _seed_resource(db_session)
    now = datetime.now(UTC)

    older_corr, newer_corr = uuid.uuid4().hex, uuid.uuid4().hex
    await _seed_scan_run(db_session, older_corr, now - timedelta(hours=1))
    await _seed_scan_run(db_session, newer_corr, now)

    # Older scan touched one resource, newer touched both — this is the
    # exact field (resources_scanned per trend point) added this session
    # so the dashboard's sparkline could plot real history instead of
    # placeholder numbers.
    await _seed_finding(db_session, resource_a, older_corr, passed=True)
    await _seed_finding(db_session, resource_a, newer_corr, passed=True)
    await _seed_finding(
        db_session, resource_b, newer_corr, severity=Severity.CRITICAL, passed=False
    )
    await db_session.commit()

    resp = db_client.get("/api/v1/metrics/trend")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    assert body[0]["correlation_id"] == older_corr
    assert body[1]["correlation_id"] == newer_corr
    assert body[0]["resources_scanned"] == 1
    assert body[1]["resources_scanned"] == 2
    assert body[1]["critical_findings"] == 1


async def test_top_risk_resources_ranks_by_severity_weighted_score(db_session, db_client):
    noisy_but_low = await _seed_resource(db_session, resource_urn="arn:aws:s3:::noisy")
    quiet_but_critical = await _seed_resource(db_session, resource_urn="arn:aws:s3:::risky")
    corr = uuid.uuid4().hex

    # 3 LOW (weight 1 each = risk 3) vs. 1 CRITICAL (weight 5 = risk 5) —
    # fewer findings, higher rank, because SEVERITY_WEIGHT drives the
    # ranking rather than a flat finding count.
    for _ in range(3):
        await _seed_finding(db_session, noisy_but_low, corr, severity=Severity.LOW, passed=False)
    await _seed_finding(
        db_session, quiet_but_critical, corr, severity=Severity.CRITICAL, passed=False
    )
    await db_session.commit()

    resp = db_client.get("/api/v1/metrics/top-resources")
    assert resp.status_code == 200
    body = resp.json()
    # One CRITICAL should outrank three LOWs despite having fewer open
    # findings — same SEVERITY_WEIGHT table the headline score uses, so
    # "risky" isn't just "has more findings".
    assert body[0]["resource_urn"] == "arn:aws:s3:::risky"
    assert body[0]["worst_severity"] == "CRITICAL"
    assert body[0]["open_findings"] == 1
    assert body[1]["open_findings"] == 3


async def test_trend_by_provider_splits_scores_per_provider(db_session, db_client):
    aws_resource = await _seed_resource(db_session, provider=CloudProvider.AWS)
    gcp_resource = await _seed_resource(db_session, provider=CloudProvider.GCP)
    now = datetime.now(UTC)

    aws_corr, gcp_corr = uuid.uuid4().hex, uuid.uuid4().hex
    aws_run = await _seed_scan_run(db_session, aws_corr, now - timedelta(hours=1))
    aws_run.provider = CloudProvider.AWS
    gcp_run = await _seed_scan_run(db_session, gcp_corr, now)
    gcp_run.provider = CloudProvider.GCP

    await _seed_finding(db_session, aws_resource, aws_corr, passed=True)
    await _seed_finding(
        db_session, gcp_resource, gcp_corr, severity=Severity.CRITICAL, passed=False
    )
    await db_session.commit()

    resp = db_client.get("/api/v1/metrics/trend-by-provider")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    by_provider = {p["provider"]: p for p in body}
    assert by_provider["AWS"]["security_score"] == 100
    assert by_provider["GCP"]["security_score"] < 100


async def test_findings_timeline_buckets_by_day_and_severity(db_session, db_client):
    resource = await _seed_resource(db_session)
    corr = uuid.uuid4().hex
    await _seed_finding(db_session, resource, corr, severity=Severity.CRITICAL, passed=False)
    await _seed_finding(db_session, resource, corr, severity=Severity.LOW, passed=False)
    await db_session.commit()

    resp = db_client.get("/api/v1/metrics/findings-timeline")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["severities"]["CRITICAL"] == 1
    assert body[0]["severities"]["LOW"] == 1
