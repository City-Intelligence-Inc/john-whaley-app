const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Session {
  session_id: string;
  name: string;
  created_at: string;
  source: string;
  source_detail?: string;
  applicant_count: number;
  status: string;
  last_analysis_model?: string;
  last_analysis_provider?: string;
  last_analysis_prompt?: string;
  last_analysis_criteria?: string[];
  selection_preferences?: SelectionPreferences;
  panel_config?: PanelConfig;
  last_analysis_at?: string;
  last_analysis_results?: {
    total: number;
    accepted: number;
    auto_accepted: number;
    waitlisted: number;
    rejected: number;
    errors: number;
  };
  last_analysis_summary?: string;
  last_analysis_type_counts?: Record<string, number>;
}

export interface AdminSession extends Session {
  stats: Stats;
}

export interface Applicant {
  applicant_id: string;
  session_id?: string;
  name?: string;
  email?: string;
  linkedin_url?: string;
  company?: string;
  title?: string;
  location?: string;
  status: string;
  ai_review?: string;
  ai_score?: string;
  ai_reasoning?: string;
  attendee_type?: string;
  attendee_type_detail?: string;
  investor_level?: string;
  investor_professional?: boolean;
  attendance_mode?: string;
  user_override_attendee_type?: boolean;
  user_override_attendee_type_detail?: boolean;
  panel_votes?: string;
  accepting_judges?: string;
  [key: string]: unknown;
}

export interface Stats {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  waitlisted: number;
}

export interface PromptSettings {
  default_prompt: string;
  criteria: string[];
}

export interface PoolCapacity {
  in_person: number | null;
  virtual: number | null;
}

export interface SelectionPreferences {
  venue_capacity: number | null;
  pool_capacity?: PoolCapacity | null;
  attendee_mix: Record<string, number>;
  auto_accept_types: string[];
  relevance_filter: string;
  custom_priorities: string;
  custom_categories: string[];
}

export const DEFAULT_SELECTION_PREFERENCES: SelectionPreferences = {
  venue_capacity: null,
  attendee_mix: {},
  auto_accept_types: ["student", "faculty", "alumni"],
  relevance_filter: "moderate",
  custom_priorities: "",
  custom_categories: [],
};

export interface GoogleSheetImportRequest {
  sheet_url: string;
  sheet_name?: string;
  session_id?: string;
}

export interface GoogleSheetImportResponse {
  new_count: number;
  updated_count: number;
  total_in_sheet: number;
  items: Applicant[];
  session_id: string;
}

export interface ReviewRequest {
  api_key: string;
  model: string;
  provider: string;
  prompt?: string;
  criteria?: string[];
}

export interface PanelConfig {
  enabled: boolean;
  panel_size: 3 | 6 | 9 | 12;
  judge_ids: string[];
  adjudication_mode: "union" | "majority";
}

export const DEFAULT_PANEL_CONFIG: PanelConfig = {
  enabled: false,
  panel_size: 3,
  judge_ids: [],
  adjudication_mode: "union",
};

export interface BulkAnalyzeRequest {
  api_key: string;
  model: string;
  provider: string;
  prompt: string;
  criteria: string[];
  criteria_weights?: string[];
  session_id?: string;
  selection_preferences?: SelectionPreferences;
  panel_config?: PanelConfig;
}

export interface AnalysisResult {
  candidates: {
    id: string;
    score: number;
    status: string;
    reasoning: string;
  }[];
}

export interface SSEStartEvent {
  total: number;
}

export interface SSEPhaseEvent {
  phase: string;
  message: string;
  type_counts?: Record<string, number>;
  total?: number;
}

export interface SSEClassifyEvent {
  completed: number;
  total: number;
  errors: number;
  applicant_id: string;
  name: string;
  attendee_type: string;
  attendee_type_detail: string;
  summary: string;
}

export interface SSEProgressEvent {
  completed: number;
  total: number;
  errors: number;
  applicant_id: string;
  name: string;
  score: number;
  status: string;
  reasoning: string;
  attendee_type: string;
  attendee_type_detail: string;
}

export interface SSEErrorEvent {
  completed: number;
  total: number;
  errors: number;
  applicant_id: string;
  name: string;
  error: string;
}

export interface SSECompleteEvent {
  completed: number;
  total: number;
  errors: number;
}

export interface SSEAutoAcceptEvent {
  applicant_id: string;
  name: string;
  attendee_type: string;
  attendee_type_detail: string;
}

export interface SSESummaryEvent {
  summary: string;
}

export interface SSEJudgeSeatEvent {
  judge_id: string;
  judge_name: string;
  judge_emoji: string;
  seats_allocated: number;
  specialty: string;
}

