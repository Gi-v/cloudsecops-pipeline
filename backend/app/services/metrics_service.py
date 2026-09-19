"""Aggregate metrics powering the dashboard's KPI row and charts."""

import uuid

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.metrics import security_score_current
from app.db.models import Finding, Resource, ScanRun, Severity
from app.schemas.schemas import DashboardMetrics, ScoreTrendPoint, TopRiskResource

# CIS control family prefix -> friendly label, mirrors the dashboard's
# "CIS Benchmark v2 — Control Family Compliance" bars.
CIS_FAMILIES = {
    "CIS-1": "IAM & Identity",
    "CIS-2": "Storage & Data / Logging",
    "CIS-5": "Networking",
}

# Shared by the dashboard's headline score and the trend endpoint below —
# a control's contribution to "how secure is this environment" shouldn't
# depend on which endpoint happened to compute it. This is weighted rather
# than a flat pass rate: a flat rate lets a thousand passing LOW-severity
# checks bury one failing CRITICAL one.
SEVERITY_WEIGHT = {"CRITICAL": 5, "HIGH": 3, "MEDIUM": 2, "LOW": 1, "INFO": 0.5}
SEVERITY_RANK = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1, "INFO": 0}


def weighted_score(rows: list[tuple[Severity, int, int]]) -> int:
    """rows: (severity, total_evaluated, total_passing) per severity bucket.
    Returns the severity-weighted pass rate as an integer 0-100 (100 when
    there's nothing to evaluate yet, rather than a misleading 0)."""
    weighted_total = 0.0
    weighted_pass = 0.0
    for severity, total, passing in rows:
        w = SEVERITY_WEIGHT.get(severity.value, 1)
        weighted_total += w * total
        weighted_pass += w * passing
    return round(100 * weighted_pass / weighted_total) if weighted_total else 100


