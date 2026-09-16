"""Critical-finding alert pipeline.

`extract_critical_alerts` inspects an enriched finding message and returns
one alert payload per CRITICAL violation — this is what app.main publishes
to the `alerts.critical` Kafka topic after every evaluation.

`deliver_alert` is the consumer side: it posts to `ALERT_WEBHOOK_URL` (a
generic JSON POST — compatible with Slack/Discord incoming webhooks with a
small payload-shape adapter, or any internal alerting endpoint) when one is
configured, and always logs structurally either way so alerts are never
silently dropped just because no webhook is set up yet.
"""
from datetime import UTC, datetime
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()


def extract_critical_alerts(enriched: dict[str, Any]) -> list[dict[str, Any]]:
    """Returns one alert dict per CRITICAL violation in an enriched finding
    message, or an empty list if there are none."""
    alerts = []
    for v in enriched.get("violations", []):
        if v.get("severity") != "CRITICAL":
            continue
        alerts.append({
            "resource_urn": enriched["resource_urn"],
            "provider": enriched.get("provider"),
            "control_id": v["control_id"],
            "framework": v["framework"],
            "title": v["title"],
            "description": v["description"],
            "remediation": v["remediation"],
            "correlation_id": enriched.get("correlation_id"),
            "alerted_at": datetime.now(UTC).isoformat(),
        })
    return alerts


async def deliver_alert(alert: dict[str, Any]) -> None:
    logger.warning(
        "critical_alert",
        resource_urn=alert["resource_urn"],
        control_id=alert["control_id"],
        title=alert["title"],
    )
    if not settings.alert_webhook_url:
        return

    payload = {
        "text": (
            f"🚨 CRITICAL: {alert['title']}\n"
            f"Resource: {alert['resource_urn']} ({alert.get('provider', 'unknown')})\n"
            f"Control: {alert['control_id']} ({alert['framework']})\n"
            f"Remediation: {alert['remediation']}"
        ),
        **alert,
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(settings.alert_webhook_url, json=payload)
            resp.raise_for_status()
    except Exception as exc:
        logger.warning("alert_webhook_delivery_failed", error=str(exc))