export interface SSEJudgeStartEvent {
  judge_id: string;
  judge_name: string;
  judge_emoji: string;
  judge_index: number;
  total_judges: number;
  seats_remaining: number;
}

export interface SSEJudgeProgressEvent {
  judge_id: string;
  judge_name: string;
  judge_emoji: string;
  applicant_id: string;
  name: string;
  score: number;
  decision: "accept" | "pass";
  reasoning: string;
  seats_filled: number;
  seats_allocated: number;
  completed: number;
  total: number;
}

export interface SSEJudgeCompleteEvent {
  judge_id: string;
  judge_name: string;
  judge_emoji: string;
  seats_filled: number;
  seats_allocated: number;
  accepted_names: string[];
}

export interface SSEAdjudicationEvent {
  applicant_id: string;
  name: string;
  final_status: string;
  votes_accept: number;
  votes_total: number;
  accepting_judges: string[];
  avg_score: number;
}

export interface LinkedInEnrichStartEvent {
  total: number;
  job_id?: string;
}

export interface LinkedInEnrichProgressEvent {
  completed: number;
  total: number;
  applicant_id?: string;
  name?: string;
  linkedin_headline?: string;
  headline?: string;
  url?: string;
  image?: string;
  error?: string | null;
  retries?: number;
}

export interface LinkedInEnrichErrorEvent {
  completed: number;
  total: number;
  applicant_id?: string;
  name?: string;
  error: string;
}

export interface LinkedInEnrichCompleteEvent {
  completed: number;
  total: number;
  errors: number;
  enriched: number;
}

export interface LinkedInEnrichCallbacks {
  onStart?: (data: LinkedInEnrichStartEvent) => void;
  onProgress?: (data: LinkedInEnrichProgressEvent) => void;
  onError?: (data: LinkedInEnrichErrorEvent) => void;
  onComplete?: (data: LinkedInEnrichCompleteEvent) => void;
}

// New native scraper (no Scrapfly needed)
export interface LinkedInScrapeResult {
  url: string;
  name: string | null;
  headline: string | null;
  image: string | null;
  error: string | null;
}

export interface LinkedInJobStatus {
  job_id: string;
  status: "queued" | "running" | "done";
  total: number;
  completed: number;
  results: LinkedInScrapeResult[];
  invalid: string[];
}

export interface AnalyzeStreamCallbacks {
  onStart?: (data: SSEStartEvent) => void;
  onPhase?: (data: SSEPhaseEvent) => void;
  onClassify?: (data: SSEClassifyEvent) => void;
  onClassifyError?: (data: SSEErrorEvent) => void;
  onAutoAccept?: (data: SSEAutoAcceptEvent) => void;
  onProgress?: (data: SSEProgressEvent) => void;
  onError?: (data: SSEErrorEvent) => void;
  onComplete?: (data: SSECompleteEvent) => void;
  onSummary?: (data: SSESummaryEvent) => void;
  onJudgeSeats?: (data: SSEJudgeSeatEvent) => void;
  onJudgeStart?: (data: SSEJudgeStartEvent) => void;
  onJudgeProgress?: (data: SSEJudgeProgressEvent) => void;
  onJudgeComplete?: (data: SSEJudgeCompleteEvent) => void;
  onAdjudication?: (data: SSEAdjudicationEvent) => void;
}

async function fetchAPI<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers: Record<string, string> = { ...options?.headers as Record<string, string> };
  if (!(options?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "API request failed");
  }

  return res.json();
}

