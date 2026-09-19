"""Findings CRUD — this backs the dashboard's filterable findings table."""
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_role
from app.db.database import get_db
from app.db.models import CloudProvider, FindingStatus, Severity
from app.schemas.schemas import (
    BulkFindingStatusUpdate,
    BulkUpdateResult,
    FindingOut,
    FindingStatusUpdate,
)
from app.services import findings_service

router = APIRouter(prefix="/findings", tags=["findings"])


@router.get("", response_model=list[FindingOut])
async def list_findings(
    response: Response,
    severity: Severity | None = None,
    provider: CloudProvider | None = None,
    framework: str | None = None,
    status: FindingStatus | None = None,
    search: str | None = Query(
        None, description="Free-text search over title, control ID, description"
    ),
    limit: int = Query(100, le=500),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
) -> list[FindingOut]:
    findings, total = await findings_service.list_findings(
        db, severity, provider, framework, status, search, limit, offset
    )
    response.headers["X-Total-Count"] = str(total)
    return [FindingOut.model_validate(f) for f in findings]


@router.get("/export.csv")
async def export_findings_csv(
    severity: Severity | None = None,
    provider: CloudProvider | None = None,
    framework: str | None = None,
    status: FindingStatus | None = None,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Streams every matching finding as CSV — this is the audit-package
    export ADR-003 describes (evidence hash included per row, so the export
    itself is independently verifiable against /api/v1/evidence/*/verify)."""
    csv_text = await findings_service.export_findings_csv(
        db, severity, provider, framework, status, search
    )
    filename = f"cloudsecops-findings-{datetime.now(UTC):%Y%m%d-%H%M%S}.csv"
    return StreamingResponse(
        iter([csv_text]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.patch(
    "/bulk-status", response_model=BulkUpdateResult, dependencies=[Depends(require_role("admin"))]
)
async def bulk_update_status(
    body: BulkFindingStatusUpdate, db: AsyncSession = Depends(get_db)
) -> BulkUpdateResult:
    if not body.finding_ids:
        raise HTTPException(status_code=400, detail="finding_ids must not be empty")
    if len(body.finding_ids) > 500:
        raise HTTPException(status_code=400, detail="Cannot update more than 500 findings at once")

    updated, not_found = await findings_service.bulk_update_status(
        db, body.finding_ids, body.status
    )
    return BulkUpdateResult(updated=updated, not_found=not_found)


@router.get("/{finding_id}", response_model=FindingOut)
async def get_finding(finding_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> FindingOut:
    finding = await findings_service.get_finding(db, finding_id)
    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found")
    return FindingOut.model_validate(finding)


@router.patch(
    "/{finding_id}/status",
    response_model=FindingOut,
    dependencies=[Depends(require_role("admin"))],
)
async def update_finding_status(
    finding_id: uuid.UUID, body: FindingStatusUpdate, db: AsyncSession = Depends(get_db)
) -> FindingOut:
    finding = await findings_service.update_finding_status(db, finding_id, body.status)
    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found")
    return FindingOut.model_validate(finding)
