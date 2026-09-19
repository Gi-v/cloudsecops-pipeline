"""Trigger a collection + evaluation pass. This is the entrypoint of the
whole pipeline: collect → publish to findings.raw → (consumer) evaluate →
publish to findings.enriched → (websocket) push to dashboard.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.rate_limit import limiter
from app.core.security import require_role
from app.db.database import get_db
from app.schemas.schemas import ScanRequest, ScanRunOut
from app.services import scan_service

router = APIRouter(prefix="/scan", tags=["scan"])
settings = get_settings()


@router.post("", response_model=ScanRunOut, dependencies=[Depends(require_role("admin"))])
@limiter.limit(f"{settings.rate_limit_scan_per_minute}/minute")
async def trigger_scan(
    request: Request, req: ScanRequest, db: AsyncSession = Depends(get_db)
) -> ScanRunOut:
    scan_run = await scan_service.run_scan(db, req.provider)
    return ScanRunOut.model_validate(scan_run)


@router.get("", response_model=list[ScanRunOut])
async def list_scan_runs(
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
) -> list[ScanRunOut]:
    runs = await scan_service.list_scan_runs(db, limit)
    return [ScanRunOut.model_validate(r) for r in runs]


@router.get("/{correlation_id}", response_model=ScanRunOut)
async def get_scan_run(correlation_id: str, db: AsyncSession = Depends(get_db)) -> ScanRunOut:
    scan_run = await scan_service.get_scan_run(db, correlation_id)
    if scan_run is None:
        raise HTTPException(status_code=404, detail="Scan run not found")
    return ScanRunOut.model_validate(scan_run)