export const api = {
  // Sessions
  listSessions: () => fetchAPI<Session[]>("/sessions"),

  createSession: (data: { name: string; source?: string; source_detail?: string }) =>
    fetchAPI<Session>("/sessions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getSession: (id: string) => fetchAPI<Session>(`/sessions/${id}`),

  updateSession: (id: string, data: { name?: string; status?: string }) =>
    fetchAPI<Session>(`/sessions/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteSession: (id: string) =>
    fetchAPI<{ detail: string }>(`/sessions/${id}`, {
      method: "DELETE",
    }),

  // Applicants
  listApplicants: (sessionId?: string) =>
    fetchAPI<Applicant[]>(`/applicants${sessionId ? `?session_id=${sessionId}` : ""}`),

  getApplicant: (id: string) => fetchAPI<Applicant>(`/applicants/${id}`),

  createApplicant: (data: { name: string; status?: string; extra?: Record<string, unknown> }) =>
    fetchAPI<Applicant>("/applicants", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateApplicant: (id: string, data: { name?: string; status?: string; extra?: Record<string, unknown> }) =>
    fetchAPI<Applicant>(`/applicants/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteApplicant: (id: string) =>
    fetchAPI<{ detail: string }>(`/applicants/${id}`, {
      method: "DELETE",
    }),

  deleteAllApplicants: (sessionId?: string) =>
    fetchAPI<{ deleted: number }>(`/applicants/all${sessionId ? `?session_id=${sessionId}` : ""}`, {
      method: "DELETE",
    }),

  // Google Sheet Import
  importGoogleSheet: (data: GoogleSheetImportRequest) =>
    fetchAPI<GoogleSheetImportResponse>("/applicants/import-google-sheet", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // CSV Upload
  uploadCSV: async (file: File, sessionId?: string) => {
    const formData = new FormData();
    formData.append("file", file);
    const qs = sessionId ? `?session_id=${sessionId}` : "";
    const res = await fetch(`${API_URL}/applicants/upload-csv${qs}`, {
      method: "POST",
      body: formData,
    });
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
    fetchAPI<{ updated: string[] }>("/applicants/batch-status", {
      method: "PUT",
      body: JSON.stringify({ applicant_ids: applicantIds, status }),
    }),

  // AI Review (single)
  reviewApplicant: (id: string, data: ReviewRequest) =>
    fetchAPI<Applicant>(`/applicants/${id}/review`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Bulk AI Analysis
  analyzeAll: (data: BulkAnalyzeRequest) =>
    fetchAPI<AnalysisResult>("/applicants/analyze-all", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Streaming Bulk AI Analysis (SSE)
  analyzeAllStream: async (data: BulkAnalyzeRequest, callbacks: AnalyzeStreamCallbacks) => {
    const res = await fetch(`${API_URL}/applicants/analyze-all-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || "Stream request failed");
    }

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let eventType = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ") && eventType) {
          const data = JSON.parse(line.slice(6));
          if (eventType === "start") callbacks.onStart?.(data);
          else if (eventType === "phase") callbacks.onPhase?.(data);
          else if (eventType === "classify") callbacks.onClassify?.(data);
          else if (eventType === "classify_error") callbacks.onClassifyError?.(data);
          else if (eventType === "auto_accept") callbacks.onAutoAccept?.(data);
          else if (eventType === "progress") callbacks.onProgress?.(data);
          else if (eventType === "error") callbacks.onError?.(data);
          else if (eventType === "complete") callbacks.onComplete?.(data);
          else if (eventType === "summary") callbacks.onSummary?.(data);
          else if (eventType === "judge_seats") callbacks.onJudgeSeats?.(data);
          else if (eventType === "judge_start") callbacks.onJudgeStart?.(data);
          else if (eventType === "judge_progress") callbacks.onJudgeProgress?.(data);
          else if (eventType === "judge_complete") callbacks.onJudgeComplete?.(data);
          else if (eventType === "adjudication") callbacks.onAdjudication?.(data);
          eventType = "";
        }
      }
    }
  },

  // Settings
  getPromptSettings: () => fetchAPI<PromptSettings>("/settings/prompts"),

  updatePromptSettings: (data: PromptSettings) =>
    fetchAPI<PromptSettings>("/settings/prompts", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getSelectionPreferences: () => fetchAPI<SelectionPreferences>("/settings/selection-preferences"),

  updateSelectionPreferences: (data: SelectionPreferences) =>
    fetchAPI<SelectionPreferences>("/settings/selection-preferences", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getJudgePersonas: () =>
    fetchAPI<{ id: string; name: string; emoji: string; specialty: string; description: string; preferred_types: string[] }[]>(
      "/settings/judge-personas"
    ),

  // Admin
  getAdminSessions: () => fetchAPI<AdminSession[]>("/admin/sessions"),

  // LinkedIn Enrichment — native scraper (no Scrapfly key needed)
  enrichLinkedInStream: async (
    data: { session_id: string; scrapfly_key?: string; applicant_ids?: string[]; li_at?: string; urls?: string[] },
    callbacks: LinkedInEnrichCallbacks,
  ) => {
    // Resolve URLs: if provided directly use them, otherwise fetch from session
    let urls = data.urls || [];
    if (!urls.length && data.session_id) {
      const applicants: Applicant[] = await fetchAPI(`/applicants?session_id=${data.session_id}`);
      urls = applicants
        .filter((a) => a.linkedin_url && (!data.applicant_ids || data.applicant_ids.includes(a.applicant_id)))
        .map((a) => a.linkedin_url!);
    }
    if (!urls.length) throw new Error("No LinkedIn URLs to enrich");

    // Submit job
    const jobRes = await fetchAPI<{ job_id: string; total: number; message: string }>("/linkedin/enrich", {
      method: "POST",
      body: JSON.stringify({ urls, li_at: data.li_at || undefined, max_retries: 6, session_id: data.session_id }),
    });

    const { job_id, total } = jobRes;
    callbacks.onStart?.({ total, job_id });

    // Stream results via SSE
    const stream = await fetch(`${API_URL}/linkedin/stream/${job_id}`);
    if (!stream.ok) throw new Error("Stream failed");

    const reader = stream.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let completed = 0;
    let errors = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let eventType = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ")) {
          const parsed = JSON.parse(line.slice(6));
          if (eventType === "done") {
            callbacks.onComplete?.({ completed, total, errors, enriched: completed - errors });
          } else {
            // Regular result
            completed++;
            if (parsed.error) {
              errors++;
              callbacks.onError?.({ completed, total, name: parsed.name || parsed.url, error: parsed.error });
            } else {
              callbacks.onProgress?.({
                completed,
                total,
                name: parsed.name,
                headline: parsed.headline,
                linkedin_headline: parsed.headline,
                url: parsed.url,
                image: parsed.photo_url || parsed.image,
              });
            }
          }
          eventType = "";
        }
      }
    }
  },

  // Direct LinkedIn scrape (returns job for polling)
  scrapeLinkedIn: (urls: string[], li_at?: string) =>
    fetchAPI<{ job_id: string; total: number; message: string }>("/linkedin/enrich", {
      method: "POST",
      body: JSON.stringify({ urls, li_at, max_retries: 6 }),
    }),

  getLinkedInJob: (job_id: string) =>
    fetchAPI<import("./api").LinkedInJobStatus>(`/linkedin/jobs/${job_id}`),

  cancelLinkedInJob: (job_id: string) =>
    fetchAPI<{ detail: string }>(`/linkedin/jobs/${job_id}/cancel`, { method: "POST" }),

  // Enrich-only (classification, no scoring)
  enrichStream: async (data: { api_key: string; model: string; provider: string; prompt?: string; session_id?: string }, callbacks: AnalyzeStreamCallbacks) => {
    const res = await fetch(`${API_URL}/applicants/enrich-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || "Enrich stream failed");
    }
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      let eventType = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) eventType = line.slice(7).trim();
        else if (line.startsWith("data: ") && eventType) {
          const d = JSON.parse(line.slice(6));
          if (eventType === "start") callbacks.onStart?.(d);
          else if (eventType === "phase") callbacks.onPhase?.(d);
          else if (eventType === "classify") callbacks.onClassify?.(d);
          else if (eventType === "classify_error") callbacks.onClassifyError?.(d);
          else if (eventType === "complete") callbacks.onComplete?.(d);
          eventType = "";
        }
      }
    }
  },

  // Select-only (scoring, requires prior enrichment)
  selectStream: async (data: BulkAnalyzeRequest, callbacks: AnalyzeStreamCallbacks) => {
    const res = await fetch(`${API_URL}/applicants/select-stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || "Select stream failed");
    }
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      let eventType = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) eventType = line.slice(7).trim();
        else if (line.startsWith("data: ") && eventType) {
          const d = JSON.parse(line.slice(6));
          if (eventType === "start") callbacks.onStart?.(d);
          else if (eventType === "phase") callbacks.onPhase?.(d);
          else if (eventType === "auto_accept") callbacks.onAutoAccept?.(d);
          else if (eventType === "progress") callbacks.onProgress?.(d);
          else if (eventType === "error") callbacks.onError?.(d);
          else if (eventType === "complete") callbacks.onComplete?.(d);
          else if (eventType === "summary") callbacks.onSummary?.(d);
          eventType = "";
        }
      }
    }
  },

  // Reallocate (no AI, re-apply selection rules to cached scores)
  reallocate: (data: { session_id: string; venue_capacity?: number | null; attendee_mix?: Record<string, number>; auto_accept_types?: string[] }) =>
    fetchAPI<{ accepted: number; waitlisted: number; type_counts: Record<string, number> }>("/applicants/reallocate", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Whitelist / Blacklist
  getWhitelist: () => fetchAPI<{ emails: string[] }>("/settings/whitelist"),
  updateWhitelist: (emails: string[]) =>
    fetchAPI<{ emails: string[] }>("/settings/whitelist", { method: "PUT", body: JSON.stringify({ emails }) }),
  getBlacklist: () => fetchAPI<{ emails: string[] }>("/settings/blacklist"),
  updateBlacklist: (emails: string[]) =>
    fetchAPI<{ emails: string[] }>("/settings/blacklist", { method: "PUT", body: JSON.stringify({ emails }) }),

  // Personas
  getPersonas: () =>
    fetchAPI<{ id: string; name: string; emoji: string; specialty: string; description: string; preferred_types: string[]; bias?: string; scoring_modifiers?: string }[]>(
      "/settings/personas"
    ),
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
};
