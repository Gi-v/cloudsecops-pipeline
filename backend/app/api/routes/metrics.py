"""Aggregate metrics powering the dashboard's KPI row and charts."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.schemas.schemas import DashboardMetrics, ScoreTrendPoint, TopRiskResource
from app.services import metrics_service

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/dashboard", response_model=DashboardMetrics)
async def dashboard_metrics(db: AsyncSession = Depends(get_db)) -> DashboardMetrics:
    return await metrics_service.dashboard_metrics(db)


@router.get("/cis-families")
async def cis_family_compliance(db: AsyncSession = Depends(get_db)) -> list[dict]:
    return await metrics_service.cis_family_compliance(db)


@router.get("/trend", response_model=list[ScoreTrendPoint])
async def security_score_trend(
    limit: int = Query(20, le=100), db: AsyncSession = Depends(get_db)
) -> list[ScoreTrendPoint]:
    return await metrics_service.security_score_trend(db, limit)


@router.get("/top-resources", response_model=list[TopRiskResource])
async def top_risk_resources(
    limit: int = Query(5, le=20), db: AsyncSession = Depends(get_db)
) -> list[TopRiskResource]:
    return await metrics_service.top_risk_resources(db, limit)


@router.get("/trend-by-provider")
async def trend_by_provider(
    limit: int = Query(20, le=100), db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """Security score per scan, split out per cloud provider — powers the
    Analytics page's per-provider comparison (AWS/GCP/Azure), distinct from
    the blended all-providers /trend endpoint above."""
    return await metrics_service.trend_by_provider(db, limit)


@router.get("/findings-timeline")
async def findings_timeline(
    days: int = Query(30, le=180), db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """Findings created per day, broken down by severity — powers the
    Analytics page's stacked-area chart."""
    return await metrics_service.findings_timeline(db, days)
