"""initial schema

Revision ID: 0001
Revises:
Create Date: 2025-09-08

Hand-written to mirror app/db/models.py exactly (no live Postgres was
available to run --autogenerate while building this). Verify with
`alembic check` against a real database before relying on it in CI.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

cloud_provider_enum = postgresql.ENUM("AWS", "GCP", "AZURE", name="cloudprovider")
severity_enum = postgresql.ENUM("CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO", name="severity")
finding_status_enum = postgresql.ENUM(
    "OPEN", "IN_REVIEW", "ASSIGNED", "RESOLVED", "SUPPRESSED", name="findingstatus"
)


def upgrade() -> None:
    bind = op.get_bind()
    cloud_provider_enum.create(bind, checkfirst=True)
    severity_enum.create(bind, checkfirst=True)
    finding_status_enum.create(bind, checkfirst=True)

    op.create_table(
        "resources",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("resource_urn", sa.String(512), nullable=False, unique=True),
        sa.Column("provider", cloud_provider_enum, nullable=False),
        sa.Column("resource_type", sa.String(128), nullable=False),
        sa.Column("region", sa.String(64), nullable=False),
        sa.Column("account_id", sa.String(128), nullable=False),
        sa.Column("raw_config", postgresql.JSONB, nullable=False),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_scanned_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_resources_resource_urn", "resources", ["resource_urn"])
    op.create_index("ix_resources_provider", "resources", ["provider"])
    op.create_index("ix_resources_resource_type", "resources", ["resource_type"])
    op.create_index("ix_resource_provider_type", "resources", ["provider", "resource_type"])

    op.create_table(
        "findings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("resource_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("resources.id"), nullable=False),
        sa.Column("control_id", sa.String(64), nullable=False),
        sa.Column("framework", sa.String(64), nullable=False),
        sa.Column("severity", severity_enum, nullable=False),
        sa.Column("status", finding_status_enum, nullable=False, server_default="OPEN"),
        sa.Column("title", sa.String(256), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("remediation", sa.Text, nullable=False),
        sa.Column("passed", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("correlation_id", sa.String(64), nullable=False),
        sa.Column("evidence_hash", sa.String(64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_findings_resource_id", "findings", ["resource_id"])
    op.create_index("ix_findings_control_id", "findings", ["control_id"])
    op.create_index("ix_findings_framework", "findings", ["framework"])
    op.create_index("ix_findings_severity", "findings", ["severity"])
    op.create_index("ix_findings_status", "findings", ["status"])
    op.create_index("ix_findings_correlation_id", "findings", ["correlation_id"])
    op.create_index("ix_finding_severity_status", "findings", ["severity", "status"])

    op.create_table(
        "evidence_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("resource_urn", sa.String(512), nullable=False),
        sa.Column("finding_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("findings.id"), nullable=True),
        sa.Column("object_key", sa.String(512), nullable=False),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.Column("prev_hash", sa.String(64), nullable=True),
        sa.Column("sequence", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_evidence_records_resource_urn", "evidence_records", ["resource_urn"])
    op.create_index("ix_evidence_records_content_hash", "evidence_records", ["content_hash"])
    op.create_index(
        "ix_evidence_resource_seq", "evidence_records", ["resource_urn", "sequence"], unique=True
    )

    op.create_table(
        "scan_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("correlation_id", sa.String(64), nullable=False, unique=True),
        sa.Column("provider", cloud_provider_enum, nullable=True),
        sa.Column("resources_scanned", sa.Integer, nullable=False, server_default="0"),
        sa.Column("findings_created", sa.Integer, nullable=False, server_default="0"),
        sa.Column("violations_found", sa.Integer, nullable=False, server_default="0"),
        sa.Column("duration_ms", sa.Integer, nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="RUNNING"),
    )
    op.create_index("ix_scan_runs_correlation_id", "scan_runs", ["correlation_id"])


def downgrade() -> None:
    op.drop_table("scan_runs")
    op.drop_table("evidence_records")
    op.drop_table("findings")
    op.drop_table("resources")

    bind = op.get_bind()
    finding_status_enum.drop(bind, checkfirst=True)
    severity_enum.drop(bind, checkfirst=True)
    cloud_provider_enum.drop(bind, checkfirst=True)