async def dashboard_metrics(db: AsyncSession) -> DashboardMetrics:
    total_findings_result = await db.execute(select(func.count(Finding.id)))
    total_findings = total_findings_result.scalar_one() or 0

    critical_result = await db.execute(
        select(func.count(Finding.id)).where(
            Finding.severity == "CRITICAL", Finding.passed == False  # noqa: E712
        )
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

    last_scan_result = await db.execute(select(func.max(ScanRun.completed_at)))
    last_scan_at = last_scan_result.scalar_one()

    severity_totals_result = await db.execute(
        select(
            Finding.severity,
            func.count(Finding.id),
            func.sum(case((Finding.passed == True, 1), else_=0)),  # noqa: E712
        ).group_by(Finding.severity)
    )
    security_score = weighted_score(
        [(sev, total, passing or 0) for sev, total, passing in severity_totals_result.all()]
    )
    security_score_current.set(security_score)

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


async def cis_family_compliance(db: AsyncSession) -> list[dict]:
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


async def security_score_trend(db: AsyncSession, limit: int) -> list[ScoreTrendPoint]:
    """The dashboard's headline score is a single snapshot; this is the same
    score computed per scan, oldest first, so the frontend can chart whether
    the environment's compliance posture is actually improving — not just
    what it is right now."""
    runs_result = await db.execute(
        select(ScanRun)
        .where(ScanRun.completed_at.is_not(None))
        .order_by(ScanRun.completed_at.desc())
        .limit(limit)
    )
    runs = list(reversed(runs_result.scalars().all()))
    if not runs:
        return []

    correlation_ids = [r.correlation_id for r in runs]
    findings_result = await db.execute(
        select(
            Finding.correlation_id,
            Finding.severity,
            func.count(Finding.id),
            func.sum(case((Finding.passed == True, 1), else_=0)),  # noqa: E712
        )
        .where(Finding.correlation_id.in_(correlation_ids))
        .group_by(Finding.correlation_id, Finding.severity)
    )
    by_run: dict[str, list[tuple[Severity, int, int]]] = {}
    for correlation_id, severity, total, passing in findings_result.all():
        by_run.setdefault(correlation_id, []).append((severity, total, passing or 0))

    # Distinct resources touched per scan — a separate query because the
    # findings query above groups by severity too (one resource with a
    # CRITICAL and a LOW finding would otherwise be counted twice).
    resource_counts_result = await db.execute(
        select(Finding.correlation_id, func.count(func.distinct(Finding.resource_id)))
        .where(Finding.correlation_id.in_(correlation_ids))
        .group_by(Finding.correlation_id)
    )
    resources_by_run = dict(resource_counts_result.all())

    points = []
    for run in runs:
        rows = by_run.get(run.correlation_id, [])
        total_evaluated = sum(total for _, total, _ in rows)
        total_passing = sum(passing for _, _, passing in rows)
        critical_open = sum(
            total - passing for sev, total, passing in rows if sev.value == "CRITICAL"
        )
        points.append(
            ScoreTrendPoint(
                correlation_id=run.correlation_id,
                completed_at=run.completed_at,
                security_score=weighted_score(rows),
                controls_passing=total_passing,
                controls_total=total_evaluated,
                critical_findings=critical_open,
                resources_scanned=resources_by_run.get(run.correlation_id, 0),
            )
        )
    return points


async def top_risk_resources(db: AsyncSession, limit: int) -> list[TopRiskResource]:
    """Which resources need attention first — ranked by severity-weighted
    open-finding count, not just raw count (one open CRITICAL outranks five
    open LOWs), reusing the same SEVERITY_WEIGHT table as the score itself
    so "risky" means the same thing everywhere on the dashboard."""
    result = await db.execute(
        select(
            Resource.id,
            Resource.resource_urn,
            Resource.provider,
            Resource.resource_type,
            Finding.severity,
            func.count(Finding.id),
        )
        .join(Finding, Finding.resource_id == Resource.id)
        .where(Finding.passed == False)  # noqa: E712
        .group_by(Resource.id, Finding.severity)
    )

    by_resource: dict[uuid.UUID, dict] = {}
    for rid, urn, provider, rtype, severity, count in result.all():
        entry = by_resource.setdefault(
            rid,
            {
                "resource_id": rid,
                "resource_urn": urn,
                "provider": provider,
                "resource_type": rtype,
                "open_findings": 0,
                "risk_score": 0.0,
                "worst_severity": "INFO",
            },
        )
        entry["open_findings"] += count
        entry["risk_score"] += SEVERITY_WEIGHT.get(severity.value, 1) * count
        if SEVERITY_RANK[severity.value] > SEVERITY_RANK[entry["worst_severity"]]:
            entry["worst_severity"] = severity.value

    ranked = sorted(by_resource.values(), key=lambda e: e["risk_score"], reverse=True)[:limit]
    return [TopRiskResource(**r) for r in ranked]


async def findings_timeline(db: AsyncSession, days: int) -> list[dict]:
    """Findings created per day, broken down by severity — feeds the
    Analytics page's stacked-area chart. Computed from data already written
    by every scan, no new tables (same discipline as trend/top-resources)."""
    result = await db.execute(
        select(
            func.date_trunc("day", Finding.created_at).label("day"),
            Finding.severity,
            func.count(Finding.id),
        )
        .where(Finding.passed == False)  # noqa: E712
        .group_by("day", Finding.severity)
        .order_by("day")
    )
    by_day: dict[str, dict[str, int]] = {}
    for day, severity, count in result.all():
        key = day.date().isoformat()
        bucket = by_day.setdefault(key, {})
        bucket[severity.value] = count

    days_sorted = sorted(by_day.keys())[-days:]
    return [{"date": d, "severities": by_day[d]} for d in days_sorted]


async def trend_by_provider(db: AsyncSession, limit: int) -> list[dict]:
    """Security score per scan, split out per cloud provider — lets the
    Analytics page compare AWS/GCP/Azure posture over time instead of only
    the blended, all-providers trend."""
    runs_result = await db.execute(
        select(ScanRun)
        .where(ScanRun.completed_at.is_not(None), ScanRun.provider.is_not(None))
        .order_by(ScanRun.completed_at.desc())
        .limit(limit)
    )
    runs = list(reversed(runs_result.scalars().all()))
    if not runs:
        return []

    correlation_ids = [r.correlation_id for r in runs]
    result = await db.execute(
        select(
            Finding.correlation_id,
            Finding.severity,
            func.count(Finding.id),
            func.sum(case((Finding.passed == True, 1), else_=0)),  # noqa: E712
        )
        .where(Finding.correlation_id.in_(correlation_ids))
        .group_by(Finding.correlation_id, Finding.severity)
    )
    by_run: dict[str, list[tuple[Severity, int, int]]] = {}
    for correlation_id, severity, total, passing in result.all():
        by_run.setdefault(correlation_id, []).append((severity, total, passing or 0))

    return [
        {
            "correlation_id": run.correlation_id,
            "provider": run.provider.value if run.provider else None,
            "completed_at": run.completed_at,
            "security_score": weighted_score(by_run.get(run.correlation_id, [])),
        }
        for run in runs
    ]
