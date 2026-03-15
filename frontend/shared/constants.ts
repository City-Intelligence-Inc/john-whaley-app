// Shared constants for Selecta

export const APP_NAME = "Selecta";

export const ATTENDEE_TYPES = [
  { key: "vc", label: "VCs / Investors", color: "#6366f1" },
  { key: "entrepreneur", label: "Founders / Entrepreneurs", color: "#f59e0b" },
  { key: "faculty", label: "Faculty / Researchers", color: "#10b981" },
  { key: "alumni", label: "Alumni", color: "#3b82f6" },
  { key: "press", label: "Press / Media", color: "#ec4899" },
  { key: "student", label: "Students", color: "#8b5cf6" },
  { key: "other", label: "Other", color: "#6b7280" },
] as const;

export const OTHER_COLORS = [
  "#6b7280", "#9ca3af", "#4b5563", "#78716c",
  "#a1a1aa", "#737373", "#94a3b8", "#64748b",
];

export const ANTHROPIC_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { value: "claude-haiku-4-20250514", label: "Claude Haiku 4" },
] as const;

export const OPENAI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
] as const;

export const PANEL_SIZES = [3, 6, 9, 12] as const;

export const DEFAULT_SELECTION_PREFERENCES = {
  venue_capacity: null,
  attendee_mix: {},
  auto_accept_types: ["student", "faculty", "alumni"],
  relevance_filter: "moderate",
  custom_priorities: "",
  custom_categories: [],
} as const;

export const DEFAULT_PANEL_CONFIG = {
  enabled: false,
  panel_size: 3 as const,
  judge_ids: [] as string[],
  adjudication_mode: "union" as const,
};

export const STATUS_COLORS: Record<string, string> = {
  pending: "text-muted-foreground",
  accepted: "text-emerald-400",
  rejected: "text-red-400",
  waitlisted: "text-amber-400",
};
