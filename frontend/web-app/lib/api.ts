const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface Applicant {
  applicant_id: string;
  name?: string;
  email?: string;
  linkedin_url?: string;
  company?: string;
  title?: string;
  location?: string;
  status: string;
  ai_review?: string;
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

export interface ReviewRequest {
  api_key: string;
  model: string;
  provider: string;
  prompt?: string;
  criteria?: string[];
}

async function fetchAPI<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "API request failed");
  }

  return res.json();
}

export const api = {
  // Applicants
  listApplicants: () => fetchAPI<Applicant[]>("/applicants"),

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

  // CSV Upload
  uploadCSV: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_URL}/applicants/upload-csv`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(error.detail || "Upload failed");
    }
    return res.json() as Promise<{ count: number; items: Applicant[] }>;
  },

  // Stats
  getStats: () => fetchAPI<Stats>("/applicants/stats"),

  // Batch status
  batchUpdateStatus: (applicantIds: string[], status: string) =>
    fetchAPI<{ updated: string[] }>("/applicants/batch-status", {
      method: "PUT",
      body: JSON.stringify({ applicant_ids: applicantIds, status }),
    }),

  // AI Review
  reviewApplicant: (id: string, data: ReviewRequest) =>
    fetchAPI<Applicant>(`/applicants/${id}/review`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Settings
  getPromptSettings: () => fetchAPI<PromptSettings>("/settings/prompts"),

  updatePromptSettings: (data: PromptSettings) =>
    fetchAPI<PromptSettings>("/settings/prompts", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
