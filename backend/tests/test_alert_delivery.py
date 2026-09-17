"""Tests for deliver_alert — the webhook-delivery half of the critical-alert
pipeline (extract_critical_alerts, the pure-function half, is already
covered in test_alerting.py). Mocks httpx.AsyncClient.post rather than
hitting a real network, consistent with this module's own promise: alert
delivery should never be able to crash the consumer calling it, webhook
configured or not, reachable or not.
"""
from unittest.mock import AsyncMock, patch

import pytest

from app.alerting.notifier import deliver_alert, settings

ALERT = {
    "resource_urn": "arn:aws:s3:::prod-bucket",
    "provider": "AWS",
    "control_id": "CIS-2.1.2",
    "framework": "CIS v2",
    "title": "S3 bucket has public-read ACL",
    "description": "desc",
    "remediation": "fix it",
    "correlation_id": "c1",
    "alerted_at": "2026-01-01T00:00:00Z",
}


@pytest.fixture(autouse=True)
def restore_webhook_url():
    """deliver_alert reads the module-level `settings` singleton directly,
    so tests mutate it in place and must restore it afterward — same
    pattern test_auth.py already uses for the same reason."""
    orig = settings.alert_webhook_url
    yield
    settings.alert_webhook_url = orig


async def test_no_webhook_configured_skips_the_http_call_entirely():
    settings.alert_webhook_url = ""
    with patch("httpx.AsyncClient.post", new=AsyncMock()) as mock_post:
        await deliver_alert(ALERT)
        mock_post.assert_not_called()


async def test_delivers_the_alert_payload_to_the_configured_webhook():
    settings.alert_webhook_url = "https://hooks.example.com/incoming"
    mock_response = AsyncMock()
    mock_response.raise_for_status = lambda: None
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=mock_response)) as mock_post:
        await deliver_alert(ALERT)

    mock_post.assert_awaited_once()
    url, kwargs = mock_post.call_args.args[0], mock_post.call_args.kwargs
    assert url == "https://hooks.example.com/incoming"
    assert kwargs["json"]["control_id"] == "CIS-2.1.2"
    assert kwargs["json"]["resource_urn"] == ALERT["resource_urn"]
    # A generic JSON POST compatible with Slack/Discord incoming webhooks
    # needs a top-level "text" field summarizing the alert.
    assert "CRITICAL" in kwargs["json"]["text"]
    assert ALERT["title"] in kwargs["json"]["text"]


async def test_webhook_delivery_failure_is_caught_not_raised():
    """A dead webhook (network error, non-2xx, timeout) must not take the
    calling consumer down with it — deliver_alert already logged the alert
    itself before ever trying the HTTP call, so a failed delivery is a
    delivery problem, not a lost alert."""
    settings.alert_webhook_url = "https://hooks.example.com/incoming"
    with patch("httpx.AsyncClient.post", new=AsyncMock(side_effect=ConnectionError("down"))):
        await deliver_alert(ALERT)  # must not raise


async def test_raise_for_status_failure_is_also_caught_not_raised():
    settings.alert_webhook_url = "https://hooks.example.com/incoming"
    mock_response = AsyncMock()

    # raise_for_status() is called synchronously in deliver_alert (it's a
    # plain httpx.Response method, not awaited) — a plain function that
    # raises directly, not an AsyncMock, which would just hand back an
    # unawaited coroutine instead of actually raising here.
    def _raise():
        raise Exception("500 Server Error")

    mock_response.raise_for_status = _raise
    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=mock_response)):
        await deliver_alert(ALERT)  # must not raise
