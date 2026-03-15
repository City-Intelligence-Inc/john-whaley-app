import type {
  Session, AdminSession, Applicant, Stats, PromptSettings,
  SelectionPreferences, GoogleSheetImportRequest, GoogleSheetImportResponse,
  ReviewRequest, BulkAnalyzeRequest, AnalysisResult,
  AnalyzeStreamCallbacks, LinkedInEnrichCallbacks, LinkedInJobStatus,
} from "../../shared/types";

export type {
  Session, AdminSession, Applicant, Stats, PromptSettings,
  SelectionPreferences, GoogleSheetImportRequest, GoogleSheetImportResponse,
  ReviewRequest, BulkAnalyzeRequest, AnalysisResult,
  AnalyzeStreamCallbacks, LinkedInEnrichCallbacks, LinkedInJobStatus,
};
export type { PanelConfig, PoolCapacity } from "../../shared/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

let _getToken: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  _getToken = getter;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!_getToken) return {};
  const token = await _getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = { ...authHeaders, ...options?.headers as Record<string, string> };
  if (!(options?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "API request failed");
  }
  return res.json();
}

function parseSSE(buffer: string, handler: (eventType: string, data: unknown) => void): string {
  const lines = buffer.split("\n");
  const remainder = lines.pop() || "";
  let eventType = "";
  for (const line of lines) {
    if (line.startsWith("event: ")) {
      eventType = line.slice(7).trim();
    } else if (line.startsWith("data: ") && eventType) {
      handler(eventType, JSON.parse(line.slice(6)));
      eventType = "";
    }
  }
  return remainder;
}

async function readSSEStream(res: Response, handler: (eventType: string, data: unknown) => void) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = parseSSE(buffer, handler);
  }
}

