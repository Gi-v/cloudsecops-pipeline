"""Business logic for evidence-chain reads + verification (ADR-003).
`EvidenceStore` (app/evidence/store.py) already is a service in its own
right — this module just wraps it plus the one inline listing query the
route used to run directly.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.metrics import evidence_chain_verifications_total
from app.db.models import EvidenceRecord
from app.evidence.store import evidence_store


async def list_evidence(db: AsyncSession, resource_urn: str) -> list[EvidenceRecord]:
    result = await db.execute(
        select(EvidenceRecord)
        .where(EvidenceRecord.resource_urn == resource_urn)
        .order_by(EvidenceRecord.sequence.asc())
    )
    return list(result.scalars().all())


async def verify_chain(db: AsyncSession, resource_urn: str) -> dict:
    result = await evidence_store.verify_chain(db, resource_urn)
    evidence_chain_verifications_total.labels(result="valid" if result["valid"] else "broken").inc()
    return result
