"""Pydantic request/response models."""
import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

Severity = Literal["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]
FindingStatus = Literal["OPEN", "IN_REVIEW", "ASSIGNED", "RESOLVED", "SUPPRESSED"]
CloudProvider = Literal["AWS", "GCP", "AZURE"]


# ── Resource ─────────────────────────────────────────
class ResourceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    resource_urn: str
    provider: CloudProvider
    resource_type: str
    region: str
    account_id: str
    raw_config: dict[str, Any]
    first_seen_at: datetime
    last_scanned_at: datetime


# ── Finding ──────────────────────────────────────────
class FindingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    resource_id: uuid.UUID
    control_id: str
    framework: str
    severity: Severity
    status: FindingStatus
    title: str
    description: str
    remediation: str
    passed: bool
    correlation_id: str
    evidence_hash: str | None
    created_at: datetime
    resolved_at: datetime | None


class FindingStatusUpdate(BaseModel):
    status: FindingStatus


class BulkFindingStatusUpdate(BaseModel):
    finding_ids: list[uuid.UUID]
    status: FindingStatus


class BulkUpdateResult(BaseModel):
    updated: int
    not_found: list[uuid.UUID]


class FindingFilter(BaseModel):
    severity: Severity | None = None
    provider: CloudProvider | None = None
    framework: str | None = None
    status: FindingStatus | None = None
    limit: int = 100
    offset: int = 0


# ── Evidence ─────────────────────────────────────────
class EvidenceRecordOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    resource_urn: str
    finding_id: uuid.UUID | None
    object_key: str
    content_hash: str
    prev_hash: str | None
    sequence: int
    created_at: datetime


class EvidenceVerifyResult(BaseModel):
    resource_urn: str
    valid: bool
    chain_length: int
    broken_at_sequence: int | None = None
    message: str


# ── Scan ─────────────────────────────────────────────
class ScanRequest(BaseModel):
    provider: CloudProvider | None = None  # None = scan all providers


class ScanRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    correlation_id: str
    provider: CloudProvider | None
    resources_scanned: int
    findings_created: int
    violations_found: int
    duration_ms: int
    started_at: datetime
    completed_at: datetime | None
    status: str


# ── Policy ───────────────────────────────────────────
class PolicyEvalRequest(BaseModel):
    resource: dict[str, Any]


class PolicyViolation(BaseModel):
    control_id: str
    framework: str
    severity: Severity
    title: str
    description: str
    remediation: str


class PolicyEvalResult(BaseModel):
    resource_urn: str
    violations: list[PolicyViolation]
    passed_controls: list[str]
    evaluated_at: datetime


# ── Metrics ──────────────────────────────────────────
class DashboardMetrics(BaseModel):
    security_score: int
    critical_findings: int
    controls_passing: int
    controls_total: int
    avg_mttr_hours: float
    resources_scanned: int
    last_scan_at: datetime | None
    severity_breakdown: dict[str, int]
    framework_coverage: dict[str, float]


class CISFamilyCompliance(BaseModel):
    family: str
    control_count: int
    passing: int
    percent: float