export const api = {
  // Sessions
  listSessions: () => fetchAPI<Session[]>("/sessions"),
  createSession: (data: { name: string; source?: string; source_detail?: string }) =>
    fetchAPI<Session>("/sessions", { method: "POST", body: JSON.stringify(data) }),
  getSession: (id: string) => fetchAPI<Session>(`/sessions/${id}`),
  updateSession: (id: string, data: { name?: string; status?: string }) =>
    fetchAPI<Session>(`/sessions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSession: (id: string) =>
    fetchAPI<{ detail: string }>(`/sessions/${id}`, { method: "DELETE" }),

  // Applicants
  listApplicants: (sessionId?: string) =>
    fetchAPI<Applicant[]>(`/applicants${sessionId ? `?session_id=${sessionId}` : ""}`),
  getApplicant: (id: string) => fetchAPI<Applicant>(`/applicants/${id}`),
  createApplicant: (data: { name: string; status?: string; extra?: Record<string, unknown> }) =>
    fetchAPI<Applicant>("/applicants", { method: "POST", body: JSON.stringify(data) }),
  updateApplicant: (id: string, data: { name?: string; status?: string; extra?: Record<string, unknown> }) =>
    fetchAPI<Applicant>(`/applicants/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteApplicant: (id: string) =>
    fetchAPI<{ detail: string }>(`/applicants/${id}`, { method: "DELETE" }),
  deleteAllApplicants: (sessionId?: string) =>
    fetchAPI<{ deleted: number }>(`/applicants/all${sessionId ? `?session_id=${sessionId}` : ""}`, { method: "DELETE" }),

  // Google Sheet Import
  importGoogleSheet: (data: GoogleSheetImportRequest) =>
    fetchAPI<GoogleSheetImportResponse>("/applicants/import-google-sheet", { method: "POST", body: JSON.stringify(data) }),

  // CSV Upload
  uploadCSV: async (file: File, sessionId?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    const qs = sessionId ? `?session_id=${sessionId}` : "";
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_URL}/applicants/upload-csv${qs}`, { method: "POST", headers: authHeaders, body: formData });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || "Upload failed");
    }
    return res.json() as Promise<{ count: number; items: Applicant[]; session_id: string }>;
  },

  // Stats
  getStats: (sessionId?: string) =>
    fetchAPI<Stats>(`/applicants/stats${sessionId ? `?session_id=${sessionId}` : ""}`),

  // Batch status
  batchUpdateStatus: (applicantIds: string[], status: string) =>
    fetchAPI<{ updated: string[] }>("/applicants/batch-status", { method: "PUT", body: JSON.stringify({ applicant_ids: applicantIds, status }) }),

  // AI Review
  reviewApplicant: (id: string, data: ReviewRequest) =>
    fetchAPI<Applicant>(`/applicants/${id}/review`, { method: "POST", body: JSON.stringify(data) }),
  analyzeAll: (data: BulkAnalyzeRequest) =>
    fetchAPI<AnalysisResult>("/applicants/analyze-all", { method: "POST", body: JSON.stringify(data) }),

  // Streaming Analysis (SSE)
  analyzeAllStream: async (data: BulkAnalyzeRequest, callbacks: AnalyzeStreamCallbacks) => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_URL}/applicants/analyze-all-stream`, {
      method: "POST", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || "Stream request failed");
    }
    await readSSEStream(res, (eventType, data) => {
      const d = data as Record<string, unknown>;
      const map: Record<string, keyof AnalyzeStreamCallbacks> = {
        start: "onStart", phase: "onPhase", classify: "onClassify", classify_error: "onClassifyError",
        auto_accept: "onAutoAccept", progress: "onProgress", error: "onError", complete: "onComplete",
        summary: "onSummary", judge_seats: "onJudgeSeats", judge_start: "onJudgeStart",
        judge_progress: "onJudgeProgress", judge_complete: "onJudgeComplete", adjudication: "onAdjudication",
      };
      const cb = map[eventType];
      if (cb) (callbacks[cb] as ((d: unknown) => void) | undefined)?.(d);
    });
  },

  // Enrich-only stream (classification, no scoring)
  enrichStream: async (data: { api_key: string; model: string; provider: string; prompt?: string; session_id?: string }, callbacks: AnalyzeStreamCallbacks) => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_URL}/applicants/enrich-stream`, {
      method: "POST", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || "Enrich stream failed");
    }
    await readSSEStream(res, (eventType, data) => {
      const d = data as Record<string, unknown>;
      if (eventType === "start") callbacks.onStart?.(d as never);
      else if (eventType === "phase") callbacks.onPhase?.(d as never);
      else if (eventType === "classify") callbacks.onClassify?.(d as never);
      else if (eventType === "classify_error") callbacks.onClassifyError?.(d as never);
      else if (eventType === "complete") callbacks.onComplete?.(d as never);
    });
  },

  // Select-only stream (scoring, requires prior enrichment)
  selectStream: async (data: BulkAnalyzeRequest, callbacks: AnalyzeStreamCallbacks) => {
    const authHeaders = await getAuthHeaders();
    const res = await fetch(`${API_URL}/applicants/select-stream`, {
      method: "POST", headers: { "Content-Type": "application/json", ...authHeaders }, body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || "Select stream failed");
    }
    await readSSEStream(res, (eventType, data) => {
      const d = data as Record<string, unknown>;
      if (eventType === "start") callbacks.onStart?.(d as never);
      else if (eventType === "phase") callbacks.onPhase?.(d as never);
      else if (eventType === "auto_accept") callbacks.onAutoAccept?.(d as never);
      else if (eventType === "progress") callbacks.onProgress?.(d as never);
      else if (eventType === "error") callbacks.onError?.(d as never);
      else if (eventType === "complete") callbacks.onComplete?.(d as never);
      else if (eventType === "summary") callbacks.onSummary?.(d as never);
    });
  },

  // LinkedIn Enrichment
  enrichLinkedInStream: async (
    data: { session_id: string; scrapfly_key?: string; applicant_ids?: string[]; li_at?: string; urls?: string[] },
    callbacks: LinkedInEnrichCallbacks,
  ) => {
    let urls = data.urls || [];
    if (!urls.length && data.session_id) {
      const applicants: Applicant[] = await fetchAPI(`/applicants?session_id=${data.session_id}`);
      urls = applicants
        .filter((a) => a.linkedin_url && (!data.applicant_ids || data.applicant_ids.includes(a.applicant_id)))
        .map((a) => a.linkedin_url!);
    }
    if (!urls.length) throw new Error("No LinkedIn URLs to enrich");

    const jobRes = await fetchAPI<{ job_id: string; total: number; message: string }>("/linkedin/enrich", {
      method: "POST", body: JSON.stringify({ urls, li_at: data.li_at || undefined, max_retries: 6, session_id: data.session_id }),
    });
    const { job_id, total } = jobRes;
    callbacks.onStart?.({ total, job_id });

    const streamAuthHeaders = await getAuthHeaders();
    const stream = await fetch(`${API_URL}/linkedin/stream/${job_id}`, { headers: streamAuthHeaders });
    if (!stream.ok) throw new Error("Stream failed");

    let completed = 0, errors = 0;
    await readSSEStream(stream, (eventType, data) => {
      const d = data as Record<string, unknown>;
      if (eventType === "done") {
        callbacks.onComplete?.({ completed, total, errors, enriched: completed - errors });
      } else {
        completed++;
        if (d.error) {
          errors++;
          callbacks.onError?.({ completed, total, name: (d.name || d.url) as string, error: d.error as string });
        } else {
          callbacks.onProgress?.({
            completed, total, name: d.name as string, headline: d.headline as string,
            linkedin_headline: d.headline as string, url: d.url as string,
            image: (d.photo_url || d.image) as string,
          });
        }
      }
    });
  },

  scrapeLinkedIn: (urls: string[], li_at?: string) =>
    fetchAPI<{ job_id: string; total: number; message: string }>("/linkedin/enrich", {
      method: "POST", body: JSON.stringify({ urls, li_at, max_retries: 6 }),
    }),
  getLinkedInJob: (job_id: string) => fetchAPI<LinkedInJobStatus>(`/linkedin/jobs/${job_id}`),
  cancelLinkedInJob: (job_id: string) =>
    fetchAPI<{ detail: string }>(`/linkedin/jobs/${job_id}/cancel`, { method: "POST" }),

  // Reallocate
  reallocate: (data: { session_id: string; venue_capacity?: number | null; attendee_mix?: Record<string, number>; auto_accept_types?: string[] }) =>
    fetchAPI<{ accepted: number; waitlisted: number; type_counts: Record<string, number> }>("/applicants/reallocate", { method: "POST", body: JSON.stringify(data) }),

  // Settings
  getPromptSettings: () => fetchAPI<PromptSettings>("/settings/prompts"),
  updatePromptSettings: (data: PromptSettings) =>
    fetchAPI<PromptSettings>("/settings/prompts", { method: "PUT", body: JSON.stringify(data) }),
  getSelectionPreferences: () => fetchAPI<SelectionPreferences>("/settings/selection-preferences"),
  updateSelectionPreferences: (data: SelectionPreferences) =>
    fetchAPI<SelectionPreferences>("/settings/selection-preferences", { method: "PUT", body: JSON.stringify(data) }),
  getJudgePersonas: () =>
    fetchAPI<{ id: string; name: string; emoji: string; specialty: string; description: string; preferred_types: string[] }[]>("/settings/judge-personas"),

  // Whitelist / Blacklist (global)
  getWhitelist: () => fetchAPI<{ emails: string[] }>("/settings/whitelist"),
  updateWhitelist: (emails: string[]) =>
    fetchAPI<{ emails: string[] }>("/settings/whitelist", { method: "PUT", body: JSON.stringify({ emails }) }),
  getBlacklist: () => fetchAPI<{ emails: string[] }>("/settings/blacklist"),
  updateBlacklist: (emails: string[]) =>
    fetchAPI<{ emails: string[] }>("/settings/blacklist", { method: "PUT", body: JSON.stringify({ emails }) }),

  // Whitelist / Blacklist (per-event)
  getSessionWhitelist: (sessionId: string) =>
    fetchAPI<{ emails: string[]; linkedin_urls: string[] }>(`/settings/sessions/${sessionId}/whitelist`),
  updateSessionWhitelist: (sessionId: string, data: { emails: string[]; linkedin_urls: string[] }) =>
    fetchAPI<{ emails: string[]; linkedin_urls: string[] }>(`/settings/sessions/${sessionId}/whitelist`, { method: "PUT", body: JSON.stringify(data) }),
  getSessionBlacklist: (sessionId: string) =>
    fetchAPI<{ emails: string[]; linkedin_urls: string[] }>(`/settings/sessions/${sessionId}/blacklist`),
  updateSessionBlacklist: (sessionId: string, data: { emails: string[]; linkedin_urls: string[] }) =>
    fetchAPI<{ emails: string[]; linkedin_urls: string[] }>(`/settings/sessions/${sessionId}/blacklist`, { method: "PUT", body: JSON.stringify(data) }),

  // Personas
  getPersonas: () =>
    fetchAPI<{ id: string; name: string; emoji: string; specialty: string; description: string; preferred_types: string[]; bias?: string; scoring_modifiers?: string }[]>("/settings/personas"),
  updatePersona: (id: string, data: Record<string, unknown>) =>
    fetchAPI<{ detail: string }>(`/settings/personas/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deletePersona: (id: string) =>
    fetchAPI<{ detail: string }>(`/settings/personas/${id}`, { method: "DELETE" }),

  // Luma
  getLumaKey: () => fetchAPI<{ has_key: boolean }>("/settings/luma-key"),
  setLumaKey: (api_key: string) =>
    fetchAPI<{ detail: string }>("/settings/luma-key", { method: "PUT", body: JSON.stringify({ api_key }) }),
  listLumaEvents: (api_key?: string) =>
    fetchAPI<{ entries: { api_id: string; name: string; start_at: string; cover_url?: string }[] }>(`/luma/events${api_key ? `?api_key=${api_key}` : ""}`),
  importFromLuma: (event_id: string, session_id?: string, api_key?: string) => {
    const params = new URLSearchParams({ event_id });
    if (session_id) params.set("session_id", session_id);
    if (api_key) params.set("api_key", api_key);
    return fetchAPI<{ count: number; session_id: string }>(`/luma/import?${params}`, { method: "POST" });
  },
  syncToLuma: (session_id: string, dry_run = true, api_key?: string) => {
    const params = new URLSearchParams({ session_id, dry_run: String(dry_run) });
    if (api_key) params.set("api_key", api_key);
    return fetchAPI<{ dry_run: boolean; updates: { guest_id: string; name: string; status: string; success?: boolean }[]; count: number }>(`/luma/sync?${params}`, { method: "POST" });
  },

  // Admin
  getAdminSessions: () => fetchAPI<AdminSession[]>("/admin/sessions"),
};
