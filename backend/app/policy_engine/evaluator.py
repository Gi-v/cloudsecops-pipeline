"""Orchestrates one resource's journey from raw collector output through
policy evaluation, persistence, and evidence archival. This is the consumer
callback wired to the `findings.raw` topic in app.main's startup.
"""
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.db.models import CloudProvider, Finding, FindingStatus, Resource, ScanRun, Severity
from app.evidence.store import evidence_store
from app.policy_engine.catalog import CONTROL_BY_ID
from app.policy_engine.opa_client import opa_client

logger = get_logger(__name__)


async def upsert_resource(db: AsyncSession, raw: dict[str, Any]) -> Resource:
    result = await db.execute(
        select(Resource).where(Resource.resource_urn == raw["resource_urn"])
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.raw_config = raw["config"]
        existing.last_scanned_at = datetime.now(UTC)
        await db.flush()
        return existing

    resource = Resource(
        resource_urn=raw["resource_urn"],
        provider=CloudProvider(raw["provider"]),
        resource_type=raw["resource_type"],
        region=raw["region"],
        account_id=raw["account_id"],
        raw_config=raw["config"],
    )
    db.add(resource)
    await db.flush()
    return resource


async def evaluate_and_persist(
    db: AsyncSession, raw_resource: dict[str, Any], correlation_id: str
) -> dict[str, Any]:
    """Full pipeline for one resource: upsert → evaluate → persist findings →
    archive evidence. Returns an enriched dict suitable for publishing to
    `findings.enriched`.
    """
    resource = await upsert_resource(db, raw_resource)

    eval_input = {
        "resource_type": raw_resource["resource_type"],
        "config": raw_resource["config"],
    }
    result = await opa_client.evaluate(eval_input)
    violations = result.get("violations", [])
    passed_controls = result.get("passed_controls", [])

    created_findings: list[dict[str, Any]] = []

    for v in violations:
        finding = Finding(
            resource_id=resource.id,
            control_id=v["control_id"],
            framework=v["framework"],
            severity=Severity(v["severity"]),
            status=FindingStatus.OPEN,
            title=v["title"],
            description=v["description"],
            remediation=v["remediation"],
            passed=False,
            correlation_id=correlation_id,
        )
        db.add(finding)
        await db.flush()

        evidence = await evidence_store.archive(
            db,
            resource_urn=resource.resource_urn,
            finding_id=finding.id,
            payload={
                "resource_urn": resource.resource_urn,
                "control_id": finding.control_id,
                "framework": finding.framework,
                "severity": finding.severity.value,
                "passed": False,
                "config_snapshot": raw_resource["config"],
                "evaluated_at": datetime.now(UTC).isoformat(),
            },
        )
        finding.evidence_hash = evidence.content_hash

        created_findings.append({
            "id": str(finding.id),
            "resource_urn": resource.resource_urn,
            "control_id": finding.control_id,
            "framework": finding.framework,
            "severity": finding.severity.value,
            "title": finding.title,
            "passed": False,
            "evidence_hash": evidence.content_hash,
        })

    for control_id in passed_controls:
        catalog_entry = CONTROL_BY_ID.get(control_id, {})
        framework = catalog_entry.get("framework", "")
        title = catalog_entry.get("title", control_id)

        # Persisted as a real Finding row (passed=True) — this used to only
        # get appended to the in-memory `created_findings` list for the
        # Kafka message, never written to the database, which meant
        # "Controls Passing" and every framework's coverage % were
        # permanently stuck at 0 regardless of how many controls actually
        # passed (the dashboard metrics queries count Finding rows, and no
        # passing rows ever existed to count).
        finding = Finding(
            resource_id=resource.id,
            control_id=control_id,
            framework=framework,
            severity=Severity.INFO,
            status=FindingStatus.RESOLVED,
            title=title,
            description=f"{title} — control satisfied, no violation detected.",
            remediation="No action needed.",
            passed=True,
            correlation_id=correlation_id,
        )
        db.add(finding)
        await db.flush()

        created_findings.append({
            "id": str(finding.id),
            "resource_urn": resource.resource_urn,
            "control_id": control_id,
            "framework": framework,
            "severity": "INFO",
            "title": title,
            "passed": True,
            "evidence_hash": None,
        })

    # ScanRun.findings_created / violations_found are set to 0 when the run
    # is created (app/api/routes/scan.py) and never touched again — the
    # actual evaluation happens here, asynchronously per-resource via the
    # Kafka consumer, well after the HTTP response for the scan already went
    # out. Update the row's running totals as each resource's evaluation
    # lands so GET /api/scan/{correlation_id} reflects real counts instead
    # of being permanently stuck at 0. Uses an UPDATE ... SET x = x + n
    # (not a read-modify-write) since many resources evaluate concurrently.
    await db.execute(
        update(ScanRun)
        .where(ScanRun.correlation_id == correlation_id)
        .values(
            findings_created=ScanRun.findings_created + len(created_findings),
            violations_found=ScanRun.violations_found + len(violations),
        )
    )
    await db.commit()

    logger.info(
        "resource_evaluated",
        resource_urn=resource.resource_urn,
        violations=len(violations),
        passed=len(passed_controls),
        correlation_id=correlation_id,
    )

    return {
        "correlation_id": correlation_id,
        "resource_urn": resource.resource_urn,
        "resource_type": resource.resource_type,
        "provider": resource.provider.value,
        "violations": violations,
        "passed_controls": passed_controls,
        "findings": created_findings,
        "evaluated_at": datetime.now(UTC).isoformat(),
    }
