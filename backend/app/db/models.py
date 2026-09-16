"""SQLAlchemy ORM models."""
import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Severity(StrEnum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


class FindingStatus(StrEnum):
    OPEN = "OPEN"
    IN_REVIEW = "IN_REVIEW"
    ASSIGNED = "ASSIGNED"
    RESOLVED = "RESOLVED"
    SUPPRESSED = "SUPPRESSED"


class CloudProvider(StrEnum):
    AWS = "AWS"
    GCP = "GCP"
    AZURE = "AZURE"


class Resource(Base):
    """A single cloud resource discovered by a collector."""

    __tablename__ = "resources"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    resource_urn: Mapped[str] = mapped_column(String(512), unique=True, index=True)
    provider: Mapped[CloudProvider] = mapped_column(Enum(CloudProvider), index=True)
    resource_type: Mapped[str] = mapped_column(String(128), index=True)
    region: Mapped[str] = mapped_column(String(64))
    account_id: Mapped[str] = mapped_column(String(128))
    raw_config: Mapped[dict] = mapped_column(JSONB)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_scanned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    findings: Mapped[list["Finding"]] = relationship(back_populates="resource")

    __table_args__ = (Index("ix_resource_provider_type", "provider", "resource_type"),)


class Finding(Base):
    """A policy evaluation result for one resource against one control."""

    __tablename__ = "findings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    resource_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("resources.id"), index=True)
    control_id: Mapped[str] = mapped_column(String(64), index=True)  # e.g. "CIS-2.1.2"
    framework: Mapped[str] = mapped_column(String(64), index=True)  # e.g. "CIS v2", "NIST CSF", "ISO 27001"
    severity: Mapped[Severity] = mapped_column(Enum(Severity), index=True)
    status: Mapped[FindingStatus] = mapped_column(
        Enum(FindingStatus), default=FindingStatus.OPEN, index=True
    )
    title: Mapped[str] = mapped_column(String(256))
    description: Mapped[str] = mapped_column(Text)
    remediation: Mapped[str] = mapped_column(Text)
    passed: Mapped[bool] = mapped_column(Boolean, default=False)
    correlation_id: Mapped[str] = mapped_column(String(64), index=True)
    evidence_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    resource: Mapped["Resource"] = relationship(back_populates="findings")

    __table_args__ = (
        Index("ix_finding_severity_status", "severity", "status"),
        Index("ix_finding_framework", "framework"),
    )


class EvidenceRecord(Base):
    """Index row pointing at an immutable evidence blob in MinIO. Hash-chained per resource."""

    __tablename__ = "evidence_records"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    resource_urn: Mapped[str] = mapped_column(String(512), index=True)
    finding_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("findings.id"), nullable=True)
    object_key: Mapped[str] = mapped_column(String(512))  # MinIO object path
    content_hash: Mapped[str] = mapped_column(String(64), index=True)  # sha256 of blob
    prev_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    sequence: Mapped[int] = mapped_column(Integer)  # position in this resource's chain
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_evidence_resource_seq", "resource_urn", "sequence", unique=True),
    )


class ScanRun(Base):
    """Metadata about one collection+evaluation pass."""

    __tablename__ = "scan_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    correlation_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    provider: Mapped[CloudProvider | None] = mapped_column(Enum(CloudProvider), nullable=True)
    resources_scanned: Mapped[int] = mapped_column(Integer, default=0)
    findings_created: Mapped[int] = mapped_column(Integer, default=0)
    violations_found: Mapped[int] = mapped_column(Integer, default=0)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="RUNNING")
