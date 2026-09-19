"""Business logic for read-only resource listing/lookup."""
import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import CloudProvider, Resource


async def list_resources(
    db: AsyncSession,
    provider: CloudProvider | None,
    resource_type: str | None,
    search: str | None,
    limit: int,
    offset: int,
) -> tuple[list[Resource], int]:
    base_stmt = select(Resource)
    if provider:
        base_stmt = base_stmt.where(Resource.provider == provider)
    if resource_type:
        base_stmt = base_stmt.where(Resource.resource_type == resource_type)
    if search:
        base_stmt = base_stmt.where(Resource.resource_urn.ilike(f"%{search}%"))

    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = base_stmt.order_by(Resource.last_scanned_at.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all()), total


async def get_resource(db: AsyncSession, resource_id: uuid.UUID) -> Resource | None:
    return await db.get(Resource, resource_id)
