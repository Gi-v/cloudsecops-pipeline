"""Evidence chain read + verification endpoints (ADR-003)."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.schemas.schemas import EvidenceRecordOut, EvidenceVerifyResult
from app.services import evidence_service

router = APIRouter(prefix="/evidence", tags=["evidence"])


@router.get("/{resource_urn:path}/verify", response_model=EvidenceVerifyResult)
async def verify_evidence_chain(
    resource_urn: str, db: AsyncSession = Depends(get_db)
) -> EvidenceVerifyResult:
    result = await evidence_service.verify_chain(db, resource_urn)
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
    records = await evidence_service.list_evidence(db, resource_urn)
    return [EvidenceRecordOut.model_validate(r) for r in records]
