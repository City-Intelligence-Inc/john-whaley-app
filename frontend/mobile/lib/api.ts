import * as SecureStore from 'expo-secure-store';

const API_URL = "https://aicm3pweed.us-east-1.awsapprunner.com";

// Inline types (no dependency on shared/ which isn't available in EAS build)
export interface Session {
  session_id: string;
  name: string;
  created_at: string;
  source: string;
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
  status: string;
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

let _getToken: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: () => Promise<string | null>) {
  _getToken = getter;
}

async function fetchAPI<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (_getToken) {
    const token = await _getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API ${res.status}`);
  }

  return res.json();
}

// Sessions
export async function getSessions() {
  return fetchAPI<Session[]>('/sessions');
}

export async function getSession(sessionId: string) {
  return fetchAPI<Session>(`/sessions/${sessionId}`);
}

export async function createSession(name: string) {
  return fetchAPI<Session>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ name, source: 'manual' }),
  });
}

export async function deleteSession(sessionId: string) {
  return fetchAPI<{ detail: string }>(`/sessions/${sessionId}`, { method: 'DELETE' });
}

// Applicants
export async function getApplicants(sessionId: string) {
  return fetchAPI<Applicant[]>(`/applicants?session_id=${sessionId}`);
}

export async function getStats(sessionId: string) {
  return fetchAPI<Stats>(`/applicants/stats?session_id=${sessionId}`);
}

export async function updateApplicantStatus(applicantId: string, status: string) {
  return fetchAPI<Applicant>(`/applicants/${applicantId}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

export async function batchUpdateStatus(applicantIds: string[], status: string) {
  return fetchAPI<{ updated: string[] }>('/applicants/batch-status', {
    method: 'PUT',
    body: JSON.stringify({ applicant_ids: applicantIds, status }),
  });
}

// Settings
export async function getWhitelist() {
  return fetchAPI<{ emails: string[] }>('/settings/whitelist');
}

export async function updateWhitelist(emails: string[]) {
  return fetchAPI<{ emails: string[] }>('/settings/whitelist', {
    method: 'PUT',
    body: JSON.stringify({ emails }),
  });
}

export async function getBlacklist() {
  return fetchAPI<{ emails: string[] }>('/settings/blacklist');
}

export async function updateBlacklist(emails: string[]) {
  return fetchAPI<{ emails: string[] }>('/settings/blacklist', {
    method: 'PUT',
    body: JSON.stringify({ emails }),
  });
}

// LinkedIn database
export async function getLinkedInProfiles() {
  return fetchAPI<{ items: unknown[]; count: number }>('/linkedin/database');
}

// Luma
export async function getLumaEvents() {
  return fetchAPI<{ entries: { api_id: string; name: string; start_at: string }[] }>('/luma/events');
}

export async function importFromLuma(eventId: string) {
  return fetchAPI<{ count: number; session_id: string }>(`/luma/import?event_id=${eventId}`, {
    method: 'POST',
  });
}

// SecureStore helpers
export async function getStoredApiKey(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('api_key');
  } catch {
    return null;
  }
}

export async function setStoredApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync('api_key', key);
}

export async function deleteStoredApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync('api_key');
}
