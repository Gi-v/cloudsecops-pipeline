"""HTTP-level tests for /api/resources against a real Postgres database."""
import uuid

from app.db.models import CloudProvider, Resource


async def _seed_resource(db_session, **overrides) -> Resource:
    defaults = dict(
        resource_urn=f"arn:aws:s3:::test-bucket-{uuid.uuid4().hex[:8]}",
        provider=CloudProvider.AWS,
        resource_type="aws_s3_bucket",
        region="us-east-1",
        account_id="111111111111",
        raw_config={"acl": "private"},
    )
    defaults.update(overrides)
    resource = Resource(**defaults)
    db_session.add(resource)
    await db_session.flush()
    await db_session.commit()
    return resource


async def test_list_resources_filters_by_provider(db_session, db_client):
    await _seed_resource(db_session, provider=CloudProvider.AWS)
    await _seed_resource(
        db_session, provider=CloudProvider.AZURE, resource_urn="azure:vm:test-1",
        resource_type="azure_vm",
    )

    resp = db_client.get("/api/v1/resources", params={"provider": "AZURE"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["provider"] == "AZURE"


async def test_list_resources_filters_by_resource_type(db_session, db_client):
    await _seed_resource(db_session, resource_type="aws_s3_bucket")
    await _seed_resource(
        db_session, resource_type="aws_iam_user", resource_urn="arn:aws:iam::user/test"
    )

    resp = db_client.get("/api/v1/resources", params={"resource_type": "aws_iam_user"})
    assert [r["resource_type"] for r in resp.json()] == ["aws_iam_user"]


async def test_list_resources_search_matches_urn_substring(db_session, db_client):
    await _seed_resource(db_session, resource_urn="arn:aws:s3:::prod-data-lake")
    await _seed_resource(db_session, resource_urn="arn:aws:s3:::staging-uploads")

    resp = db_client.get("/api/v1/resources", params={"search": "prod-data"})
    body = resp.json()
    assert len(body) == 1
    assert body[0]["resource_urn"] == "arn:aws:s3:::prod-data-lake"


async def test_list_resources_reports_total_count_header(db_session, db_client):
    for i in range(3):
        await _seed_resource(db_session, resource_urn=f"arn:aws:s3:::bucket-{i}")

    resp = db_client.get("/api/v1/resources", params={"limit": 1})
    assert len(resp.json()) == 1
    assert resp.headers["x-total-count"] == "3"


async def test_get_resource_returns_raw_config(db_session, db_client):
    resource = await _seed_resource(db_session, raw_config={"versioning_enabled": False})

    resp = db_client.get(f"/api/v1/resources/{resource.id}")
    assert resp.status_code == 200
    assert resp.json()["raw_config"] == {"versioning_enabled": False}


async def test_get_resource_404_for_unknown_id(db_client):
    resp = db_client.get(f"/api/v1/resources/{uuid.uuid4()}")
    assert resp.status_code == 404
