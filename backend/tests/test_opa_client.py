"""Tests for OPAClient — mocks the underlying httpx.AsyncClient instance
directly (no real OPA server, no real network) rather than the module-level
`opa_client` singleton, so each test gets its own isolated client.
"""
from unittest.mock import AsyncMock, MagicMock

from app.policy_engine.opa_client import OPAClient


def make_response(status_code=200, json_body=None):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = json_body or {}
    if status_code >= 400:
        resp.raise_for_status.side_effect = Exception(f"{status_code} error")
    else:
        resp.raise_for_status.side_effect = None
    return resp


async def test_health_check_true_when_opa_responds_200():
    client = OPAClient()
    client._client.get = AsyncMock(return_value=make_response(200))
    assert await client.health_check() is True


async def test_health_check_false_on_non_200():
    client = OPAClient()
    client._client.get = AsyncMock(return_value=make_response(503))
    assert await client.health_check() is False


async def test_health_check_false_when_opa_unreachable():
    client = OPAClient()
    client._client.get = AsyncMock(side_effect=ConnectionError("refused"))
    assert await client.health_check() is False


async def test_evaluate_returns_opas_real_result_when_reachable():
    client = OPAClient()
    opa_result = {"violations": [{"control_id": "CIS-2.1.2"}], "passed_controls": []}
    client._client.post = AsyncMock(return_value=make_response(200, {"result": opa_result}))

    result = await client.evaluate({"resource_type": "aws_s3_bucket", "config": {}})

    assert result == opa_result


async def test_evaluate_falls_back_to_local_when_opa_unreachable():
    client = OPAClient()
    client._client.post = AsyncMock(side_effect=ConnectionError("refused"))

    result = await client.evaluate({
        "resource_type": "aws_s3_bucket",
        "config": {"acl": "public-read", "versioning_enabled": True, "encryption_enabled": True},
    })

    # evaluate_local's own real answer for a public-read bucket — proves
    # this actually fell through to the fallback, not just "didn't crash".
    assert any(v["control_id"] == "CIS-2.1.2" for v in result["violations"])


async def test_evaluate_falls_back_to_local_when_opa_returns_no_result_key():
    client = OPAClient()
    client._client.post = AsyncMock(return_value=make_response(200, {"result": None}))

    result = await client.evaluate({
        "resource_type": "aws_s3_bucket",
        "config": {"acl": "public-read", "versioning_enabled": True, "encryption_enabled": True},
    })

    assert any(v["control_id"] == "CIS-2.1.2" for v in result["violations"])


async def test_evaluate_falls_back_to_local_when_opa_returns_an_error_status():
    client = OPAClient()
    client._client.post = AsyncMock(return_value=make_response(500))

    result = await client.evaluate({
        "resource_type": "aws_s3_bucket",
        "config": {"acl": "public-read", "versioning_enabled": True, "encryption_enabled": True},
    })

    assert any(v["control_id"] == "CIS-2.1.2" for v in result["violations"])


async def test_aclose_closes_the_underlying_http_client():
    client = OPAClient()
    client._client.aclose = AsyncMock()
    await client.aclose()
    client._client.aclose.assert_awaited_once()
