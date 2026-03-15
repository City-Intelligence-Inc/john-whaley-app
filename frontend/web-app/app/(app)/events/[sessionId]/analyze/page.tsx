"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Key,
  Brain,
  Loader2,
  Settings2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Terminal,
  CheckCircle2,
  XCircle,
  Plus,
  X,
  ArrowLeft,
  Save,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useEvent } from "@/components/event-provider";
import { RoundtableSelector } from "@/components/roundtable-selector";
import { api } from "@/lib/api";
import {
  ANTHROPIC_MODELS,
  OPENAI_MODELS,
  PANEL_SIZES,
  DEFAULT_PANEL_CONFIG,
  ATTENDEE_TYPES,
} from "@/lib/constants";
import type { PanelConfig, SelectionPreferences, AnalyzeStreamCallbacks } from "@/lib/api";

// ── Console Log Component ──
function ConsoleLog({
  logs,
  logRef,
}: {
  logs: { time: string; message: string; color?: string }[];
  logRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={logRef}
      className="bg-zinc-950 text-green-400 font-mono text-[11px] sm:text-sm rounded-lg border border-zinc-800 p-2 sm:p-4 h-52 sm:h-72 overflow-y-auto overflow-x-hidden"
    >
      {logs.length === 0 && (
        <span className="text-zinc-600">Waiting for activity...</span>
      )}
      {logs.map((log, i) => (
        <div
          key={i}
          className="leading-relaxed break-words"
          style={log.color ? { color: log.color } : undefined}
        >
          <span className="text-zinc-500 hidden sm:inline">[{log.time}]</span>{" "}
          {log.message}
        </div>
      ))}
    </div>
  );
}

// ── Default Selection Preferences ──
const DEFAULT_SELECTION_PREFERENCES: SelectionPreferences = {
  venue_capacity: null,
  attendee_mix: {},
  auto_accept_types: ["student", "faculty", "alumni"],
  relevance_filter: "moderate",
  custom_priorities: "",
  custom_categories: [],
};

