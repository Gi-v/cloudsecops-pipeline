"""Trigger a collection + evaluation pass. This is the entrypoint of the
whole pipeline: collect → publish to findings.raw → (consumer) evaluate →
publish to findings.enriched → (websocket) push to dashboard.
"""
import time
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.collectors.registry import all_collectors, get_collector
from app.core.auth import require_api_key
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.rate_limit import limiter
from app.db.database import AsyncSessionLocal, get_db
from app.db.models import ScanRun
from app.kafka.producer import producer_client
from app.kafka.topics import FINDINGS_RAW
from app.schemas.schemas import ScanRequest, ScanRunOut

router = APIRouter(prefix="/api/scan", tags=["scan"])
logger = get_logger(__name__)
settings = get_settings()


async def run_scan(db: AsyncSession, provider: str | None) -> ScanRun:
    """Core scan logic, shared by the HTTP endpoint and the startup
    auto-seed hook in app.main."""
    correlation_id = uuid.uuid4().hex
    started = time.monotonic()

    scan_run = ScanRun(correlation_id=correlation_id, provider=provider, status="RUNNING")
    db.add(scan_run)
    await db.commit()
    await db.refresh(scan_run)

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


@router.post("", response_model=ScanRunOut, dependencies=[Depends(require_api_key)])
@limiter.limit(f"{settings.rate_limit_scan_per_minute}/minute")
async def trigger_scan(
    request: Request, req: ScanRequest, db: AsyncSession = Depends(get_db)
) -> ScanRunOut:
    scan_run = await run_scan(db, req.provider)
    return ScanRunOut.model_validate(scan_run)


@router.get("", response_model=list[ScanRunOut])
async def list_scan_runs(
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
) -> list[ScanRunOut]:
    result = await db.execute(select(ScanRun).order_by(ScanRun.started_at.desc()).limit(limit))
    return [ScanRunOut.model_validate(r) for r in result.scalars().all()]


@router.get("/{correlation_id}", response_model=ScanRunOut)
async def get_scan_run(correlation_id: str, db: AsyncSession = Depends(get_db)) -> ScanRunOut:
    result = await db.execute(select(ScanRun).where(ScanRun.correlation_id == correlation_id))
    scan_run = result.scalar_one_or_none()
    if scan_run is None:
        raise HTTPException(status_code=404, detail="Scan run not found")
    return ScanRunOut.model_validate(scan_run)
