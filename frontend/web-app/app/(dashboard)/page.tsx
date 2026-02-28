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
import { api, type Applicant } from "@/lib/api";
import { useApplicants, useStats } from "@/hooks/use-applicants";
import { CSVUploader } from "@/components/csv-uploader";

type Step = "setup" | "configure" | "analyze" | "results";

const STEPS: { key: Step; label: string; icon: React.ElementType }[] = [
  { key: "setup", label: "Setup", icon: Key },
  { key: "configure", label: "Configure", icon: Brain },
  { key: "analyze", label: "Analyze", icon: Terminal },
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

  return (
    <div className="border rounded-lg">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-sm font-mono text-muted-foreground w-6 text-right shrink-0">
          {rank}.
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{applicant.name || "Unknown"}</span>
            {applicant.title && applicant.company && (
              <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                {applicant.title} @ {applicant.company}
              </span>
            )}
          </div>
        </div>
        {score > 0 && (
          <span className={`text-sm font-bold tabular-nums ${scoreColor}`}>{score}</span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              <ArrowRightLeft className="size-3 mr-1" />
              Move
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onStatusChange(applicant.applicant_id, "accepted")}>
              <CheckCircle2 className="size-4 mr-2 text-green-500" />
              Should Attend
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange(applicant.applicant_id, "waitlisted")}>
              <Clock className="size-4 mr-2 text-yellow-500" />
              Move to Waitlist
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange(applicant.applicant_id, "rejected")}>
              <XCircle className="size-4 mr-2 text-red-500" />
              Reject
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {expanded ? (
          <ChevronUp className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t bg-muted/30">
          <div className="grid gap-2 text-sm ml-9">
            {applicant.email && (
              <div className="flex items-center gap-2">
                <Mail className="size-3.5 text-muted-foreground" />
                <a href={`mailto:${applicant.email}`} className="hover:underline">
                  {applicant.email}
                </a>
              </div>
            )}
            {applicant.linkedin_url && (
              <div className="flex items-center gap-2">
                <Linkedin className="size-3.5 text-muted-foreground" />
                <a
                  href={applicant.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center gap-1 text-blue-600 dark:text-blue-400"
                >
                  LinkedIn Profile
                  <ExternalLink className="size-3" />
                </a>
              </div>
            )}
            {applicant.company && (
              <div className="flex items-center gap-2">
                <Building2 className="size-3.5 text-muted-foreground" />
                <span>
                  {applicant.title ? `${applicant.title} @ ${applicant.company}` : applicant.company}
                </span>
              </div>
            )}
            {applicant.location && (
              <div className="flex items-center gap-2">
                <MapPin className="size-3.5 text-muted-foreground" />
                <span>{applicant.location}</span>
              </div>
            )}
            {applicant.ai_reasoning && (
              <div className="flex items-start gap-2 mt-1">
                <Sparkles className="size-3.5 text-muted-foreground mt-0.5" />
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
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  applicants: Applicant[];
  onStatusChange: (id: string, status: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const sorted = useMemo(
    () =>
      [...applicants].sort((a, b) => {
        const sa = a.ai_score ? parseInt(a.ai_score) : 0;
        const sb = b.ai_score ? parseInt(b.ai_score) : 0;
        return sb - sa;
      }),
    [applicants]
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-2 cursor-pointer group mb-3">
          <Icon className={`size-5 ${iconColor}`} />
          <h3 className="text-lg font-semibold">{title}</h3>
          <Badge variant="secondary" className="ml-1">
            {applicants.length}
          </Badge>
          <div className="flex-1" />
          {open ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
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
            <p className="text-sm text-muted-foreground py-4 text-center">
              No applicants in this category
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Console Log Panel ── */

function ConsoleLog({
  logs,
  logRef,
}: {
  logs: { time: string; message: string }[];
  logRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={logRef}
      className="bg-zinc-950 text-green-400 font-mono text-xs rounded-lg border border-zinc-800 p-4 h-72 overflow-y-auto"
    >
      {logs.length === 0 && (
        <span className="text-zinc-600">Waiting for activity...</span>
      )}
      {logs.map((log, i) => (
        <div key={i} className="leading-relaxed">
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

  // Configure state
  const [prompt, setPrompt] = useState(
    "You are evaluating applicants for an exclusive tech networking event. Select candidates who would contribute most to meaningful conversations and connections."
  );
  const [criteria, setCriteria] = useState<string[]>([
    "Professional relevance",
    "Industry experience",
    "Networking potential",
  ]);
  const [newCriterion, setNewCriterion] = useState("");

  // Console log state
  const [logs, setLogs] = useState<{ time: string; message: string }[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // Data hooks
  const { stats, refresh: refreshStats } = useStats();
  const { applicants, loading: loadingApplicants, refresh: refreshApplicants } = useApplicants();

  // Load saved AI config from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem("ai_api_key") || "";
    const savedProvider = localStorage.getItem("ai_provider") || "anthropic";
    const savedModel = localStorage.getItem("ai_model") || "claude-sonnet-4-20250514";
    setApiKey(savedKey);
    setProvider(savedProvider);
    setModel(savedModel);
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

    const modelLabel = models.find((m) => m.value === model)?.label || model;

    // Stagger logs slightly for visual effect
    const log = (msg: string) => {
      const now = new Date();
      const time = now.toLocaleTimeString("en-US", { hour12: false });
      setLogs((prev) => [...prev, { time, message: msg }]);
    };

    log(`Starting analysis of ${stats?.total || 0} applicants...`);
    log(`Provider: ${provider === "anthropic" ? "Anthropic" : "OpenAI"} | Model: ${modelLabel}`);
    log(`Sending ${stats?.total || 0} applicants to ${modelLabel}...`);

    await new Promise((r) => setTimeout(r, 300));

    log(`Prompt: "${prompt.substring(0, 80)}${prompt.length > 80 ? "..." : ""}"`);
    log(`Criteria: ${criteria.join(", ")}`);

    try {
      await api.updatePromptSettings({ default_prompt: prompt, criteria });
      log("Saved prompt settings.");
      log("Waiting for AI response...");

      const result = await api.analyzeAll({
        api_key: apiKey,
        model,
        provider,
        prompt,
        criteria,
      });

      const accepted = result.candidates.filter((c) => c.status === "accepted").length;
      const waitlisted = result.candidates.filter((c) => c.status === "waitlisted").length;
      const rejected = result.candidates.filter((c) => c.status === "rejected").length;
      const approxTokens = Math.round(JSON.stringify(result).length / 4);

      log(`Response received (~${approxTokens.toLocaleString()} tokens)`);
      log("Parsing AI response...");
      log(`Results: ${accepted} accepted, ${waitlisted} waitlisted, ${rejected} rejected`);
      log("Analysis complete!");

      toast.success(
        `Analysis complete: ${accepted} accepted, ${waitlisted} waitlisted, ${rejected} rejected`
      );

      await refreshApplicants();
      await new Promise((r) => setTimeout(r, 1000));
      setStep("results");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      log(`ERROR: ${msg}`);
      toast.error(msg);
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
      <nav className="flex items-center justify-center gap-1 sm:gap-2">
        {STEPS.map((s, i) => {
          const isActive = s.key === step;
          const isComplete = i < stepIndex;

          return (
            <div key={s.key} className="flex items-center gap-1 sm:gap-2">
              {i > 0 && (
                <div
                  className={`w-6 sm:w-10 h-px ${isComplete || isActive ? "bg-primary" : "bg-border"}`}
                />
              )}
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isComplete
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isComplete ? (
                  <CheckCircle2 className="size-3.5" />
                ) : (
                  <s.icon className="size-3.5" />
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
            <h2 className="text-2xl font-bold tracking-tight">Setup</h2>
            <p className="text-muted-foreground">
              Enter your AI API key and upload applicants to get started.
            </p>
          </div>

          {/* AI Config */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="size-4" />
                AI Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="api-key">API Key</Label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Provider</Label>
                  <Select value={provider} onValueChange={handleProviderChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger>
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
            </CardContent>
          </Card>

          {/* CSV Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Upload Applicants</CardTitle>
              <CardDescription>
                {(stats?.total ?? 0) > 0
                  ? `${stats!.total} applicants already loaded`
                  : "Upload a CSV file with your applicant data"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CSVUploader onUploadSuccess={handleUploadSuccess} />
            </CardContent>
          </Card>

          {/* Next button */}
          <Button
            onClick={() => setStep("configure")}
            disabled={!canProceedToConfig}
            size="lg"
            className="w-full"
          >
            {!apiKey.trim()
              ? "Enter API key to continue"
              : (stats?.total ?? 0) === 0
                ? "Upload applicants to continue"
                : `Next: Configure Analysis`}
          </Button>
        </div>
      )}

      {/* ── Step 2: Configure ── */}
      {step === "configure" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Configure</h2>
            <p className="text-muted-foreground">
              Define your criteria, then let AI rank all {stats?.total || 0} applicants.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evaluation Prompt</CardTitle>
              <CardDescription>
                Describe your event and what kind of applicants you&apos;re looking for
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="Describe your event and ideal attendees..."
                className="resize-none"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evaluation Criteria</CardTitle>
              <CardDescription>
                Add criteria the AI should use to evaluate applicants (in order of importance)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  value={newCriterion}
                  onChange={(e) => setNewCriterion(e.target.value)}
                  placeholder="e.g., Technical expertise, Leadership experience..."
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCriterion();
                    }
                  }}
                />
                <Button variant="outline" size="icon" onClick={addCriterion}>
                  <Plus className="size-4" />
                </Button>
              </div>

              {criteria.length > 0 && (
                <div className="space-y-2">
                  {criteria.map((c, i) => (
                    <div
                      key={c}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <GripVertical className="size-4 text-muted-foreground" />
                      <span className="text-muted-foreground font-mono text-xs w-5">
                        {i + 1}.
                      </span>
                      <span className="flex-1">{c}</span>
                      <button
                        onClick={() => removeCriterion(c)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep("setup")}>
              Back
            </Button>
            <Button
              onClick={handleAnalyze}
              disabled={!stats?.total}
              size="lg"
              className="flex-1"
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
            <Loader2 className="size-5 animate-spin text-primary" />
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Analyzing</h2>
              <p className="text-muted-foreground">
                AI is reviewing all applicants against your criteria...
              </p>
            </div>
          </div>

          <ConsoleLog logs={logs} logRef={logRef} />
        </div>
      )}

      {/* ── Step 4: Results ── */}
      {step === "results" && (
        <div className="space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Results</h2>
              <p className="text-muted-foreground">
                Use the &quot;Move&quot; button to reclassify anyone.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={handleStartOver}>
              <RotateCcw className="size-4 mr-2" />
              Start Over
            </Button>
          </div>

          {/* Console log (collapsed summary) */}
          {logs.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1.5">
                  <Terminal className="size-3.5" />
                  View AI console log ({logs.length} entries)
                  <ChevronDown className="size-3.5" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <ConsoleLog logs={logs} logRef={logRef} />
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Summary stats */}
          <Card className="bg-muted/30">
            <CardContent className="py-3">
              <div className="flex items-center justify-around text-center text-sm">
                <div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {accepted.length}
                  </div>
                  <div className="text-muted-foreground">Should Attend</div>
                </div>
                <Separator orientation="vertical" className="h-10" />
                <div>
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {waitlisted.length}
                  </div>
                  <div className="text-muted-foreground">Waitlisted</div>
                </div>
                <Separator orientation="vertical" className="h-10" />
                <div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {rejected.length}
                  </div>
                  <div className="text-muted-foreground">Rejected</div>
                </div>
                {pending.length > 0 && (
                  <>
                    <Separator orientation="vertical" className="h-10" />
                    <div>
                      <div className="text-2xl font-bold text-muted-foreground">
                        {pending.length}
                      </div>
                      <div className="text-muted-foreground">Pending</div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Categorized results */}
          <ResultSection
            title="Should Attend"
            icon={CheckCircle2}
            iconColor="text-green-500"
            applicants={accepted}
            onStatusChange={handleStatusChange}
          />
          <ResultSection
            title="Waitlist"
            icon={Clock}
            iconColor="text-yellow-500"
            applicants={waitlisted}
            onStatusChange={handleStatusChange}
          />
          <ResultSection
            title="Rejected"
            icon={XCircle}
            iconColor="text-red-500"
            applicants={rejected}
            onStatusChange={handleStatusChange}
            defaultOpen={false}
          />
          {pending.length > 0 && (
            <ResultSection
              title="Pending (Not Yet Analyzed)"
              icon={Users}
              iconColor="text-muted-foreground"
              applicants={pending}
              onStatusChange={handleStatusChange}
              defaultOpen={false}
            />
          )}
        </div>
      )}
    </div>
  );
}
