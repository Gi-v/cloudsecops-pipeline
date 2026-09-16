"""Tamper-evident evidence store — MinIO (S3-compatible blob storage) +
Postgres index, linked into a per-resource SHA-256 hash chain (ADR-003).

Each evidence blob's content_hash = sha256(canonical_json(payload) + prev_hash).
Altering any historical blob changes its hash, which no longer matches what
the next record in the chain recorded as prev_hash — `verify_chain` detects
exactly where a chain breaks.

Falls back to local-disk storage under `.data/evidence/` when MinIO is
unreachable, so evidence archival works in a zero-dependency local run.
"""
import hashlib
import json
import re
from pathlib import Path
from typing import TYPE_CHECKING, Any

import orjson
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.models import EvidenceRecord

if TYPE_CHECKING:
    from minio import Minio

logger = get_logger(__name__)

LOCAL_FALLBACK_DIR = Path(".data/evidence")
GENESIS_HASH = "0" * 64


def _safe_urn(urn: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_.-]", "_", urn)


def _canonical_bytes(payload: dict[str, Any]) -> bytes:
    return orjson.dumps(payload, option=orjson.OPT_SORT_KEYS)


def _content_hash(payload: dict[str, Any], prev_hash: str) -> str:
    h = hashlib.sha256()
    h.update(_canonical_bytes(payload))
    h.update(prev_hash.encode())
    return h.hexdigest()


class EvidenceStore:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._minio: "Minio | None" = None
        self._available = False
        self._init_minio()

    def _init_minio(self) -> None:
        try:
            from minio import Minio

            self._minio = Minio(
                self.settings.minio_endpoint,
                access_key=self.settings.minio_access_key,
                secret_key=self.settings.minio_secret_key,
                secure=self.settings.minio_secure,
            )
            if not self._minio.bucket_exists(self.settings.minio_bucket):
                self._minio.make_bucket(self.settings.minio_bucket)
            self._available = True
            logger.info("evidence_store_minio_ready", bucket=self.settings.minio_bucket)
        except Exception as exc:
            logger.warning("evidence_store_minio_unavailable_using_local_fallback", error=str(exc))
            self._available = False
            LOCAL_FALLBACK_DIR.mkdir(parents=True, exist_ok=True)

    def _put_blob(self, object_key: str, payload: dict[str, Any]) -> None:
        data = _canonical_bytes(payload)
        if self._available and self._minio is not None:
            import io

            self._minio.put_object(
                self.settings.minio_bucket,
                object_key,
                io.BytesIO(data),
                length=len(data),
                content_type="application/json",
            )
        else:
            path = LOCAL_FALLBACK_DIR / object_key
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)

    def _get_blob(self, object_key: str) -> dict[str, Any]:
        if self._available and self._minio is not None:
            resp = self._minio.get_object(self.settings.minio_bucket, object_key)
            try:
                return json.loads(resp.read())
            finally:
                resp.close()
                resp.release_conn()
        path = LOCAL_FALLBACK_DIR / object_key
        return json.loads(path.read_bytes())

    async def archive(
        self,
        db: AsyncSession,
        resource_urn: str,
        finding_id: Any,
        payload: dict[str, Any],
    ) -> EvidenceRecord:
        result = await db.execute(
            select(EvidenceRecord)
            .where(EvidenceRecord.resource_urn == resource_urn)
            .order_by(EvidenceRecord.sequence.desc())
            .limit(1)
        )
        last = result.scalar_one_or_none()
        prev_hash = last.content_hash if last else GENESIS_HASH
        sequence = (last.sequence + 1) if last else 0

        content_hash = _content_hash(payload, prev_hash)
        object_key = f"{_safe_urn(resource_urn)}/{sequence:06d}-{content_hash[:12]}.json"

        self._put_blob(object_key, {"payload": payload, "prev_hash": prev_hash, "sequence": sequence})

        record = EvidenceRecord(
            resource_urn=resource_urn,
            finding_id=finding_id,
            object_key=object_key,
            content_hash=content_hash,
            prev_hash=prev_hash,
            sequence=sequence,
        )
        db.add(record)
        await db.flush()
        return record

    async def verify_chain(self, db: AsyncSession, resource_urn: str) -> dict[str, Any]:
        result = await db.execute(
            select(EvidenceRecord)
            .where(EvidenceRecord.resource_urn == resource_urn)
            .order_by(EvidenceRecord.sequence.asc())
        )
        records = result.scalars().all()

        if not records:
            return {
                "resource_urn": resource_urn,
                "valid": True,
                "chain_length": 0,
                "broken_at_sequence": None,
                "message": "No evidence recorded for this resource yet.",
            }

        expected_prev = GENESIS_HASH
        for rec in records:
            if rec.prev_hash != expected_prev:
                return {
                    "resource_urn": resource_urn,
                    "valid": False,
                    "chain_length": len(records),
                    "broken_at_sequence": rec.sequence,
                    "message": f"Chain break at sequence {rec.sequence}: prev_hash mismatch.",
                }
            try:
                blob = self._get_blob(rec.object_key)
            except Exception as exc:
                return {
                    "resource_urn": resource_urn,
                    "valid": False,
                    "chain_length": len(records),
                    "broken_at_sequence": rec.sequence,
                    "message": f"Evidence blob unreadable at sequence {rec.sequence}: {exc}",
                }
            recomputed = _content_hash(blob["payload"], rec.prev_hash)
            if recomputed != rec.content_hash:
                return {
                    "resource_urn": resource_urn,
                    "valid": False,
                    "chain_length": len(records),
                    "broken_at_sequence": rec.sequence,
                    "message": f"Content hash mismatch at sequence {rec.sequence} — evidence was altered.",
                }
            expected_prev = rec.content_hash

        return {
            "resource_urn": resource_urn,
            "valid": True,
            "chain_length": len(records),
            "broken_at_sequence": None,
            "message": f"Chain verified — {len(records)} record(s), no tampering detected.",
        }


evidence_store = EvidenceStore()
