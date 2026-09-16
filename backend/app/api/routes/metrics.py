"""Aggregate metrics powering the dashboard's KPI row and charts."""

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import Finding, Resource, ScanRun
from app.schemas.schemas import DashboardMetrics

router = APIRouter(prefix="/api/metrics", tags=["metrics"])

# CIS control family prefix -> friendly label, mirrors the dashboard's
# "CIS Benchmark v2 — Control Family Compliance" bars.
CIS_FAMILIES = {
    "CIS-1": "IAM & Identity",
    "CIS-2": "Storage & Data / Logging",
    "CIS-5": "Networking",
}


@router.get("/dashboard", response_model=DashboardMetrics)
async def dashboard_metrics(db: AsyncSession = Depends(get_db)) -> DashboardMetrics:
    total_findings_result = await db.execute(select(func.count(Finding.id)))
    total_findings = total_findings_result.scalar_one() or 0

    critical_result = await db.execute(
        select(func.count(Finding.id)).where(Finding.severity == "CRITICAL", Finding.passed == False)  # noqa: E712
    )
    critical_findings = critical_result.scalar_one() or 0

    resources_result = await db.execute(select(func.count(Resource.id)))
    resources_scanned = resources_result.scalar_one() or 0

    violations_result = await db.execute(
        select(func.count(Finding.id)).where(Finding.passed == False)  # noqa: E712
    )
    violations = violations_result.scalar_one() or 0
    controls_passing = max(total_findings - violations, 0)

    severity_result = await db.execute(
        select(Finding.severity, func.count(Finding.id))
        .where(Finding.passed == False)  # noqa: E712
        .group_by(Finding.severity)
    )
    severity_breakdown = {row[0].value: row[1] for row in severity_result.all()}

    framework_result = await db.execute(
        select(
            Finding.framework,
            func.count(Finding.id).label("total"),
            func.sum(case((Finding.passed == True, 1), else_=0)).label("passing"),  # noqa: E712
        ).group_by(Finding.framework)
    )
    framework_coverage = {}
    for row in framework_result.all():
        framework, total, passing = row
        if framework:
            framework_coverage[framework] = round((passing or 0) / total * 100, 1) if total else 0.0

    resolved_result = await db.execute(
        select(
            func.avg(
                func.extract("epoch", Finding.resolved_at - Finding.created_at) / 3600.0
            )
        ).where(Finding.resolved_at.is_not(None))
    )
    avg_mttr = resolved_result.scalar_one() or 0.0

    last_scan_result = await db.execute(
        select(func.max(ScanRun.completed_at))
    )
    last_scan_at = last_scan_result.scalar_one()

    # Security score: severity-weighted pass rate across every evaluated
    # control, not a flat per-violation penalty. The previous formula
    # (100 - sum of per-finding penalties) saturated to 0 as soon as open
    # findings numbered in the dozens — which they normally do on a
    # multi-cloud inventory — making the score permanently pinned at 0
    # regardless of whether 20% or 95% of controls were actually passing.
    # Weighting each control's pass/fail by its severity and expressing
    # the result as a percentage keeps the score meaningful (and matching
    # the "controls passing" ratio) at any finding volume.
    weights = {"CRITICAL": 5, "HIGH": 3, "MEDIUM": 2, "LOW": 1, "INFO": 0.5}
    severity_totals_result = await db.execute(
        select(
            Finding.severity,
            func.count(Finding.id),
            func.sum(case((Finding.passed == True, 1), else_=0)),  # noqa: E712
        ).group_by(Finding.severity)
    )
    weighted_total = 0.0
    weighted_pass = 0.0
    for sev, sev_total, sev_passing in severity_totals_result.all():
        w = weights.get(sev.value, 1)
        weighted_total += w * sev_total
        weighted_pass += w * (sev_passing or 0)
    security_score = round(100 * weighted_pass / weighted_total) if weighted_total else 100

    return DashboardMetrics(
        security_score=security_score,
        critical_findings=critical_findings,
        controls_passing=controls_passing,
        controls_total=total_findings,
        avg_mttr_hours=round(float(avg_mttr), 1),
        resources_scanned=resources_scanned,
        last_scan_at=last_scan_at,
        severity_breakdown=severity_breakdown,
        framework_coverage=framework_coverage,
    )


@router.get("/cis-families")
async def cis_family_compliance(db: AsyncSession = Depends(get_db)) -> list[dict]:
    result = await db.execute(
        select(
            Finding.control_id,
            func.count(Finding.id).label("total"),
            func.sum(case((Finding.passed == True, 1), else_=0)).label("passing"),  # noqa: E712
        )
        .where(Finding.framework == "CIS v2")
        .group_by(Finding.control_id)
    )

    family_totals: dict[str, dict[str, int]] = {}
    for control_id, total, passing in result.all():
        # bucket by first numeric family segment (e.g. CIS-2.1.2 -> CIS-2)
        parts = control_id.split("-")
        family_key = f"{parts[0]}-{parts[1].split('.')[0]}" if len(parts) > 1 else control_id
        bucket = family_totals.setdefault(family_key, {"total": 0, "passing": 0})
        bucket["total"] += total
        bucket["passing"] += passing or 0

    out = []
    for key, vals in family_totals.items():
        label = CIS_FAMILIES.get(key, key)
        pct = round(vals["passing"] / vals["total"] * 100, 1) if vals["total"] else 0.0
        out.append({
            "family": label,
            "control_count": vals["total"],
            "passing": vals["passing"],
            "percent": pct,
        })
    return out
