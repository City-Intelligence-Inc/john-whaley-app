// Shared types for Selecta — used by both web and mobile apps

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
  judge_temperatures?: Record<string, number>;
}

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

// SSE Event Types — Analysis
export interface SSEStartEvent { total: number }
export interface SSEPhaseEvent { phase: string; message: string; type_counts?: Record<string, number>; total?: number }
export interface SSEClassifyEvent { completed: number; total: number; errors: number; applicant_id: string; name: string; attendee_type: string; attendee_type_detail: string; summary: string }
export interface SSEProgressEvent { completed: number; total: number; errors: number; applicant_id: string; name: string; score: number; status: string; reasoning: string; attendee_type: string; attendee_type_detail: string }
export interface SSEErrorEvent { completed: number; total: number; errors: number; applicant_id: string; name: string; error: string }
export interface SSECompleteEvent { completed: number; total: number; errors: number }
export interface SSEAutoAcceptEvent { applicant_id: string; name: string; attendee_type: string; attendee_type_detail: string }
export interface SSESummaryEvent { summary: string }

// SSE Event Types — Judge Panel
export interface SSEJudgeSeatEvent { judge_id: string; judge_name: string; judge_emoji: string; seats_allocated: number; specialty: string }
export interface SSEJudgeStartEvent { judge_id: string; judge_name: string; judge_emoji: string; judge_index: number; total_judges: number; seats_remaining: number }
export interface SSEJudgeProgressEvent { judge_id: string; judge_name: string; judge_emoji: string; applicant_id: string; name: string; score: number; decision: "accept" | "pass"; reasoning: string; seats_filled: number; seats_allocated: number; completed: number; total: number }
export interface SSEJudgeCompleteEvent { judge_id: string; judge_name: string; judge_emoji: string; seats_filled: number; seats_allocated: number; accepted_names: string[] }
export interface SSEAdjudicationEvent { applicant_id: string; name: string; final_status: string; votes_accept: number; votes_total: number; accepting_judges: string[]; avg_score: number }

// SSE Event Types — LinkedIn Enrichment
export interface LinkedInEnrichStartEvent { total: number; job_id?: string }
export interface LinkedInEnrichProgressEvent { completed: number; total: number; applicant_id?: string; name?: string; linkedin_headline?: string; headline?: string; url?: string; image?: string; error?: string | null; retries?: number }
export interface LinkedInEnrichErrorEvent { completed: number; total: number; applicant_id?: string; name?: string; error: string }
export interface LinkedInEnrichCompleteEvent { completed: number; total: number; errors: number; enriched: number }

// Callback interfaces
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

export interface LinkedInEnrichCallbacks {
  onStart?: (data: LinkedInEnrichStartEvent) => void;
  onProgress?: (data: LinkedInEnrichProgressEvent) => void;
  onError?: (data: LinkedInEnrichErrorEvent) => void;
  onComplete?: (data: LinkedInEnrichCompleteEvent) => void;
}

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
