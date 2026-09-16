"""HTTP-level tests for the routes that don't require a live database:
health checks and the policy catalog / ad-hoc evaluation endpoints."""


def test_healthz(client):
    resp = client.get("/healthz")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_root(client):
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.json()["service"] == "CloudSecOps Pipeline API"


def test_list_policies_returns_catalog(client):
    resp = client.get("/api/policies")
    assert resp.status_code == 200
    controls = resp.json()
    assert len(controls) >= 15
    assert any(c["control_id"] == "CIS-2.1.2" for c in controls)


def test_list_sample_resources(client):
    resp = client.get("/api/policies/samples")
    assert resp.status_code == 200
    samples = resp.json()
    assert "aws_s3_bucket" in samples


def test_evaluate_public_bucket_via_http(client):
    resp = client.post(
        "/api/policies/evaluate",
        json={
            "resource": {
                "resource_type": "aws_s3_bucket",
                "config": {"bucket_name": "test", "acl": "public-read"},
            }
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    control_ids = [v["control_id"] for v in body["violations"]]
    assert "CIS-2.1.2" in control_ids


def test_evaluate_private_bucket_passes_via_http(client):
    resp = client.post(
        "/api/policies/evaluate",
        json={
            "resource": {
                "resource_type": "aws_s3_bucket",
                "config": {
                    "bucket_name": "test",
                    "acl": "private",
                    "versioning_enabled": True,
                    "encryption_enabled": True,
                },
            }
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["violations"] == []


def test_prometheus_metrics_endpoint_exposed(client):
    resp = client.get("/metrics")
    assert resp.status_code == 200
    assert b"python_info" in resp.content or b"http_requests" in resp.content


def test_request_id_header_present_on_every_response(client):
    resp = client.get("/healthz")
    assert "x-request-id" in {k.lower() for k in resp.headers}


def test_request_id_is_echoed_back_when_supplied(client):
    resp = client.get("/healthz", headers={"X-Request-ID": "my-trace-id"})
    assert resp.headers["x-request-id"] == "my-trace-id"


def test_bulk_status_update_rejects_empty_list(client):
    resp = client.patch("/api/findings/bulk-status", json={"finding_ids": [], "status": "RESOLVED"})
    assert resp.status_code == 400


def test_bulk_status_update_rejects_too_many_ids(client):
    ids = [f"00000000-0000-0000-0000-{i:012d}" for i in range(501)]
    resp = client.patch("/api/findings/bulk-status", json={"finding_ids": ids, "status": "RESOLVED"})
    assert resp.status_code == 400


async def test_unhandled_exception_handler_returns_clean_json():
    """The global catch-all handler in app.main must never leak a stack
    trace to the client — verified by calling it directly with a synthetic
    exception, rather than over HTTP: Starlette's ServerErrorMiddleware
    always re-raises after building the response (so tools like
    TestClient(raise_server_exceptions=True) can surface it), which makes an
    HTTP round-trip through TestClient an unreliable way to test this path."""
    from starlette.requests import Request

    from app.main import unhandled_exception_handler

    scope = {"type": "http", "method": "GET", "path": "/boom", "headers": []}
    request = Request(scope)

    response = await unhandled_exception_handler(request, RuntimeError("boom"))

    assert response.status_code == 500
    import json

    body = json.loads(response.body)
    assert body["error"] == "internal_error"
    assert "boom" not in body["detail"]  # never leak internal exception text