export default function AnalyzePage() {
  const router = useRouter();
  const {
    sessionId,
    session,
    applicants,
    refreshApplicants,
    refreshStats,
    refreshAll,
  } = useEvent();

  // ── AI Provider Config ──
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("claude-sonnet-4-20250514");

  // ── Review Mode ──
  const [panelConfig, setPanelConfig] = useState<PanelConfig>({
    ...DEFAULT_PANEL_CONFIG,
  });
  const [personaEdits, setPersonaEdits] = useState<Record<string, string>>({});

  // ── Prompt & Criteria ──
  const [prompt, setPrompt] = useState(
    "Evaluate each applicant based on their background and relevance to the event."
  );
  const [criteria, setCriteria] = useState<string[]>([
    "Relevant experience and expertise",
    "Industry or academic standing",
    "Potential to contribute value as an attendee",
  ]);
  const [newCriterion, setNewCriterion] = useState("");
  const [savingPrompt, setSavingPrompt] = useState(false);

  // ── Selection Preferences ──
  const [selectionPreferences, setSelectionPreferences] =
    useState<SelectionPreferences>({ ...DEFAULT_SELECTION_PREFERENCES });

  // ── Analysis Progress ──
  const [analyzing, setAnalyzing] = useState(false);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<{
    completed: number;
    total: number;
    errors: number;
  } | null>(null);
  const [logs, setLogs] = useState<
    { time: string; message: string; color?: string }[]
  >([]);
  const logRef = useRef<HTMLDivElement>(null);

  // ── Collapsible sections ──
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Models for current provider
  const models = useMemo(
    () => (provider === "anthropic" ? ANTHROPIC_MODELS : OPENAI_MODELS),
    [provider]
  );

  // ── Load persisted state from localStorage ──
  useEffect(() => {
    const savedKey = localStorage.getItem("ai_api_key") || "";
    const savedProvider = localStorage.getItem("ai_provider") || "anthropic";
    const savedModel =
      localStorage.getItem("ai_model") || "claude-sonnet-4-20250514";
    setApiKey(savedKey);
    setProvider(savedProvider);
    setModel(savedModel);

    // Panel config
    try {
      const savedPanel = localStorage.getItem("panel_config");
      if (savedPanel) setPanelConfig(JSON.parse(savedPanel));
    } catch {
      // ignore parse errors
    }
    // Persona edits
    try {
      const savedEdits = localStorage.getItem("persona_edits");
      if (savedEdits) setPersonaEdits(JSON.parse(savedEdits));
    } catch {
      // ignore parse errors
    }
  }, []);

  // ── Load prompt settings + selection preferences from backend ──
  useEffect(() => {
    api
      .getPromptSettings()
      .then((s) => {
        if (s.default_prompt) setPrompt(s.default_prompt);
        if (s.criteria?.length) setCriteria(s.criteria);
      })
      .catch(() => {});
    api
      .getSelectionPreferences()
      .then((prefs) => {
        if (prefs) setSelectionPreferences(prefs);
      })
      .catch(() => {});
  }, []);

  // ── Persist AI config to localStorage ──
  useEffect(() => {
    if (apiKey) localStorage.setItem("ai_api_key", apiKey);
    localStorage.setItem("ai_provider", provider);
    localStorage.setItem("ai_model", model);
  }, [apiKey, provider, model]);

  // ── Persist panel config + persona edits ──
  useEffect(() => {
    localStorage.setItem("panel_config", JSON.stringify(panelConfig));
  }, [panelConfig]);
  useEffect(() => {
    localStorage.setItem("persona_edits", JSON.stringify(personaEdits));
  }, [personaEdits]);

  // ── Auto-scroll console logs ──
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  // ── Provider Change ──
  const handleProviderChange = useCallback((p: string) => {
    setProvider(p);
    setModel(
      p === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o"
    );
  }, []);

  // ── Criteria Helpers ──
  const addCriterion = useCallback(() => {
    const value = newCriterion.trim();
    if (value && !criteria.includes(value)) {
      setCriteria((prev) => [...prev, value]);
      setNewCriterion("");
    }
  }, [newCriterion, criteria]);

  const removeCriterion = useCallback((c: string) => {
    setCriteria((prev) => prev.filter((x) => x !== c));
  }, []);

  // ── Save Prompt Settings ──
  const handleSavePrompt = useCallback(async () => {
    setSavingPrompt(true);
    try {
      await api.updatePromptSettings({ default_prompt: prompt, criteria });
      toast.success("Prompt settings saved");
    } catch {
      toast.error("Failed to save prompt settings");
    } finally {
      setSavingPrompt(false);
    }
  }, [prompt, criteria]);

  // ── Persona edit handlers for roundtable ──
  const handleToggleJudge = useCallback((judgeId: string) => {
    setPanelConfig((p) => {
      const has = p.judge_ids.includes(judgeId);
      if (has)
        return {
          ...p,
          judge_ids: p.judge_ids.filter((id) => id !== judgeId),
        };
      if (p.judge_ids.length >= p.panel_size) return p;
      return { ...p, judge_ids: [...p.judge_ids, judgeId] };
    });
  }, []);

  const handleUpdatePersonaEdit = useCallback(
    (judgeId: string, text: string) => {
      setPersonaEdits((prev) => ({ ...prev, [judgeId]: text }));
    },
    []
  );

  const handleResetPersonaEdit = useCallback((judgeId: string) => {
    setPersonaEdits((prev) => {
      const next = { ...prev };
      delete next[judgeId];
      return next;
    });
  }, []);

  const handleSaveCustomJudge = useCallback(
    async (judgeId: string, description: string) => {
      try {
        await api.updatePersona(judgeId, { description });
        toast.success("Custom judge persona saved");
      } catch {
        toast.error("Failed to save custom judge persona");
      }
    },
    []
  );

  const handleUpdateTemperature = useCallback(
    (judgeId: string, temp: number) => {
      setPanelConfig((p) => ({
        ...p,
        judge_temperatures: {
          ...(p.judge_temperatures || {}),
          [judgeId]: temp,
        },
      }));
    },
    []
  );

  // ── Run Analysis ──
  const handleAnalyze = useCallback(async () => {
    if (!apiKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }
    if (applicants.length === 0) {
      toast.error("No applicants to analyze");
      return;
    }

    const prefs = selectionPreferences;
    const pc = panelConfig;
    const isPanelMode = pc.enabled && (pc.judge_ids?.length ?? 0) > 0;

    setShowAnalysisDialog(true);
    setLogs([]);
    setAnalysisProgress(null);
    setAnalyzing(true);

    const modelLabel =
      models.find((m) => m.value === model)?.label || model;

    const log = (msg: string, color?: string) => {
      const now = new Date();
      const time = now.toLocaleTimeString("en-US", { hour12: false });
      setLogs((prev) => [...prev, { time, message: msg, color }]);
    };

    log(
      isPanelMode
        ? `Starting Judge Panel analysis (${pc.judge_ids.length} judges, ${pc.adjudication_mode} mode)...`
        : `Starting 2-pass analysis...`
    );
    log(
      `Provider: ${provider === "anthropic" ? "Anthropic" : "OpenAI"} | Model: ${modelLabel}`
    );
    log(
      `Prompt: "${prompt.substring(0, 80)}${prompt.length > 80 ? "..." : ""}"`
    );
    log(`Criteria: ${criteria.join(", ")}`);
    if (prefs.venue_capacity) {
      log(`Venue capacity: ${prefs.venue_capacity}`);
    }
    if (prefs.auto_accept_types.length > 0) {
      log(`Auto-accept: ${prefs.auto_accept_types.join(", ")}`);
    }
    log(`Relevance filter: ${prefs.relevance_filter}`);

    let acceptedCount = 0;
    let autoAcceptedCount = 0;
    let waitlistedCount = 0;
    let rejectedCount = 0;
    const typeTally: Record<string, number> = {};
    const typeNames: Record<string, string[]> = {};
    const numJudges = isPanelMode ? pc.judge_ids.length : 0;

    try {
      await api.updatePromptSettings({ default_prompt: prompt, criteria });
      log("Saved prompt settings.");

      await api.analyzeAllStream(
        {
          api_key: apiKey,
          model,
          provider,
          prompt,
          criteria,
          session_id: sessionId,
          selection_preferences: prefs,
          panel_config: isPanelMode ? pc : undefined,
        },
        {
          onStart: (data) => {
            const progressTotal = isPanelMode
              ? data.total + data.total * numJudges + data.total
              : data.total + data.total;
            setAnalysisProgress({
              completed: 0,
              total: progressTotal,
              errors: 0,
            });
            log(
              `${data.total} applicants to analyze${isPanelMode ? ` with ${numJudges} judges` : ""}`
            );
          },
          onPhase: (data) => {
            log("");
            log("=".repeat(60), "#6366f1");
            log(data.message, "#6366f1");
            log("=".repeat(60), "#6366f1");

            // Show pool summary after classification
            if (data.phase === "pool_summary" && data.type_counts) {
              const total = data.total || 0;
              for (const t of ATTENDEE_TYPES) {
                const count = data.type_counts[t.key] || 0;
                const pct =
                  total > 0 ? Math.round((count / total) * 100) : 0;
                const bar =
                  "\u2588".repeat(Math.max(1, Math.round(pct / 3))) +
                  (count === 0 ? "\u2591" : "");
                const names =
                  typeNames[t.key]?.slice(0, 4).join(", ") || "\u2014";
                const moreCount = (typeNames[t.key]?.length || 0) - 4;
                log(
                  `  ${t.label.padEnd(24)} ${String(count).padStart(3)} (${String(pct).padStart(2)}%) ${bar}`,
                  t.color
                );
                if (count > 0) {
                  log(
                    `     \u2514\u2500 ${names}${moreCount > 0 ? `, +${moreCount} more` : ""}`,
                    "#9ca3af"
                  );
                }
              }
            }
          },
          onClassify: (data) => {
            setAnalysisProgress((prev) => ({
              completed: (prev?.completed || 0) + 1,
              total: prev?.total || data.total * 2,
              errors: prev?.errors || 0,
            }));

            const type = data.attendee_type || "other";
            const typeLabel =
              ATTENDEE_TYPES.find((t) => t.key === type)?.label || type;
            const detail = data.attendee_type_detail || typeLabel;
            typeTally[type] = (typeTally[type] || 0) + 1;
            if (!typeNames[type]) typeNames[type] = [];
            typeNames[type].push(data.name);

            const typeColor = ATTENDEE_TYPES.find(
              (t) => t.key === type
            )?.color;
            log(
              `[${data.completed}/${data.total}] ${data.name}  \u2192  ${typeLabel}  \u00b7  ${detail}`,
              typeColor
            );
            if (data.summary) {
              log(`   \u2514\u2500 ${data.summary}`, "#9ca3af");
            }
          },
          onClassifyError: (data) => {
            setAnalysisProgress((prev) => ({
              completed: (prev?.completed || 0) + 1,
              total: prev?.total || data.total * 2,
              errors: (prev?.errors || 0) + 1,
            }));
            let errMsg = data.error || "Unknown error";
            if (errMsg.includes("authentication_error"))
              errMsg = "API key is invalid or expired";
            else if (errMsg.includes("rate_limit"))
              errMsg = "Rate limit exceeded -- too many requests";
            else if (
              errMsg.includes("insufficient_quota") ||
              errMsg.includes("billing")
            )
              errMsg = "API quota exceeded -- add credits";
            log(
              `[${data.completed}/${data.total}] ${data.name} -- ERROR: ${errMsg}`,
              "#ef4444"
            );
          },
          onAutoAccept: (data) => {
            autoAcceptedCount++;
            acceptedCount++;
            const detail = data.attendee_type_detail || data.attendee_type;
            log(
              `[AUTO] ${data.name}  \u00b7  ${detail}  \u00b7  Score: 100  \u00b7  ACCEPTED`,
              "#22c55e"
            );
          },
          onProgress: (data) => {
            setAnalysisProgress((prev) => ({
              completed: (prev?.completed || 0) + 1,
              total: prev?.total || data.total * 2,
              errors: prev?.errors || 0,
            }));

            const detail =
              data.attendee_type_detail || data.attendee_type || "";
            const statusColor =
              data.status === "accepted"
                ? "#22c55e"
                : data.status === "rejected"
                  ? "#ef4444"
                  : data.status === "waitlisted"
                    ? "#eab308"
                    : undefined;
            const statusLabel = data.status.toUpperCase();

            log(
              `[${data.completed}/${data.total}] ${data.name}  \u00b7  ${detail}  \u00b7  Score: ${data.score}  \u00b7  ${statusLabel}`,
              statusColor
            );
            if (data.reasoning) {
              log(`   \u2514\u2500 ${data.reasoning}`, "#9ca3af");
            }

            if (data.status === "accepted") acceptedCount++;
            else if (data.status === "waitlisted") waitlistedCount++;
            else if (data.status === "rejected") rejectedCount++;
          },
          onError: (data) => {
            setAnalysisProgress((prev) => ({
              completed: (prev?.completed || 0) + 1,
              total: prev?.total || data.total * 2,
              errors: (prev?.errors || 0) + 1,
            }));
            let errMsg = data.error || "Unknown error";
            if (errMsg.includes("authentication_error"))
              errMsg = "API key is invalid or expired";
            else if (errMsg.includes("rate_limit"))
              errMsg = "Rate limit exceeded -- too many requests";
            else if (
              errMsg.includes("insufficient_quota") ||
              errMsg.includes("billing")
            )
              errMsg = "API quota exceeded -- add credits";
            log(
              `[${data.completed}/${data.total}] ${data.name} -- ERROR: ${errMsg}`,
              "#ef4444"
            );
          },
          onComplete: (data) => {
            setAnalysisProgress((prev) => ({
              completed: prev?.total || data.total * 2,
              total: prev?.total || data.total * 2,
              errors: data.errors,
            }));
            log("");
            const allFailed = data.errors >= data.completed;
            const color = allFailed
              ? "#ef4444"
              : data.errors > 0
                ? "#eab308"
                : "#22c55e";
            log("=".repeat(60), color);
            if (allFailed) {
              log(
                `FAILED: All ${data.errors} applicants had errors. Check your API key.`,
                "#ef4444"
              );
            } else {
              const autoNote =
                autoAcceptedCount > 0
                  ? ` (${autoAcceptedCount} auto-accepted)`
                  : "";
              log(
                `DONE: ${acceptedCount} accepted${autoNote}, ${waitlistedCount} waitlisted, ${rejectedCount} rejected` +
                  (data.errors > 0 ? ` (${data.errors} errors)` : ""),
                color
              );
            }
            log("=".repeat(60), color);

            // Capacity warning
            if (
              prefs.venue_capacity &&
              acceptedCount > prefs.venue_capacity
            ) {
              log("");
              log(
                `WARNING: ${acceptedCount} accepted exceeds venue capacity of ${prefs.venue_capacity}!`,
                "#eab308"
              );
            }
            log("");
            log("Generating overall summary...", "#9ca3af");
          },
          onSummary: (data) => {
            log("");
            log("=".repeat(60), "#6366f1");
            log("OVERALL ANALYSIS SUMMARY", "#6366f1");
            log("=".repeat(60), "#6366f1");
            log(data.summary, "#e2e8f0");
            log("=".repeat(60), "#6366f1");
          },
          onJudgeSeats: (data) => {
            log(
              `  ${data.judge_emoji} ${data.judge_name}: ${data.seats_allocated} seats (${data.specialty})`,
              "#a78bfa"
            );
          },
          onJudgeStart: (data) => {
            log("");
            log("-".repeat(60), "#8b5cf6");
            log(
              `${data.judge_emoji} ${data.judge_name} reviewing (judge ${data.judge_index + 1}/${data.total_judges}, ${data.seats_remaining} seats)...`,
              "#8b5cf6"
            );
            log("-".repeat(60), "#8b5cf6");
          },
          onJudgeProgress: (data) => {
            setAnalysisProgress((prev) => ({
              completed: (prev?.completed || 0) + 1,
              total: prev?.total || 1,
              errors: prev?.errors || 0,
            }));
            const decisionColor =
              data.decision === "accept" ? "#22c55e" : "#6b7280";
            const decisionLabel =
              data.decision === "accept" ? "ACCEPT" : "pass";
            log(
              `  [${data.completed}/${data.total}] ${data.name}  \u00b7  Score: ${data.score}  \u00b7  ${decisionLabel}`,
              decisionColor
            );
          },
          onJudgeComplete: (data) => {
            const names = data.accepted_names.slice(0, 5).join(", ");
            const moreCount = data.accepted_names.length - 5;
            log(
              `  ${data.judge_emoji} Done: ${data.seats_filled}/${data.seats_allocated} seats filled`,
              "#a78bfa"
            );
            if (data.accepted_names.length > 0) {
              log(
                `  \u2514\u2500 Top picks: ${names}${moreCount > 0 ? `, +${moreCount} more` : ""}`,
                "#9ca3af"
              );
            }
          },
          onAdjudication: (data) => {
            setAnalysisProgress((prev) => ({
              completed: (prev?.completed || 0) + 1,
              total: prev?.total || 1,
              errors: prev?.errors || 0,
            }));
            const statusColor =
              data.final_status === "accepted" ? "#22c55e" : "#eab308";
            const judges =
              data.accepting_judges.join(", ") || "none";
            log(
              `  ${data.name}  \u00b7  ${data.votes_accept}/${data.votes_total} votes  \u00b7  ${data.final_status.toUpperCase()}  \u00b7  Score: ${data.avg_score}`,
              statusColor
            );
            if (data.votes_accept > 0) {
              log(
                `     \u2514\u2500 Accepted by: ${judges}`,
                "#9ca3af"
              );
            }
            if (data.final_status === "accepted") acceptedCount++;
            else if (data.final_status === "waitlisted") waitlistedCount++;
          },
        } as AnalyzeStreamCallbacks
      );

      const allErrored =
        acceptedCount + waitlistedCount + rejectedCount === 0;
      if (allErrored) {
        toast.error("Analysis failed -- check your API key");
      } else {
        toast.success(
          `Analysis complete: ${acceptedCount} accepted, ${waitlistedCount} waitlisted, ${rejectedCount} rejected`
        );
      }

      await refreshAll();
      setAnalyzing(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      log(`ERROR: ${msg}`, "red");
      toast.error(msg);
      setAnalyzing(false);
    }
  }, [
    apiKey,
    applicants.length,
    selectionPreferences,
    panelConfig,
    models,
    model,
    provider,
    prompt,
    criteria,
    sessionId,
    refreshAll,
  ]);

  // ── Progress Percentage ──
  const progressPercent = useMemo(() => {
    if (!analysisProgress || analysisProgress.total === 0) return 0;
    return Math.round(
      (analysisProgress.completed / analysisProgress.total) * 100
    );
  }, [analysisProgress]);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push(`/events/${sessionId}`)}
          className="shrink-0"
        >
          <ArrowLeft className="size-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Run Analysis
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {session?.name || "Event"} &middot; {applicants.length}{" "}
            {applicants.length === 1 ? "applicant" : "applicants"}
          </p>
        </div>
      </div>

      {/* ── AI Provider Config ── */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Key className="size-4" />
            AI Provider
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Provider</Label>
              <Select value={provider} onValueChange={handleProviderChange}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Model</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs">API Key</Label>
              <a
                href={
                  provider === "openai"
                    ? "https://platform.openai.com/api-keys"
                    : "https://console.anthropic.com/settings/keys"
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-blue-500 hover:underline"
              >
                Get your {provider === "openai" ? "OpenAI" : "Anthropic"} key
              </a>
            </div>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Paste your API key here..."
                className="pr-10 h-9 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Review Mode ── */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Settings2 className="size-4" />
            Review Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Toggle */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() =>
                setPanelConfig((p) => ({ ...p, enabled: false }))
              }
              className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-colors ${
                !panelConfig.enabled
                  ? "border-gold bg-gold/5"
                  : "border-muted hover:bg-muted/50"
              }`}
            >
              <Brain className="size-6 text-muted-foreground" />
              <span className="text-sm font-medium">Single AI</span>
              <span className="text-[10px] text-muted-foreground">
                One model reviews all
              </span>
            </button>
            <button
              onClick={() =>
                setPanelConfig((p) => ({ ...p, enabled: true }))
              }
              className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-colors ${
                panelConfig.enabled
                  ? "border-gold bg-gold/5"
                  : "border-muted hover:bg-muted/50"
              }`}
            >
              <Sparkles className="size-6 text-muted-foreground" />
              <span className="text-sm font-medium">Judge Panel</span>
              <span className="text-[10px] text-muted-foreground">
                Multiple AI personas
              </span>
            </button>
          </div>

          {/* Panel Config (only when panel mode is enabled) */}
          {panelConfig.enabled && (
            <div className="space-y-4 pt-2">
              {/* Panel Size */}
              <div className="space-y-1.5">
                <Label className="text-xs">Panel Size</Label>
                <Select
                  value={String(panelConfig.panel_size)}
                  onValueChange={(v) =>
                    setPanelConfig((p) => ({
                      ...p,
                      panel_size: parseInt(v) as 3 | 6 | 9 | 12,
                      judge_ids: p.judge_ids.slice(0, parseInt(v)),
                    }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PANEL_SIZES.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {size} judges
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Adjudication Mode */}
              <div className="space-y-2">
                <Label className="text-xs">Adjudication Mode</Label>
                <RadioGroup
                  value={panelConfig.adjudication_mode}
                  onValueChange={(v) =>
                    setPanelConfig((p) => ({
                      ...p,
                      adjudication_mode: v as "union" | "majority",
                    }))
                  }
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="union" id="adj-union" />
                    <Label htmlFor="adj-union" className="text-sm">
                      Union
                    </Label>
                    <span className="text-[10px] text-muted-foreground">
                      (any judge can accept)
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="majority" id="adj-majority" />
                    <Label htmlFor="adj-majority" className="text-sm">
                      Majority
                    </Label>
                    <span className="text-[10px] text-muted-foreground">
                      (majority must agree)
                    </span>
                  </div>
                </RadioGroup>
              </div>

              {/* Roundtable Selector */}
              <div className="flex justify-center">
                <RoundtableSelector
                  panelSize={panelConfig.panel_size}
                  judgeIds={panelConfig.judge_ids}
                  personaEdits={personaEdits}
                  judgeTemperatures={panelConfig.judge_temperatures}
                  onToggleJudge={handleToggleJudge}
                  onUpdatePersonaEdit={handleUpdatePersonaEdit}
                  onResetPersonaEdit={handleResetPersonaEdit}
                  onSaveCustomJudge={handleSaveCustomJudge}
                  onUpdateTemperature={handleUpdateTemperature}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Prompt & Criteria ── */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Terminal className="size-4" />
            Prompt & Criteria
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Default Prompt */}
          <div className="space-y-1.5">
            <Label className="text-xs">Default Prompt</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[80px] resize-y text-sm"
              placeholder="Describe how applicants should be evaluated..."
            />
          </div>

          {/* Criteria */}
          <div className="space-y-2">
            <Label className="text-xs">Criteria</Label>
            <div className="flex flex-wrap gap-1.5">
              {criteria.map((c) => (
                <Badge
                  key={c}
                  variant="secondary"
                  className="text-xs pr-1 gap-1"
                >
                  {c}
                  <button
                    onClick={() => removeCriterion(c)}
                    className="ml-0.5 hover:text-destructive transition-colors"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newCriterion}
                onChange={(e) => setNewCriterion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCriterion();
                  }
                }}
                placeholder="Add a criterion..."
                className="h-8 text-sm flex-1"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={addCriterion}
                disabled={!newCriterion.trim()}
                className="h-8 px-3"
              >
                <Plus className="size-3.5 mr-1" />
                Add
              </Button>
            </div>
          </div>

          {/* Save Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSavePrompt}
            disabled={savingPrompt}
            className="w-full"
          >
            {savingPrompt ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="size-3.5 mr-1.5" />
            )}
            Save Prompt Settings
          </Button>
        </CardContent>
      </Card>

      {/* ── Advanced Settings (collapsible) ── */}
      <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-sm text-muted-foreground gap-1.5 w-full justify-center"
          >
            {showAdvanced ? (
              <ChevronUp className="size-4" />
            ) : (
              <ChevronDown className="size-4" />
            )}
            {showAdvanced ? "Hide" : "Show"} Advanced Settings
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <Card className="border-border/50 bg-card/50">
            <CardContent className="pt-6 space-y-4">
              {/* Venue Capacity */}
              <div className="space-y-1.5">
                <Label className="text-xs">Venue Capacity</Label>
                <Input
                  type="number"
                  value={selectionPreferences.venue_capacity ?? ""}
                  onChange={(e) =>
                    setSelectionPreferences((prev) => ({
                      ...prev,
                      venue_capacity: e.target.value
                        ? parseInt(e.target.value)
                        : null,
                    }))
                  }
                  placeholder="Leave blank for unlimited"
                  className="h-9 text-sm"
                />
              </div>

              {/* Relevance Filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Relevance Filter</Label>
                <Select
                  value={selectionPreferences.relevance_filter}
                  onValueChange={(v) =>
                    setSelectionPreferences((prev) => ({
                      ...prev,
                      relevance_filter: v,
                    }))
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="strict">Strict</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Auto-Accept Types */}
              <div className="space-y-2">
                <Label className="text-xs">Auto-Accept Types</Label>
                <div className="flex flex-wrap gap-2">
                  {ATTENDEE_TYPES.map((type) => (
                    <button
                      key={type.key}
                      onClick={() =>
                        setSelectionPreferences((prev) => ({
                          ...prev,
                          auto_accept_types:
                            prev.auto_accept_types.includes(type.key)
                              ? prev.auto_accept_types.filter(
                                  (t) => t !== type.key
                                )
                              : [...prev.auto_accept_types, type.key],
                        }))
                      }
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        selectionPreferences.auto_accept_types.includes(
                          type.key
                        )
                          ? "border-gold bg-gold/10 text-gold"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Priorities */}
              <div className="space-y-1.5">
                <Label className="text-xs">Custom Priorities</Label>
                <Textarea
                  value={selectionPreferences.custom_priorities}
                  onChange={(e) =>
                    setSelectionPreferences((prev) => ({
                      ...prev,
                      custom_priorities: e.target.value,
                    }))
                  }
                  className="min-h-[60px] resize-y text-sm"
                  placeholder="Any special priorities or instructions for selection..."
                />
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* ── Run Analysis Button ── */}
      <Button
        onClick={handleAnalyze}
        disabled={analyzing || !apiKey.trim() || applicants.length === 0}
        className="w-full h-14 text-lg font-semibold bg-gold hover:bg-gold/90 text-gold-foreground shadow-lg shadow-gold/20 transition-all"
      >
        {analyzing ? (
          <>
            <Loader2 className="size-5 mr-2 animate-spin" />
            Analysis Running...
          </>
        ) : (
          <>
            <Sparkles className="size-5 mr-2" />
            Run Analysis
          </>
        )}
      </Button>

      {!apiKey.trim() && (
        <p className="text-xs text-center text-muted-foreground -mt-3">
          Enter an API key above to enable analysis
        </p>
      )}
      {applicants.length === 0 && (
        <p className="text-xs text-center text-muted-foreground -mt-3">
          Import applicants first to run analysis
        </p>
      )}

      {/* ── Analysis Progress Dialog ── */}
      <Dialog
        open={showAnalysisDialog}
        onOpenChange={(open) => {
          if (!analyzing) setShowAnalysisDialog(open);
        }}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {analyzing ? (
                <>
                  <Loader2 className="size-5 animate-spin text-gold" />
                  Analysis in Progress
                </>
              ) : analysisProgress &&
                analysisProgress.errors >= analysisProgress.completed ? (
                <>
                  <XCircle className="size-5 text-destructive" />
                  Analysis Failed
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-5 text-emerald-400" />
                  Analysis Complete
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 flex-1 min-h-0 overflow-y-auto">
            {/* Progress Bar */}
            {analysisProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {analysisProgress.completed} / {analysisProgress.total}
                  </span>
                  <span>{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
                {analysisProgress.errors > 0 && (
                  <p className="text-xs text-destructive">
                    {analysisProgress.errors} error
                    {analysisProgress.errors !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            )}

            {/* Console Log */}
            <ConsoleLog logs={logs} logRef={logRef} />
          </div>

          {/* Footer */}
          {!analyzing && (
            <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
              <Button
                variant="outline"
                onClick={() => setShowAnalysisDialog(false)}
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  setShowAnalysisDialog(false);
                  router.push(`/events/${sessionId}`);
                }}
                className="bg-gold hover:bg-gold/90 text-gold-foreground"
              >
                View Results
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
