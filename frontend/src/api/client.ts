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

export const endpoints = {
  triggerScan: (provider?: string) =>
    api.post<ScanRun>("/api/scan", provider ? { provider } : {}),

  getScanRun: (correlationId: string) => api.get<ScanRun>(`/api/scan/${correlationId}`),

  listScanRuns: (limit = 20) => api.get<ScanRun[]>("/api/scan", { params: { limit } }),

  listResources: (params?: {
    provider?: string;
    resource_type?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) => api.get<Resource[]>("/api/resources", { params }),

  listFindings: (params?: {
    severity?: string;
    provider?: string;
    framework?: string;
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) => api.get<Finding[]>("/api/findings", { params }),

  updateFindingStatus: (id: string, status: FindingStatus) =>
    api.patch<Finding>(`/api/findings/${id}/status`, { status }),

  bulkUpdateFindingStatus: (findingIds: string[], status: FindingStatus) =>
    api.patch<BulkUpdateResult>("/api/findings/bulk-status", { finding_ids: findingIds, status }),

  listPolicies: () => api.get<PolicyControl[]>("/api/policies"),

  listSampleResources: () => api.get<Record<string, unknown>>("/api/policies/samples"),

  evaluatePolicy: (resource: Record<string, unknown>) =>
    api.post<PolicyEvalResult>("/api/policies/evaluate", { resource }),

  listEvidence: (resourceUrn: string) =>
    api.get<EvidenceRecord[]>(`/api/evidence/${encodeURIComponent(resourceUrn)}`),

  verifyEvidence: (resourceUrn: string) =>
    api.get<EvidenceVerifyResult>(`/api/evidence/${encodeURIComponent(resourceUrn)}/verify`),

  getDashboardMetrics: () => api.get<DashboardMetrics>("/api/metrics/dashboard"),

  getCisFamilies: () => api.get<CISFamilyCompliance[]>("/api/metrics/cis-families"),

  getScoreTrend: (limit = 20) =>
    api.get<ScoreTrendPoint[]>("/api/metrics/trend", { params: { limit } }),

  getTopRiskResources: (limit = 5) =>
    api.get<TopRiskResource[]>("/api/metrics/top-resources", { params: { limit } }),
};

export function getWebSocketUrl(): string {
  return import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/live";
}
