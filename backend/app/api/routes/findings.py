"""Findings CRUD — this backs the dashboard's filterable findings table."""
import csv
import io
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import require_api_key
from app.db.database import get_db
from app.db.models import CloudProvider, Finding, FindingStatus, Resource, Severity
from app.schemas.schemas import (
    BulkFindingStatusUpdate,
    BulkUpdateResult,
    FindingOut,
    FindingStatusUpdate,
)

router = APIRouter(prefix="/api/findings", tags=["findings"])


def _build_filtered_stmt(
    severity: Severity | None,
    provider: CloudProvider | None,
    framework: str | None,
    status: FindingStatus | None,
    search: str | None = None,
):
    # `Finding` rows are "a policy evaluation result for one resource
    # against one control" (see db/models.py) — every scan writes one row
    # per control regardless of outcome, so passing evaluations live in
    # this same table as violations. The Findings page is documented and
    # presented as "every open, resolved, and suppressed policy
    # violation," and its RESOLVED/SUPPRESSED workflow only makes sense
    # for violations, so this endpoint (and its CSV export, which shares
    # this builder) excludes passing rows rather than listing every
    # evaluated control.
    stmt = select(Finding).where(Finding.passed == False)  # noqa: E712
    if provider:
        stmt = stmt.join(Resource).where(Resource.provider == provider)
    if severity:
        stmt = stmt.where(Finding.severity == severity)
    if framework:
        stmt = stmt.where(Finding.framework == framework)
    if status:
        stmt = stmt.where(Finding.status == status)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            or_(
                Finding.title.ilike(like),
                Finding.control_id.ilike(like),
                Finding.description.ilike(like),
            )
        )
    return stmt


@router.get("", response_model=list[FindingOut])
async def list_findings(
    response: Response,
    severity: Severity | None = None,
    provider: CloudProvider | None = None,
    framework: str | None = None,
    status: FindingStatus | None = None,
    search: str | None = Query(None, description="Free-text search over title, control ID, description"),
    limit: int = Query(100, le=500),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
) -> list[FindingOut]:
    base_stmt = _build_filtered_stmt(severity, provider, framework, status, search)

    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()
    response.headers["X-Total-Count"] = str(total)

    stmt = base_stmt.order_by(Finding.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    return [FindingOut.model_validate(f) for f in result.scalars().all()]


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
    itself is independently verifiable against /api/evidence/*/verify)."""
    stmt = _build_filtered_stmt(severity, provider, framework, status, search).order_by(
        Finding.created_at.desc()
    )
    result = await db.execute(stmt)
    findings = result.scalars().all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "control_id", "framework", "severity", "status", "title",
        "description", "remediation", "evidence_hash", "created_at", "resolved_at",
    ])
    for f in findings:
        writer.writerow([
            f.control_id, f.framework, f.severity.value, f.status.value, f.title,
            f.description, f.remediation, f.evidence_hash or "", f.created_at.isoformat(),
            f.resolved_at.isoformat() if f.resolved_at else "",
        ])
    buffer.seek(0)

    filename = f"cloudsecops-findings-{datetime.now(UTC):%Y%m%d-%H%M%S}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.patch(
    "/bulk-status", response_model=BulkUpdateResult, dependencies=[Depends(require_api_key)]
)
async def bulk_update_status(
    body: BulkFindingStatusUpdate, db: AsyncSession = Depends(get_db)
) -> BulkUpdateResult:
    if not body.finding_ids:
        raise HTTPException(status_code=400, detail="finding_ids must not be empty")
    if len(body.finding_ids) > 500:
        raise HTTPException(status_code=400, detail="Cannot update more than 500 findings at once")

    result = await db.execute(select(Finding).where(Finding.id.in_(body.finding_ids)))
    findings = result.scalars().all()
    found_ids = {f.id for f in findings}
    not_found = [fid for fid in body.finding_ids if fid not in found_ids]

    now = datetime.now(UTC)
    for f in findings:
        f.status = FindingStatus(body.status)
        if body.status == "RESOLVED":
            f.resolved_at = now
    await db.commit()

    return BulkUpdateResult(updated=len(findings), not_found=not_found)


@router.get("/{finding_id}", response_model=FindingOut)
async def get_finding(finding_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> FindingOut:
    finding = await db.get(Finding, finding_id)
    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found")
    return FindingOut.model_validate(finding)


@router.patch(
    "/{finding_id}/status", response_model=FindingOut, dependencies=[Depends(require_api_key)]
)
async def update_finding_status(
    finding_id: uuid.UUID, body: FindingStatusUpdate, db: AsyncSession = Depends(get_db)
) -> FindingOut:
    finding = await db.get(Finding, finding_id)
    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found")

    finding.status = FindingStatus(body.status)
    if body.status == "RESOLVED":
        finding.resolved_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(finding)
    return FindingOut.model_validate(finding)
