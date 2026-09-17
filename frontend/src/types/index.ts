export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type FindingStatus = "OPEN" | "IN_REVIEW" | "ASSIGNED" | "RESOLVED" | "SUPPRESSED";
export type CloudProvider = "AWS" | "GCP" | "AZURE";

export interface Resource {
  id: string;
  resource_urn: string;
  provider: CloudProvider;
  resource_type: string;
  region: string;
  account_id: string;
  raw_config: Record<string, unknown>;
  first_seen_at: string;
  last_scanned_at: string;
}

export interface Finding {
  id: string;
  resource_id: string;
  control_id: string;
  framework: string;
  severity: Severity;
  status: FindingStatus;
  title: string;
  description: string;
  remediation: string;
  passed: boolean;
  correlation_id: string;
  evidence_hash: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface ScanRun {
  id: string;
  correlation_id: string;
  provider: CloudProvider | null;
  resources_scanned: number;
  findings_created: number;
  violations_found: number;
  duration_ms: number;
  started_at: string;
  completed_at: string | null;
  status: string;
}

export interface DashboardMetrics {
  security_score: number;
  critical_findings: number;
  controls_passing: number;
  controls_total: number;
  avg_mttr_hours: number;
  resources_scanned: number;
  last_scan_at: string | null;
  severity_breakdown: Record<string, number>;
  framework_coverage: Record<string, number>;
}

export interface CISFamilyCompliance {
  family: string;
  control_count: number;
  passing: number;
  percent: number;
}

export interface ScoreTrendPoint {
  correlation_id: string;
  completed_at: string | null;
  security_score: number;
  controls_passing: number;
  controls_total: number;
  critical_findings: number;
  resources_scanned: number;
}

export interface TopRiskResource {
  resource_id: string;
  resource_urn: string;
  provider: CloudProvider;
  resource_type: string;
  open_findings: number;
  risk_score: number;
  worst_severity: Severity;
}

export interface PolicyControl {
  control_id: string;
  framework: string;
  resource_type: string;
  title: string;
}

export interface PolicyViolation {
  control_id: string;
  framework: string;
  severity: Severity;
  title: string;
  description: string;
  remediation: string;
}

export interface PolicyEvalResult {
  resource_urn: string;
  violations: PolicyViolation[];
  passed_controls: string[];
  evaluated_at: string;
}

export interface EvidenceRecord {
  id: string;
  resource_urn: string;
  finding_id: string | null;
  object_key: string;
  content_hash: string;
  prev_hash: string | null;
  sequence: number;
  created_at: string;
}

export interface EvidenceVerifyResult {
  resource_urn: string;
  valid: boolean;
  chain_length: number;
  broken_at_sequence: number | null;
  message: string;
}

export interface LiveFindingMessage {
  type: "finding.enriched";
  data: {
    correlation_id: string;
    resource_urn: string;
    resource_type: string;
    provider: CloudProvider;
    violations: PolicyViolation[];
    passed_controls: string[];
    findings: Array<{
      id: string;
      resource_urn: string;
      control_id: string;
      framework: string;
      severity: Severity;
      title: string;
      passed: boolean;
      evidence_hash: string | null;
    }>;
    evaluated_at: string;
  };
}
