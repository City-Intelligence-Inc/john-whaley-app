"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Key,
  Brain,
  ListChecks,
  Plus,
  X,
  Loader2,
  GripVertical,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  ExternalLink,
  Mail,
  Building2,
  MapPin,
  Sparkles,
  Users,
  RotateCcw,
  Terminal,
  Linkedin,
  Eye,
  EyeOff,
  Upload,
  Settings2,
  Search,
  Download,
  Sheet,
  RefreshCw,
  Unplug,
  Link,
  ChevronLeft,
  ChevronRight,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { api, type Applicant } from "@/lib/api";
import { useApplicants, useStats } from "@/hooks/use-applicants";
import { CSVUploader } from "@/components/csv-uploader";

type Step = "setup" | "configure" | "analyze" | "results";

const STEPS: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: "setup", label: "Upload", icon: Upload },
  { key: "configure", label: "Criteria", icon: Brain },
  { key: "analyze", label: "Review", icon: Terminal },
  { key: "results", label: "Results", icon: ListChecks },
];

const ANTHROPIC_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { value: "claude-haiku-4-20250514", label: "Claude Haiku 4" },
];

const OPENAI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
];

/* ── Results sub-components ── */

function ApplicantRow({
  applicant,
  rank,
  onStatusChange,
}: {
  applicant: Applicant;
  rank: number;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const score = applicant.ai_score ? parseInt(applicant.ai_score) : 0;
  const scoreColor =
    score >= 70
      ? "text-green-600 dark:text-green-400"
      : score >= 40
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";

  const displayName =
    applicant.name ||
    applicant.email ||
    (applicant.title && applicant.company ? `${applicant.title} @ ${applicant.company}` : null) ||
    applicant.company ||
    "Unknown";

  return (
    <div className="border rounded-lg">
      <div
        className="flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-base font-mono text-muted-foreground w-8 text-right shrink-0">
          {rank}.
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-medium truncate">{displayName}</span>
            {applicant.title && applicant.company && (
              <span className="text-sm text-muted-foreground truncate hidden sm:inline">
                {applicant.title} @ {applicant.company}
              </span>
            )}
          </div>
        </div>
        {score > 0 && (
          <span className={`text-lg font-bold tabular-nums ${scoreColor}`}>{score}</span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" size="sm" className="h-9 text-sm px-3">
              <ArrowRightLeft className="size-4 mr-1.5" />
              Move
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onStatusChange(applicant.applicant_id, "accepted")} className="text-base py-2">
              <CheckCircle2 className="size-5 mr-2 text-green-500" />
              Accept
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange(applicant.applicant_id, "waitlisted")} className="text-base py-2">
              <Clock className="size-5 mr-2 text-yellow-500" />
              Waitlist
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange(applicant.applicant_id, "rejected")} className="text-base py-2">
              <XCircle className="size-5 mr-2 text-red-500" />
              Reject
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {expanded ? (
          <ChevronUp className="size-5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-5 text-muted-foreground shrink-0" />
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t bg-muted/30">
          <div className="grid gap-2.5 text-base ml-11">
            {applicant.email && (
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" />
                <a href={`mailto:${applicant.email}`} className="hover:underline">
                  {applicant.email}
                </a>
              </div>
            )}
            {applicant.linkedin_url && (
              <div className="flex items-center gap-2">
                <Linkedin className="size-4 text-muted-foreground" />
                <a
                  href={applicant.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center gap-1 text-blue-600 dark:text-blue-400"
                >
                  LinkedIn Profile
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            )}
            {applicant.company && (
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                <span>
                  {applicant.title ? `${applicant.title} @ ${applicant.company}` : applicant.company}
                </span>
              </div>
            )}
            {applicant.location && (
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                <span>{applicant.location}</span>
              </div>
            )}
            {applicant.ai_reasoning && (
              <div className="flex items-start gap-2 mt-1">
                <Sparkles className="size-4 text-muted-foreground mt-0.5" />
                <p className="text-muted-foreground italic">{applicant.ai_reasoning}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultSection({
  title,
  icon: Icon,
  iconColor,
  applicants,
  onStatusChange,
  defaultOpen = true,
  searchQuery = "",
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  applicants: Applicant[];
  onStatusChange: (id: string, status: string) => void;
  defaultOpen?: boolean;
  searchQuery?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const sorted = useMemo(() => {
    let filtered = [...applicants];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter((a) => {
        const name = (a.name || "").toLowerCase();
        const email = (a.email || "").toLowerCase();
        const company = (a.company || "").toLowerCase();
        const title = (a.title || "").toLowerCase();
        return name.includes(q) || email.includes(q) || company.includes(q) || title.includes(q);
      });
    }
    return filtered.sort((a, b) => {
      const sa = a.ai_score ? parseInt(a.ai_score) : 0;
      const sb = b.ai_score ? parseInt(b.ai_score) : 0;
      return sb - sa;
    });
  }, [applicants, searchQuery]);

  const filteredCount = searchQuery.trim() ? sorted.length : applicants.length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-2 cursor-pointer group mb-3">
          <Icon className={`size-6 ${iconColor}`} />
          <h3 className="text-xl font-semibold">{title}</h3>
          <Badge variant="secondary" className="ml-1 text-sm px-2.5">
            {searchQuery.trim() && filteredCount !== applicants.length
              ? `${filteredCount} / ${applicants.length}`
              : applicants.length}
          </Badge>
          <div className="flex-1" />
          {open ? (
            <ChevronUp className="size-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-5 text-muted-foreground" />
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 mb-6">
          {sorted.map((a, i) => (
            <ApplicantRow
              key={a.applicant_id}
              applicant={a}
              rank={i + 1}
              onStatusChange={onStatusChange}
            />
          ))}
          {sorted.length === 0 && (
            <p className="text-base text-muted-foreground py-6 text-center">
              No applicants in this category
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Swipeable Card Scanner ── */

function ApplicantCardScanner({
  applicants,
  onStatusChange,
  onClose,
}: {
  applicants: Applicant[];
  onStatusChange: (id: string, status: string) => void;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const sorted = useMemo(
    () =>
      [...applicants].sort((a, b) => {
        const sa = a.ai_score ? parseInt(a.ai_score) : 0;
        const sb = b.ai_score ? parseInt(b.ai_score) : 0;
        return sb - sa;
      }),
    [applicants]
  );

  const current = sorted[currentIndex];
  if (!current) return null;

  const score = current.ai_score ? parseInt(current.ai_score) : 0;
  const scoreColor =
    score >= 70
      ? "text-green-600 dark:text-green-400"
      : score >= 40
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";
  const scoreBg =
    score >= 70
      ? "bg-green-100 dark:bg-green-950 border-green-300 dark:border-green-700"
      : score >= 40
        ? "bg-yellow-100 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-700"
        : "bg-red-100 dark:bg-red-950 border-red-300 dark:border-red-700";

  const displayName =
    current.name ||
    current.email ||
    (current.title && current.company ? `${current.title} @ ${current.company}` : null) ||
    current.company ||
    "Unknown";

  const statusBadge = current.status === "accepted"
    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
    : current.status === "waitlisted"
      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      : current.status === "rejected"
        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
        : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";

  const goPrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const goNext = () => setCurrentIndex((i) => Math.min(sorted.length - 1, i + 1));

  const handleAction = (status: string) => {
    onStatusChange(current.applicant_id, status);
    if (currentIndex < sorted.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "1") handleAction("accepted");
      else if (e.key === "2") handleAction("waitlisted");
      else if (e.key === "3") handleAction("rejected");
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="size-5 text-primary" />
          <span className="text-lg font-semibold">Card Scanner</span>
          <Badge variant="secondary" className="text-sm">
            {currentIndex + 1} / {sorted.length}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-base">
          <X className="size-4 mr-1" />
          Close
        </Button>
      </div>

      <Card className="border-2">
        <CardContent className="pt-6 pb-4 space-y-4">
          {/* Header with name + score */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold">{displayName}</h3>
              {current.title && current.company && (
                <p className="text-lg text-muted-foreground mt-0.5">
                  {current.title} @ {current.company}
                </p>
              )}
            </div>
            {score > 0 && (
              <div className={`flex flex-col items-center rounded-lg border px-4 py-2 ${scoreBg}`}>
                <span className={`text-3xl font-bold tabular-nums ${scoreColor}`}>{score}</span>
                <span className="text-xs text-muted-foreground">score</span>
              </div>
            )}
          </div>

          {/* Current status */}
          <div>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusBadge}`}>
              {current.status.charAt(0).toUpperCase() + current.status.slice(1)}
            </span>
          </div>

          {/* Details */}
          <div className="grid gap-2 text-base">
            {current.email && (
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${current.email}`} className="hover:underline truncate">
                  {current.email}
                </a>
              </div>
            )}
            {current.linkedin_url && (
              <div className="flex items-center gap-2">
                <Linkedin className="size-4 text-muted-foreground shrink-0" />
                <a
                  href={current.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center gap-1 text-blue-600 dark:text-blue-400"
                >
                  LinkedIn Profile
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            )}
            {current.location && (
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground shrink-0" />
                <span>{current.location}</span>
              </div>
            )}
          </div>

          {/* AI Reasoning */}
          {current.ai_reasoning && (
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="size-4 text-primary mt-0.5 shrink-0" />
                <p className="text-base leading-relaxed">{current.ai_reasoning}</p>
              </div>
            </div>
          )}

          {/* Extra fields */}
          {Object.entries(current)
            .filter(([k]) => !["applicant_id", "name", "email", "status", "ai_score", "ai_reasoning", "ai_review", "company", "title", "location", "linkedin_url"].includes(k))
            .filter(([, v]) => v && String(v).trim())
            .length > 0 && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-sm text-muted-foreground gap-1 px-0">
                  Show all fields
                  <ChevronDown className="size-3.5" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="grid gap-1.5 text-sm">
                  {Object.entries(current)
                    .filter(([k]) => !["applicant_id", "name", "email", "status", "ai_score", "ai_reasoning", "ai_review", "company", "title", "location", "linkedin_url"].includes(k))
                    .filter(([, v]) => v && String(v).trim())
                    .map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-muted-foreground font-medium min-w-[120px]">{k.replace(/_/g, " ")}:</span>
                        <span className="break-words">{String(v)}</span>
                      </div>
                    ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="h-12 px-4 text-base"
        >
          <ChevronLeft className="size-5 mr-1" />
          Prev
        </Button>

        <div className="flex gap-2 flex-1 justify-center">
          <Button
            onClick={() => handleAction("accepted")}
            className="flex-1 h-12 text-base bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle2 className="size-5 mr-1.5" />
            Accept
          </Button>
          <Button
            onClick={() => handleAction("waitlisted")}
            className="flex-1 h-12 text-base bg-yellow-500 hover:bg-yellow-600 text-white"
          >
            <Clock className="size-5 mr-1.5" />
            Waitlist
          </Button>
          <Button
            onClick={() => handleAction("rejected")}
            className="flex-1 h-12 text-base bg-red-600 hover:bg-red-700 text-white"
          >
            <XCircle className="size-5 mr-1.5" />
            Reject
          </Button>
        </div>

        <Button
          variant="outline"
          onClick={goNext}
          disabled={currentIndex >= sorted.length - 1}
          className="h-12 px-4 text-base"
        >
          Next
          <ChevronRight className="size-5 ml-1" />
        </Button>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        Keyboard: Arrow keys to navigate, 1 = Accept, 2 = Waitlist, 3 = Reject, Esc = Close
      </p>
    </div>
  );
}

/* ── Console Log Panel ── */

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
      className="bg-zinc-950 text-green-400 font-mono text-sm rounded-lg border border-zinc-800 p-4 h-72 overflow-y-auto"
    >
      {logs.length === 0 && (
        <span className="text-zinc-600">Waiting for activity...</span>
      )}
      {logs.map((log, i) => (
        <div key={i} className="leading-relaxed" style={log.color ? { color: log.color } : undefined}>
          <span className="text-zinc-500">[{log.time}]</span> {log.message}
        </div>
      ))}
    </div>
  );
}

/* ── Main Page ── */

export default function Page() {
  const [step, setStep] = useState<Step>("setup");

  // Setup state
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("claude-sonnet-4-20250514");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Google Sheets state
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetConnected, setSheetConnected] = useState(false);
  const [sheetSyncing, setSheetSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<{ new_count: number; updated_count: number; total_in_sheet: number } | null>(null);
  const autoSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Configure state
  const [prompt, setPrompt] = useState(
    "You are evaluating Demo Day applicants for CS 224G (Building & Scaling LLM Applications) at Stanford, Winter 2026. This is a project-based course where student teams build production-ready AI applications over 10 weeks. Evaluate each applicant based on their background and potential to contribute as an attendee/judge at Demo Day on March 19, 2026."
  );
  const [criteria, setCriteria] = useState<string[]>([
    "Relevant AI/ML or LLM experience",
    "Industry or academic standing",
    "Potential to provide valuable feedback to student teams",
    "Alignment with course themes (agents, RAG, reasoning models)",
  ]);
  const [newCriterion, setNewCriterion] = useState("");

  // Analysis progress state
  const [analysisProgress, setAnalysisProgress] = useState<{
    completed: number;
    total: number;
    errors: number;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Console log state
  const [logs, setLogs] = useState<{ time: string; message: string; color?: string }[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // Data hooks
  const { stats, refresh: refreshStats } = useStats();
  const { applicants, loading: loadingApplicants, refresh: refreshApplicants } = useApplicants();

  // Load saved AI config + Google Sheet URL from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem("ai_api_key") || "";
    const savedProvider = localStorage.getItem("ai_provider") || "anthropic";
    const savedModel = localStorage.getItem("ai_model") || "claude-sonnet-4-20250514";
    const savedSheetUrl = localStorage.getItem("google_sheet_url") || "";
    setApiKey(savedKey);
    setProvider(savedProvider);
    setModel(savedModel);
    if (savedSheetUrl) {
      setSheetUrl(savedSheetUrl);
      setSheetConnected(true);
    }
  }, []);

  // Load saved prompt settings
  useEffect(() => {
    api
      .getPromptSettings()
      .then((s) => {
        if (s.default_prompt) setPrompt(s.default_prompt);
        if (s.criteria?.length) setCriteria(s.criteria);
      })
      .catch(() => {});
  }, []);

  // Persist AI config to localStorage
  useEffect(() => {
    if (apiKey) localStorage.setItem("ai_api_key", apiKey);
    localStorage.setItem("ai_provider", provider);
    localStorage.setItem("ai_model", model);
  }, [apiKey, provider, model]);

  // Auto-scroll console log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = useCallback((message: string) => {
    const now = new Date();
    const time = now.toLocaleTimeString("en-US", { hour12: false });
    setLogs((prev) => [...prev, { time, message }]);
  }, []);

  // Google Sheets sync
  const syncGoogleSheet = useCallback(async (url?: string) => {
    const targetUrl = url || sheetUrl;
    if (!targetUrl.trim()) return;
    console.log("[GoogleSheets] Syncing from:", targetUrl);
    setSheetSyncing(true);
    try {
      const result = await api.importGoogleSheet({ sheet_url: targetUrl });
      const now = new Date().toLocaleTimeString("en-US", { hour12: false });
      setLastSyncTime(now);
      setLastSyncResult({ new_count: result.new_count, updated_count: result.updated_count, total_in_sheet: result.total_in_sheet });
      setSheetConnected(true);
      localStorage.setItem("google_sheet_url", targetUrl);
      refreshStats();
      refreshApplicants();
      if (result.new_count > 0) {
        toast.success(`Synced: ${result.new_count} new, ${result.updated_count} updated`);
      } else if (result.updated_count > 0) {
        toast.info(`Synced: ${result.updated_count} updated (no new applicants)`);
      } else {
        toast.info("Sheet synced — no changes detected");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to sync Google Sheet");
      setSheetConnected(false);
    } finally {
      setSheetSyncing(false);
    }
  }, [sheetUrl, refreshStats, refreshApplicants]);

  // Auto-sync interval
  useEffect(() => {
    if (autoSync && sheetConnected && sheetUrl) {
      autoSyncRef.current = setInterval(() => {
        console.log("[GoogleSheets] Auto-sync triggered");
        syncGoogleSheet();
      }, 30000); // 30 seconds
    }
    return () => {
      if (autoSyncRef.current) {
        clearInterval(autoSyncRef.current);
        autoSyncRef.current = null;
      }
    };
  }, [autoSync, sheetConnected, sheetUrl, syncGoogleSheet]);

  // Models for current provider
  const models = provider === "anthropic" ? ANTHROPIC_MODELS : OPENAI_MODELS;

  const handleProviderChange = (p: string) => {
    setProvider(p);
    setModel(p === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o");
  };

  const canProceedToConfig = apiKey.trim().length > 0 && (stats?.total ?? 0) > 0;

  const handleUploadSuccess = () => {
    refreshStats();
  };

  // Criteria helpers
  const addCriterion = () => {
    const value = newCriterion.trim();
    if (value && !criteria.includes(value)) {
      setCriteria([...criteria, value]);
      setNewCriterion("");
    }
  };

  const removeCriterion = (c: string) => {
    setCriteria(criteria.filter((x) => x !== c));
  };

  // Analyze
  const handleAnalyze = async () => {
    setStep("analyze");
    setLogs([]);
    setAnalysisProgress(null);
    setAnalyzing(true);

    const modelLabel = models.find((m) => m.value === model)?.label || model;

    const log = (msg: string, color?: string) => {
      const now = new Date();
      const time = now.toLocaleTimeString("en-US", { hour12: false });
      setLogs((prev) => [...prev, { time, message: msg, color }]);
    };

    log(`Starting per-applicant analysis...`);
    log(`Provider: ${provider === "anthropic" ? "Anthropic" : "OpenAI"} | Model: ${modelLabel}`);
    log(`Prompt: "${prompt.substring(0, 80)}${prompt.length > 80 ? "..." : ""}"`);
    log(`Criteria: ${criteria.join(", ")}`);

    let acceptedCount = 0;
    let waitlistedCount = 0;
    let rejectedCount = 0;

    try {
      await api.updatePromptSettings({ default_prompt: prompt, criteria });
      log("Saved prompt settings.");
      log("Streaming analysis — each applicant analyzed individually...");

      await api.analyzeAllStream(
        { api_key: apiKey, model, provider, prompt, criteria },
        {
          onStart: (data) => {
            setAnalysisProgress({ completed: 0, total: data.total, errors: 0 });
            log(`Analyzing ${data.total} applicants (concurrency: 10)...`);
          },
          onProgress: (data) => {
            setAnalysisProgress({ completed: data.completed, total: data.total, errors: data.errors });
            const statusLabel = data.status.toUpperCase();
            log(`[${data.completed}/${data.total}] ${data.name} — Score: ${data.score} — ${statusLabel}`);
            if (data.status === "accepted") acceptedCount++;
            else if (data.status === "waitlisted") waitlistedCount++;
            else if (data.status === "rejected") rejectedCount++;
          },
          onError: (data) => {
            setAnalysisProgress({ completed: data.completed, total: data.total, errors: data.errors });
            log(`[${data.completed}/${data.total}] ${data.name} — ERROR: ${data.error}`, "red");
          },
          onComplete: (data) => {
            setAnalysisProgress({ completed: data.completed, total: data.total, errors: data.errors });
            log(`Analysis complete: ${acceptedCount} accepted, ${waitlistedCount} waitlisted, ${rejectedCount} rejected` +
              (data.errors > 0 ? ` (${data.errors} errors)` : ""));
          },
        }
      );

      toast.success(
        `Analysis complete: ${acceptedCount} accepted, ${waitlistedCount} waitlisted, ${rejectedCount} rejected`
      );

      await refreshApplicants();
      setAnalyzing(false);
      await new Promise((r) => setTimeout(r, 1000));
      setStep("results");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      log(`ERROR: ${msg}`, "red");
      toast.error(msg);
      setAnalyzing(false);
    }
  };

  const handleStartOver = () => {
    setStep("setup");
    setLogs([]);
  };

  // Results data
  const accepted = useMemo(() => applicants.filter((a) => a.status === "accepted"), [applicants]);
  const waitlisted = useMemo(
    () => applicants.filter((a) => a.status === "waitlisted"),
    [applicants]
  );
  const rejected = useMemo(() => applicants.filter((a) => a.status === "rejected"), [applicants]);
  const pending = useMemo(() => applicants.filter((a) => a.status === "pending"), [applicants]);

  // Search / filter / card scanner state
  const [searchQuery, setSearchQuery] = useState("");
  const [showCardScanner, setShowCardScanner] = useState(false);

  const handleExportCSV = useCallback(() => {
    if (applicants.length === 0) return;

    // Collect all unique keys across applicants (excluding internal IDs)
    const skipKeys = new Set(["applicant_id"]);
    const allKeys = new Set<string>();
    for (const a of applicants) {
      for (const key of Object.keys(a)) {
        if (!skipKeys.has(key)) allKeys.add(key);
      }
    }
    // Put important columns first
    const priorityOrder = ["name", "email", "status", "ai_score", "ai_reasoning", "company", "title", "location", "linkedin_url"];
    const headers = [
      ...priorityOrder.filter((k) => allKeys.has(k)),
      ...[...allKeys].filter((k) => !priorityOrder.includes(k)).sort(),
    ];

    const escapeCSV = (val: unknown) => {
      const s = String(val ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = [headers.join(",")];
    // Sort by score descending
    const sorted = [...applicants].sort((a, b) => {
      const sa = a.ai_score ? parseInt(a.ai_score as string) : 0;
      const sb = b.ai_score ? parseInt(b.ai_score as string) : 0;
      return sb - sa;
    });
    for (const a of sorted) {
      rows.push(headers.map((h) => escapeCSV(a[h])).join(","));
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `demo-day-results-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported!");
  }, [applicants]);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.updateApplicant(id, { status });
      toast.success(`Moved to ${status}`);
      refreshApplicants();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  };

  /* ── Step indicator ── */

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Step indicator */}
      <nav className="flex items-center justify-center gap-2 sm:gap-3">
        {STEPS.map((s, i) => {
          const isActive = s.key === step;
          const isComplete = i < stepIndex;

          return (
            <div key={s.key} className="flex items-center gap-2 sm:gap-3">
              {i > 0 && (
                <div
                  className={`w-8 sm:w-12 h-0.5 ${isComplete || isActive ? "bg-primary" : "bg-border"}`}
                />
              )}
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isComplete
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <s.icon className="size-4" />
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            </div>
          );
        })}
      </nav>

      {/* ── Step 1: Setup ── */}
      {step === "setup" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Get Started</h2>
            <p className="text-lg text-muted-foreground mt-1">
              Upload applicants via CSV or connect a live Google Sheet.
            </p>
          </div>

          {/* CSV Upload — first, most important */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="size-5" />
                Upload Applicants
              </CardTitle>
              <CardDescription className="text-base">
                {(stats?.total ?? 0) > 0
                  ? `${stats!.total} applicants loaded and ready to review`
                  : "Upload a CSV file with your Demo Day applicants"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CSVUploader onUploadSuccess={handleUploadSuccess} />
            </CardContent>
          </Card>

          {/* Google Sheets Monitor */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sheet className="size-5" />
                Live Google Sheet
                {sheetConnected && (
                  <Badge variant="secondary" className="ml-auto text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    Connected
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-base">
                {sheetConnected
                  ? "Monitoring your Google Sheet for new applicants"
                  : "Connect a public Google Sheet to auto-import applicants"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="h-11 text-base"
                  disabled={sheetSyncing}
                />
                {!sheetConnected ? (
                  <Button
                    onClick={() => {
                      console.log("[GoogleSheets] Connect clicked");
                      syncGoogleSheet();
                    }}
                    disabled={!sheetUrl.trim() || sheetSyncing}
                    className="h-11 px-5"
                  >
                    {sheetSyncing ? (
                      <Loader2 className="size-4 animate-spin mr-2" />
                    ) : (
                      <Link className="size-4 mr-2" />
                    )}
                    {sheetSyncing ? "Connecting..." : "Connect"}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        console.log("[GoogleSheets] Manual sync clicked");
                        syncGoogleSheet();
                      }}
                      disabled={sheetSyncing}
                      className="h-11 px-4"
                    >
                      {sheetSyncing ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        console.log("[GoogleSheets] Disconnect clicked");
                        setSheetConnected(false);
                        setAutoSync(false);
                        setLastSyncTime(null);
                        setLastSyncResult(null);
                        localStorage.removeItem("google_sheet_url");
                        toast.info("Google Sheet disconnected");
                      }}
                      className="h-11 px-4 text-muted-foreground"
                    >
                      <Unplug className="size-4" />
                    </Button>
                  </div>
                )}
              </div>

              {sheetConnected && (
                <div className="space-y-3">
                  {/* Auto-sync toggle */}
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label className="text-base font-medium">Auto-sync</Label>
                      <p className="text-sm text-muted-foreground">
                        Pull new applicants every 30 seconds
                      </p>
                    </div>
                    <Switch
                      checked={autoSync}
                      onCheckedChange={(checked) => {
                        console.log("[GoogleSheets] Auto-sync toggled:", checked);
                        setAutoSync(checked);
                        if (checked) toast.info("Auto-sync enabled (every 30s)");
                      }}
                    />
                  </div>

                  {/* Sync status */}
                  {lastSyncTime && lastSyncResult && (
                    <div className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2.5">
                      <RefreshCw className="size-3.5 shrink-0" />
                      <span>
                        Last sync at {lastSyncTime}: {lastSyncResult.total_in_sheet} rows in sheet
                        {lastSyncResult.new_count > 0 && (
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            {" "}(+{lastSyncResult.new_count} new)
                          </span>
                        )}
                        {autoSync && (
                          <span className="ml-1">
                            &middot; next sync in 30s
                          </span>
                        )}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Sheet must be set to &quot;Anyone with the link can view&quot;. Deduplicates by email address.
              </p>
            </CardContent>
          </Card>

          {/* AI Config */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Key className="size-5" />
                AI API Key
              </CardTitle>
              <CardDescription className="text-base">
                Paste your API key so the AI can review applicants
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    id="api-key"
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste your API key here..."
                    className="pr-10 h-12 text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>

              {/* Advanced model settings — collapsed by default */}
              <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-sm text-muted-foreground gap-1.5 px-0">
                    <Settings2 className="size-4" />
                    {showAdvanced ? "Hide" : "Show"} model settings
                    {showAdvanced ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-base">Provider</Label>
                      <Select value={provider} onValueChange={handleProviderChange}>
                        <SelectTrigger className="h-11">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="anthropic">Anthropic</SelectItem>
                          <SelectItem value="openai">OpenAI</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base">Model</Label>
                      <Select value={model} onValueChange={setModel}>
                        <SelectTrigger className="h-11">
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
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>

          {/* Next button */}
          <Button
            onClick={() => setStep("configure")}
            disabled={!canProceedToConfig}
            size="lg"
            className="w-full h-14 text-lg"
          >
            {!apiKey.trim()
              ? "Enter your API key to continue"
              : (stats?.total ?? 0) === 0
                ? "Upload applicants to continue"
                : `Next: Set Review Criteria`}
          </Button>
        </div>
      )}

      {/* ── Step 2: Configure ── */}
      {step === "configure" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Review Criteria</h2>
            <p className="text-lg text-muted-foreground mt-1">
              Tell the AI what to look for when reviewing {stats?.total || 0} applicants.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Instructions for the AI</CardTitle>
              <CardDescription className="text-base">
                Describe what makes a good Demo Day attendee
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                placeholder="Describe your event and ideal attendees..."
                className="resize-none text-base"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Evaluation Criteria</CardTitle>
              <CardDescription className="text-base">
                What should the AI prioritize? (listed in order of importance)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newCriterion}
                  onChange={(e) => setNewCriterion(e.target.value)}
                  placeholder="Add a new criterion..."
                  className="h-11 text-base"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCriterion();
                    }
                  }}
                />
                <Button variant="outline" size="icon" onClick={addCriterion} className="h-11 w-11">
                  <Plus className="size-5" />
                </Button>
              </div>

              {criteria.length > 0 && (
                <div className="space-y-2">
                  {criteria.map((c, i) => (
                    <div
                      key={c}
                      className="flex items-center gap-2 rounded-md border px-3 py-3 text-base"
                    >
                      <GripVertical className="size-4 text-muted-foreground" />
                      <span className="text-muted-foreground font-mono text-sm w-6">
                        {i + 1}.
                      </span>
                      <span className="flex-1">{c}</span>
                      <button
                        onClick={() => removeCriterion(c)}
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <X className="size-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("setup")} size="lg" className="h-14 text-base px-6">
              Back
            </Button>
            <Button
              onClick={handleAnalyze}
              disabled={!stats?.total}
              size="lg"
              className="flex-1 h-14 text-lg"
            >
              <Brain className="size-5 mr-2" />
              Analyze {stats?.total || 0} Applicants
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: Analyze ── */}
      {step === "analyze" && (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            {analyzing ? (
              <Loader2 className="size-6 animate-spin text-primary" />
            ) : (
              <CheckCircle2 className="size-6 text-green-500" />
            )}
            <div>
              <h2 className="text-3xl font-bold tracking-tight">
                {analyzing ? "Reviewing Applicants..." : "Review Complete"}
              </h2>
              <p className="text-lg text-muted-foreground">
                {analyzing
                  ? "The AI is reviewing each applicant individually. This may take a minute."
                  : "All applicants have been reviewed."}
              </p>
            </div>
          </div>

          {analysisProgress && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-base">
                <span className="text-muted-foreground font-medium">
                  {analysisProgress.completed} of {analysisProgress.total} applicants reviewed
                </span>
                <span className="font-mono font-medium">
                  {Math.round((analysisProgress.completed / analysisProgress.total) * 100)}%
                  {analysisProgress.errors > 0 && (
                    <span className="text-red-500 ml-2">
                      ({analysisProgress.errors} {analysisProgress.errors === 1 ? "error" : "errors"})
                    </span>
                  )}
                </span>
              </div>
              <Progress value={(analysisProgress.completed / analysisProgress.total) * 100} className="h-3" />
            </div>
          )}

          <ConsoleLog logs={logs} logRef={logRef} />
        </div>
      )}

      {/* ── Step 4: Results ── */}
      {step === "results" && (
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-bold tracking-tight">Results</h2>
              <p className="text-lg text-muted-foreground mt-1">
                Click any applicant to see details. Use &quot;Move&quot; to reclassify.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <Button
                variant={showCardScanner ? "default" : "outline"}
                onClick={() => setShowCardScanner(!showCardScanner)}
                className="h-11 text-base"
              >
                <Layers className="size-4 mr-2" />
                {showCardScanner ? "Show List" : "Card Scanner"}
              </Button>
              <Button variant="outline" onClick={handleExportCSV} className="h-11 text-base">
                <Download className="size-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" onClick={handleStartOver} className="h-11 text-base">
                <RotateCcw className="size-4 mr-2" />
                Start Over
              </Button>
            </div>
          </div>

          {/* Console log (collapsed summary) */}
          {logs.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-sm text-muted-foreground gap-1.5">
                  <Terminal className="size-4" />
                  View AI log ({logs.length} entries)
                  <ChevronDown className="size-4" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <ConsoleLog logs={logs} logRef={logRef} />
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Summary stats */}
          <Card className="bg-muted/30">
            <CardContent className="py-5">
              <div className="flex items-center justify-around text-center">
                <div>
                  <div className="text-4xl font-bold text-green-600 dark:text-green-400">
                    {accepted.length}
                  </div>
                  <div className="text-base text-muted-foreground mt-1">Accepted</div>
                </div>
                <Separator orientation="vertical" className="h-14" />
                <div>
                  <div className="text-4xl font-bold text-yellow-600 dark:text-yellow-400">
                    {waitlisted.length}
                  </div>
                  <div className="text-base text-muted-foreground mt-1">Waitlisted</div>
                </div>
                <Separator orientation="vertical" className="h-14" />
                <div>
                  <div className="text-4xl font-bold text-red-600 dark:text-red-400">
                    {rejected.length}
                  </div>
                  <div className="text-base text-muted-foreground mt-1">Rejected</div>
                </div>
                {pending.length > 0 && (
                  <>
                    <Separator orientation="vertical" className="h-14" />
                    <div>
                      <div className="text-4xl font-bold text-muted-foreground">
                        {pending.length}
                      </div>
                      <div className="text-base text-muted-foreground mt-1">Pending</div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Card Scanner Mode */}
          {showCardScanner ? (
            <ApplicantCardScanner
              applicants={applicants}
              onStatusChange={handleStatusChange}
              onClose={() => setShowCardScanner(false)}
            />
          ) : (
            <>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, company, or title..."
                  className="pl-10 h-12 text-base"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-5" />
                  </button>
                )}
              </div>

              {/* Categorized results */}
              <ResultSection
                title="Accepted"
                icon={CheckCircle2}
                iconColor="text-green-500"
                applicants={accepted}
                onStatusChange={handleStatusChange}
                searchQuery={searchQuery}
              />
              <ResultSection
                title="Waitlisted"
                icon={Clock}
                iconColor="text-yellow-500"
                applicants={waitlisted}
                onStatusChange={handleStatusChange}
                searchQuery={searchQuery}
              />
              <ResultSection
                title="Rejected"
                icon={XCircle}
                iconColor="text-red-500"
                applicants={rejected}
                onStatusChange={handleStatusChange}
                defaultOpen={false}
                searchQuery={searchQuery}
              />
              {pending.length > 0 && (
                <ResultSection
                  title="Not Yet Reviewed"
                  icon={Users}
                  iconColor="text-muted-foreground"
                  applicants={pending}
                  onStatusChange={handleStatusChange}
                  defaultOpen={false}
                  searchQuery={searchQuery}
                />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
