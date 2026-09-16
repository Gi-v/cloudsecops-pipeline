"""Read-only endpoints over collected resources."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import CloudProvider, Resource
from app.schemas.schemas import ResourceOut

router = APIRouter(prefix="/api/resources", tags=["resources"])


@router.get("", response_model=list[ResourceOut])
async def list_resources(
    response: Response,
    provider: CloudProvider | None = None,
    resource_type: str | None = None,
    search: str | None = Query(None, description="Free-text search over resource URN"),
    limit: int = Query(100, le=500),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
) -> list[ResourceOut]:
    base_stmt = select(Resource)
    if provider:
        base_stmt = base_stmt.where(Resource.provider == provider)
    if resource_type:
        base_stmt = base_stmt.where(Resource.resource_type == resource_type)
    if search:
        base_stmt = base_stmt.where(Resource.resource_urn.ilike(f"%{search}%"))

    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()
    response.headers["X-Total-Count"] = str(total)

    stmt = base_stmt.order_by(Resource.last_scanned_at.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    return [ResourceOut.model_validate(r) for r in result.scalars().all()]


@router.get("/{resource_id}", response_model=ResourceOut)
async def get_resource(resource_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> ResourceOut:
    resource = await db.get(Resource, resource_id)
    if resource is None:
        raise HTTPException(status_code=404, detail="Resource not found")
    return ResourceOut.model_validate(resource)
