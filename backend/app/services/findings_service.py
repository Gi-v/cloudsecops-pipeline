"""Business logic for findings: filtering, CSV export, status transitions."""
import csv
import io
import uuid
from datetime import UTC, datetime

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CloudProvider, Finding, FindingStatus, Resource, Severity


def build_filtered_stmt(
    severity: Severity | None,
    provider: CloudProvider | None,
    framework: str | None,
    status: FindingStatus | None,
    search: str | None = None,
) -> Select:
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


async def list_findings(
    db: AsyncSession,
    severity: Severity | None,
    provider: CloudProvider | None,
    framework: str | None,
    status: FindingStatus | None,
    search: str | None,
    limit: int,
    offset: int,
) -> tuple[list[Finding], int]:
    base_stmt = build_filtered_stmt(severity, provider, framework, status, search)

    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = base_stmt.order_by(Finding.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all()), total


async def export_findings_csv(
    db: AsyncSession,
    severity: Severity | None,
    provider: CloudProvider | None,
    framework: str | None,
    status: FindingStatus | None,
    search: str | None,
) -> str:
    """Renders every matching finding as CSV text — this is the audit-package
    export ADR-003 describes (evidence hash included per row, so the export
    itself is independently verifiable against /api/v1/evidence/*/verify)."""
    stmt = build_filtered_stmt(severity, provider, framework, status, search).order_by(
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
    return buffer.getvalue()


async def bulk_update_status(
    db: AsyncSession, finding_ids: list[uuid.UUID], status: str
) -> tuple[int, list[uuid.UUID]]:
    result = await db.execute(select(Finding).where(Finding.id.in_(finding_ids)))
    findings = result.scalars().all()
    found_ids = {f.id for f in findings}
    not_found = [fid for fid in finding_ids if fid not in found_ids]

    now = datetime.now(UTC)
    for f in findings:
        f.status = FindingStatus(status)
        if status == "RESOLVED":
            f.resolved_at = now
    await db.commit()

    return len(findings), not_found


async def get_finding(db: AsyncSession, finding_id: uuid.UUID) -> Finding | None:
    return await db.get(Finding, finding_id)


async def update_finding_status(
    db: AsyncSession, finding_id: uuid.UUID, status: str
) -> Finding | None:
    finding = await db.get(Finding, finding_id)
    if finding is None:
        return None

    finding.status = FindingStatus(status)
    if status == "RESOLVED":
        finding.resolved_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(finding)
    return finding
