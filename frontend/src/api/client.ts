import axios from "axios";
import type {
  CISFamilyCompliance,
  DashboardMetrics,
  EvidenceRecord,
  EvidenceVerifyResult,
  Finding,
  FindingStatus,
  PolicyControl,
  PolicyEvalResult,
  Resource,
  ScanRun,
  ScoreTrendPoint,
  TopRiskResource,
} from "@/types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const api = axios.create({ baseURL: BASE_URL });

export interface BulkUpdateResult {
  updated: number;
  not_found: string[];
}

const V1 = "/api/v1";

export const endpoints = {
  triggerScan: (provider?: string) =>
    api.post<ScanRun>(`${V1}/scan`, provider ? { provider } : {}),

  getScanRun: (correlationId: string) => api.get<ScanRun>(`${V1}/scan/${correlationId}`),

  listScanRuns: (limit = 20) => api.get<ScanRun[]>(`${V1}/scan`, { params: { limit } }),

  listResources: (params?: {
    provider?: string;
    resource_type?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) => api.get<Resource[]>(`${V1}/resources`, { params }),

  listFindings: (params?: {
    severity?: string;
    provider?: string;
    framework?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) => api.get<Finding[]>(`${V1}/findings`, { params }),

  updateFindingStatus: (id: string, status: FindingStatus) =>
    api.patch<Finding>(`${V1}/findings/${id}/status`, { status }),

  bulkUpdateFindingStatus: (findingIds: string[], status: FindingStatus) =>
    api.patch<BulkUpdateResult>(`${V1}/findings/bulk-status`, { finding_ids: findingIds, status }),

  listPolicies: () => api.get<PolicyControl[]>(`${V1}/policies`),

  listSampleResources: () => api.get<Record<string, unknown>>(`${V1}/policies/samples`),

  evaluatePolicy: (resource: Record<string, unknown>) =>
    api.post<PolicyEvalResult>(`${V1}/policies/evaluate`, { resource }),

  listEvidence: (resourceUrn: string) =>
    api.get<EvidenceRecord[]>(`${V1}/evidence/${encodeURIComponent(resourceUrn)}`),

  verifyEvidence: (resourceUrn: string) =>
    api.get<EvidenceVerifyResult>(`${V1}/evidence/${encodeURIComponent(resourceUrn)}/verify`),

  getDashboardMetrics: () => api.get<DashboardMetrics>(`${V1}/metrics/dashboard`),

  getCisFamilies: () => api.get<CISFamilyCompliance[]>(`${V1}/metrics/cis-families`),

  getScoreTrend: (limit = 20) =>
    api.get<ScoreTrendPoint[]>(`${V1}/metrics/trend`, { params: { limit } }),

  getTopRiskResources: (limit = 5) =>
    api.get<TopRiskResource[]>(`${V1}/metrics/top-resources`, { params: { limit } }),

  getTrendByProvider: (limit = 20) =>
    api.get<Array<{ correlation_id: string; provider: string | null; completed_at: string | null; security_score: number }>>(
      `${V1}/metrics/trend-by-provider`,
      { params: { limit } }
    ),

  getFindingsTimeline: (days = 30) =>
    api.get<Array<{ date: string; severities: Record<string, number> }>>(
      `${V1}/metrics/findings-timeline`,
      { params: { days } }
    ),
};

export function getWebSocketUrl(): string {
  return import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/live";
}
