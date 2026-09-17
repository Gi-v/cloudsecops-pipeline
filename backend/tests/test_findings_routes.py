"""HTTP-level tests for /api/findings against a real Postgres database (see
tests/conftest.py's db_client/db_session fixtures) — filtering, pagination,
CSV export, and bulk status updates were previously untested at this level
because no DB fixture existed."""
import uuid

from app.db.models import CloudProvider, Finding, FindingStatus, Resource, Severity


async def _seed_resource(db_session, **overrides) -> Resource:
    defaults = dict(
        resource_urn=f"arn:aws:s3:::test-bucket-{uuid.uuid4().hex[:8]}",
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


async def _seed_finding(db_session, resource: Resource, **overrides) -> Finding:
    defaults = dict(
        resource_id=resource.id,
        control_id="CIS-2.1.2",
        framework="CIS v2",
        severity=Severity.HIGH,
        status=FindingStatus.OPEN,
        title="S3 bucket public-read ACL",
        description="Bucket grants public-read access via its ACL.",
        remediation="Remove the public-read grant.",
        passed=False,
        correlation_id=uuid.uuid4().hex,
    )
    defaults.update(overrides)
    finding = Finding(**defaults)
    db_session.add(finding)
    await db_session.flush()
    await db_session.commit()
    return finding


async def test_list_findings_excludes_passing_controls(db_session, db_client):
    resource = await _seed_resource(db_session)
    await _seed_finding(db_session, resource, passed=False, control_id="CIS-1")
    await _seed_finding(db_session, resource, passed=True, control_id="CIS-2")

    resp = db_client.get("/api/findings")
    assert resp.status_code == 200
    control_ids = [f["control_id"] for f in resp.json()]
    assert "CIS-1" in control_ids
    assert "CIS-2" not in control_ids


async def test_list_findings_filters_by_severity(db_session, db_client):
    resource = await _seed_resource(db_session)
    await _seed_finding(db_session, resource, severity=Severity.CRITICAL, control_id="CIS-CRIT")
    await _seed_finding(db_session, resource, severity=Severity.LOW, control_id="CIS-LOW")

    resp = db_client.get("/api/findings", params={"severity": "CRITICAL"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["control_id"] == "CIS-CRIT"


async def test_list_findings_filters_by_provider_via_resource_join(db_session, db_client):
    aws_resource = await _seed_resource(db_session, provider=CloudProvider.AWS)
    gcp_resource = await _seed_resource(
        db_session, provider=CloudProvider.GCP, resource_urn="gcp:compute:instance:test-1"
    )
    await _seed_finding(db_session, aws_resource, control_id="AWS-FINDING")
    await _seed_finding(db_session, gcp_resource, control_id="GCP-FINDING")

    resp = db_client.get("/api/findings", params={"provider": "GCP"})
    assert resp.status_code == 200
    body = resp.json()
    assert [f["control_id"] for f in body] == ["GCP-FINDING"]


async def test_list_findings_search_matches_title_and_control_id(db_session, db_client):
    resource = await _seed_resource(db_session)
    await _seed_finding(
        db_session, resource, control_id="CIS-1.2", title="IAM user without MFA"
    )
    await _seed_finding(
        db_session, resource, control_id="CIS-5.2", title="SSH open to 0.0.0.0/0"
    )

    resp = db_client.get("/api/findings", params={"search": "MFA"})
    assert [f["control_id"] for f in resp.json()] == ["CIS-1.2"]

    resp = db_client.get("/api/findings", params={"search": "cis-5"})
    assert [f["control_id"] for f in resp.json()] == ["CIS-5.2"]


async def test_list_findings_reports_total_count_header_independent_of_limit(db_session, db_client):
    resource = await _seed_resource(db_session)
    for i in range(5):
        await _seed_finding(db_session, resource, control_id=f"CIS-{i}")

    resp = db_client.get("/api/findings", params={"limit": 2})
    assert resp.status_code == 200
    assert len(resp.json()) == 2
    assert resp.headers["x-total-count"] == "5"


async def test_export_csv_includes_evidence_hash_column(db_session, db_client):
    resource = await _seed_resource(db_session)
    await _seed_finding(db_session, resource, evidence_hash="a" * 64, control_id="CIS-CSV")

    resp = db_client.get("/api/findings/export.csv")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    body = resp.text
    assert "control_id" in body.splitlines()[0]
    assert "CIS-CSV" in body
    assert "a" * 64 in body


async def test_bulk_update_status_updates_found_and_reports_not_found(db_session, db_client):
    resource = await _seed_resource(db_session)
    f1 = await _seed_finding(db_session, resource, control_id="CIS-A")
    f2 = await _seed_finding(db_session, resource, control_id="CIS-B")
    missing_id = str(uuid.uuid4())

    resp = db_client.patch(
        "/api/findings/bulk-status",
        json={"finding_ids": [str(f1.id), str(f2.id), missing_id], "status": "RESOLVED"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["updated"] == 2
    assert body["not_found"] == [missing_id]

    check = db_client.get(f"/api/findings/{f1.id}")
    assert check.json()["status"] == "RESOLVED"
    assert check.json()["resolved_at"] is not None


async def test_get_finding_404_for_unknown_id(db_client):
    resp = db_client.get(f"/api/findings/{uuid.uuid4()}")
    assert resp.status_code == 404


async def test_update_finding_status_sets_resolved_at_only_when_resolved(db_session, db_client):
    resource = await _seed_resource(db_session)
    finding = await _seed_finding(db_session, resource, control_id="CIS-STATUS")

    resp = db_client.patch(f"/api/findings/{finding.id}/status", json={"status": "IN_REVIEW"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "IN_REVIEW"
    assert body["resolved_at"] is None

    resp = db_client.patch(f"/api/findings/{finding.id}/status", json={"status": "RESOLVED"})
    assert resp.json()["resolved_at"] is not None
