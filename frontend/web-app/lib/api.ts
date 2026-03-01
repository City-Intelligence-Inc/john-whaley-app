const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Session {
  session_id: string;
  name: string;
  created_at: string;
  source: string;
  source_detail?: string;
  applicant_count: number;
  status: string;
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

export interface BulkAnalyzeRequest {
  api_key: string;
  model: string;
  provider: string;
  prompt: string;
  criteria: string[];
  criteria_weights?: string[];
  session_id?: string;
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

export interface AnalyzeStreamCallbacks {
  onStart?: (data: SSEStartEvent) => void;
  onPhase?: (data: SSEPhaseEvent) => void;
  onClassify?: (data: SSEClassifyEvent) => void;
  onClassifyError?: (data: SSEErrorEvent) => void;
  onProgress?: (data: SSEProgressEvent) => void;
  onError?: (data: SSEErrorEvent) => void;
  onComplete?: (data: SSECompleteEvent) => void;
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
          else if (eventType === "progress") callbacks.onProgress?.(data);
          else if (eventType === "error") callbacks.onError?.(data);
          else if (eventType === "complete") callbacks.onComplete?.(data);
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
};
