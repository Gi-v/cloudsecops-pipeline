"""Evidence chain read + verification endpoints (ADR-003)."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import EvidenceRecord
from app.evidence.store import evidence_store
from app.schemas.schemas import EvidenceRecordOut, EvidenceVerifyResult

router = APIRouter(prefix="/api/evidence", tags=["evidence"])


@router.get("/{resource_urn:path}/verify", response_model=EvidenceVerifyResult)
async def verify_evidence_chain(
    resource_urn: str, db: AsyncSession = Depends(get_db)
) -> EvidenceVerifyResult:
    result = await evidence_store.verify_chain(db, resource_urn)
    return EvidenceVerifyResult(**result)


# Declared AFTER /verify on purpose: {resource_urn:path} is a greedy
# converter that matches slashes too, so if this route were registered
# first it would swallow "<urn>/verify" requests as well — treating
# "verify" as part of the URN, finding no matching records, and silently
# returning an empty list instead of ever reaching the handler above.
@router.get("/{resource_urn:path}", response_model=list[EvidenceRecordOut])
async def list_evidence(
    resource_urn: str, db: AsyncSession = Depends(get_db)
) -> list[EvidenceRecordOut]:
    result = await db.execute(
        select(EvidenceRecord)
        .where(EvidenceRecord.resource_urn == resource_urn)
        .order_by(EvidenceRecord.sequence.asc())
    )
    return [EvidenceRecordOut.model_validate(r) for r in result.scalars().all()]
