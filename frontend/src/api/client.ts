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
  Token,
  TopRiskResource,
  User,
  UserRole,
} from "@/types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const api = axios.create({ baseURL: BASE_URL });

export interface BulkUpdateResult {
  updated: number;
  not_found: string[];
}

const V1 = "/api/v1";

// Token lives in localStorage, not an httpOnly cookie — a deliberate
// tradeoff consistent with this being a demo/portfolio deployment rather
// than a system holding real secrets (the same philosophy the backend's
// hybrid JWT/API-key design already documents). Wrapped in try/catch since
// localStorage can throw in a private window or with blocked site data.
const TOKEN_STORAGE_KEY = "cloudsecops_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Auth simply won't persist across reloads — the app still works.
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Nothing to clear if it never got stored in the first place.
  }
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? "";
    // Never redirect a failed /auth/login call itself — that 401 is "wrong
    // password," meant for the login form to display, not a session expiry.
    if (status === 401 && !url.includes("/auth/login") && window.location.pathname !== "/login") {
      clearToken();
      window.location.assign("/login");
    }
    return Promise.reject(error);
  }
);

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

  login: (username: string, password: string) =>
    api.post<Token>(`${V1}/auth/login`, { username, password }),

  getCurrentUser: () => api.get<User>(`${V1}/auth/me`),

  listUsers: () => api.get<User[]>(`${V1}/auth/users`),

  createUser: (body: { username: string; email: string; password: string; role: UserRole }) =>
    api.post<User>(`${V1}/auth/users`, body),

  updateUserRole: (userId: string, role: UserRole) =>
    api.patch<User>(`${V1}/auth/users/${userId}/role`, { role }),
};

export function getWebSocketUrl(): string {
  return import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws/live";
}
