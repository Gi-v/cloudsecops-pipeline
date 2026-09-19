"""HTTP-level tests for /api/evidence against a real Postgres database,
exercising the actual EvidenceStore singleton (app.evidence.store) rather
than mocking it — the hash-chain math already had pure-function unit tests
(test_evidence_store.py), but archive()/verify_chain() themselves, and the
tamper-detection path specifically, never ran against a real chain before.

Each test uses a uuid-random resource URN, so blobs land in whichever
backing store the running EvidenceStore singleton resolved at import time
(real MinIO if the dev stack's container is up, local disk under
.data/evidence/ otherwise) without ever colliding with real demo data —
these are orphan test blobs under URNs no real Resource/Finding row
references, left in place rather than cleaned up (same trade-off this
project already makes for the local-disk fallback path in dev)."""
import uuid

from app.db.models import EvidenceRecord
from app.evidence.store import evidence_store


def _urn() -> str:
    return f"arn:aws:s3:::test-evidence-{uuid.uuid4().hex[:10]}"


async def test_verify_chain_valid_when_empty(db_client):
    resp = db_client.get(f"/api/v1/evidence/{_urn()}/verify")
    assert resp.status_code == 200
    body = resp.json()
    assert body["valid"] is True
    assert body["chain_length"] == 0


async def test_archive_then_list_returns_records_in_sequence_order(db_session, db_client):
    urn = _urn()
    await evidence_store.archive(db_session, urn, None, {"finding": "first"})
    await evidence_store.archive(db_session, urn, None, {"finding": "second"})
    await db_session.commit()

    resp = db_client.get(f"/api/v1/evidence/{urn}")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 2
    assert [r["sequence"] for r in body] == [0, 1]
    # Each record's prev_hash should chain to the previous record's hash.
    assert body[1]["prev_hash"] == body[0]["content_hash"]


async def test_verify_chain_valid_for_untampered_chain(db_session, db_client):
    urn = _urn()
    await evidence_store.archive(db_session, urn, None, {"finding": "a"})
    await evidence_store.archive(db_session, urn, None, {"finding": "b"})
    await evidence_store.archive(db_session, urn, None, {"finding": "c"})
    await db_session.commit()

    resp = db_client.get(f"/api/v1/evidence/{urn}/verify")
    body = resp.json()
    assert body["valid"] is True
    assert body["chain_length"] == 3
    assert body["broken_at_sequence"] is None


async def test_verify_chain_detects_content_hash_tampering(db_session, db_client):
    """Simulates exactly the threat model ADR-003 exists for: someone edits
    a historical evidence row directly in the database (not through the
    archive() API) to cover their tracks. content_hash is the DB's own
    record of what the blob's hash *should* be — tampering with the row
    itself (not the blob) still gets caught, because verify_chain
    recomputes the hash from the untouched blob and compares."""
    urn = _urn()
    await evidence_store.archive(db_session, urn, None, {"finding": "original"})
    await db_session.commit()

    result = await db_session.execute(
        EvidenceRecord.__table__.select().where(EvidenceRecord.resource_urn == urn)
    )
    record = result.first()
    await db_session.execute(
        EvidenceRecord.__table__.update()
        .where(EvidenceRecord.id == record.id)
        .values(content_hash="0" * 64)
    )
    await db_session.commit()

    resp = db_client.get(f"/api/v1/evidence/{urn}/verify")
    body = resp.json()
    assert body["valid"] is False
    assert body["broken_at_sequence"] == 0
    assert "altered" in body["message"].lower() or "mismatch" in body["message"].lower()


async def test_verify_chain_detects_broken_prev_hash_link(db_session, db_client):
    urn = _urn()
    await evidence_store.archive(db_session, urn, None, {"finding": "a"})
    await evidence_store.archive(db_session, urn, None, {"finding": "b"})
    await db_session.commit()

    result = await db_session.execute(
        EvidenceRecord.__table__.select()
        .where(EvidenceRecord.resource_urn == urn)
        .where(EvidenceRecord.sequence == 1)
    )
    second_record = result.first()
    await db_session.execute(
        EvidenceRecord.__table__.update()
        .where(EvidenceRecord.id == second_record.id)
        .values(prev_hash="f" * 64)
    )
    await db_session.commit()

    resp = db_client.get(f"/api/v1/evidence/{urn}/verify")
    body = resp.json()
    assert body["valid"] is False
    assert body["broken_at_sequence"] == 1
