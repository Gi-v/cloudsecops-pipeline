"""Core scan logic: trigger a collection + evaluation pass. This is the
entrypoint of the whole pipeline: collect -> publish to findings.raw ->
(consumer) evaluate -> publish to findings.enriched -> (websocket) push to
dashboard.
"""
import time
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collectors.registry import all_collectors, get_collector
from app.core.logging import get_logger
from app.core.metrics import scans_triggered_total
from app.db.database import AsyncSessionLocal
from app.db.models import ScanRun
from app.kafka.producer import producer_client
from app.kafka.topics import FINDINGS_RAW

logger = get_logger(__name__)


async def run_scan(db: AsyncSession, provider: str | None) -> ScanRun:
    """Shared by the HTTP endpoint and the startup auto-seed hook in app.main."""
    correlation_id = uuid.uuid4().hex
    started = time.monotonic()

    scan_run = ScanRun(correlation_id=correlation_id, provider=provider, status="RUNNING")
    db.add(scan_run)
    await db.commit()
    await db.refresh(scan_run)
    scans_triggered_total.labels(provider=provider or "all").inc()

    collectors = [get_collector(provider)] if provider else all_collectors()

    total_resources = 0
    for collector in collectors:
        resources = await collector.collect()
        total_resources += len(resources)
        for res in resources:
            await producer_client.send(
                FINDINGS_RAW,
                {**res, "correlation_id": correlation_id},
                key=res["resource_urn"],
            )

    duration_ms = int((time.monotonic() - started) * 1000)
    scan_run.resources_scanned = total_resources
    scan_run.duration_ms = duration_ms
    scan_run.completed_at = datetime.now(UTC)
    scan_run.status = "PUBLISHED"  # evaluation happens async via the consumer
    await db.commit()
    await db.refresh(scan_run)

    logger.info(
        "scan_triggered",
        correlation_id=correlation_id,
        resources=total_resources,
        duration_ms=duration_ms,
    )
    return scan_run


async def run_scan_standalone(provider: str | None = None) -> ScanRun:
    """Same as run_scan but opens its own session — used by the startup
    auto-seed hook, which runs outside of a request/Depends context."""
    async with AsyncSessionLocal() as db:
        return await run_scan(db, provider)


async def list_scan_runs(db: AsyncSession, limit: int) -> list[ScanRun]:
    result = await db.execute(select(ScanRun).order_by(ScanRun.started_at.desc()).limit(limit))
    return list(result.scalars().all())


async def get_scan_run(db: AsyncSession, correlation_id: str) -> ScanRun | None:
    result = await db.execute(select(ScanRun).where(ScanRun.correlation_id == correlation_id))
    return result.scalar_one_or_none()
