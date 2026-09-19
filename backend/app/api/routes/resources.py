"""Read-only endpoints over collected resources."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import CloudProvider
from app.schemas.schemas import ResourceOut
from app.services import resources_service

router = APIRouter(prefix="/resources", tags=["resources"])


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
    resources, total = await resources_service.list_resources(
        db, provider, resource_type, search, limit, offset
    )
    response.headers["X-Total-Count"] = str(total)
    return [ResourceOut.model_validate(r) for r in resources]


@router.get("/{resource_id}", response_model=ResourceOut)
async def get_resource(resource_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> ResourceOut:
    resource = await resources_service.get_resource(db, resource_id)
    if resource is None:
        raise HTTPException(status_code=404, detail="Resource not found")
    return ResourceOut.model_validate(resource)
