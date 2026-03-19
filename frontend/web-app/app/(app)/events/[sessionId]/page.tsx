"use client";

import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Upload,
  Download,
  Brain,
  Search,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  ClipboardCopy,
  Check,
  Sparkles,
  Linkedin,
  ExternalLink,
  ArrowUpDown,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Building2,
  MapPin,
  GraduationCap,
  Briefcase,
  Mail,
  LayoutGrid,
  TableIcon,
  ShieldBan,
  AlertTriangle,
  GripVertical,
  Info,
  ChevronDown,
  ChevronUp,
  Scale,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEvent } from "@/components/event-provider";
import { CSVUploader } from "@/components/csv-uploader";
import { api } from "@/lib/api";
import type { Applicant } from "@/lib/api";
import { ATTENDEE_TYPES } from "@/lib/constants";
import { JUDGE_PERSONAS } from "@/lib/judge-personas";

function getName(a: Applicant): string {
  return a.name || (a.linkedin_name as string) || a.email || "No name";
}

function getHeadline(a: Applicant): string {
  return (a.linkedin_headline as string) || a.title || "";
}

function getPhoto(a: Applicant): string {
  return (a.linkedin_image as string) || (a.photo_url as string) || "";
}

function getRank(a: Applicant): { rank: number; total: number; score: number; catRank: number; catTotal: number } | null {
  const rank = Number(a.global_rank || a.rank || 0);
  const total = Number(a.global_rank_total || a.rank_total || 0);
  const catRank = Number(a.rank || 0);
  const catTotal = Number(a.rank_total || 0);
  const score = Number(a.rank_score || 0);
  if (!rank && !score) return null;
  return { rank, total, score, catRank, catTotal };
}

function getSummary(a: Applicant): string {
  const s = a.ai_summary || a.linkedin_summary || "";
  if (Array.isArray(s)) return (s as string[]).join("\n");
  return typeof s === "string" ? s : String(s);
}

function getTypeColor(key: string): string {
  return ATTENDEE_TYPES.find((t) => t.key === key)?.color || "#6b7280";
}

function getTypeLabel(key: string): string {
  return ATTENDEE_TYPES.find((t) => t.key === key)?.label || key;
}

/* ── Sortable Table Row ── */
function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}
      className={`cursor-pointer hover:bg-muted/50 ${isDragging ? "bg-muted/80 shadow-lg z-50" : ""}`}
      {...attributes}
    >
      <TableCell className="text-center w-10" {...listeners}>
        <GripVertical className="size-3.5 text-muted-foreground/40 cursor-grab active:cursor-grabbing mx-auto" />
      </TableCell>
      {children}
    </TableRow>
  );
}

/* ── Mix Panel ── */
function MixPanel({ applicants, onApply }: {
  applicants: Applicant[];
  onApply: (acceptIds: string[], waitlistIds: string[]) => Promise<void>;
}) {
  const [quotas, setQuotas] = useState<Record<string, number>>({});
  const [applying, setApplying] = useState(false);
  const [target, setTarget] = useState(200);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const byType = useMemo(() => {
    const groups: Record<string, Applicant[]> = {};
    for (const t of ATTENDEE_TYPES) groups[t.key] = [];
    for (const a of applicants) {
      const t = a.attendee_type || "other";
      if (!groups[t]) groups[t] = [];
      groups[t].push(a);
    }
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        const ra = Number(a.global_rank || a.rank || 999);
        const rb = Number(b.global_rank || b.rank || 999);
        if (ra !== rb) return ra - rb;
        return getName(a).localeCompare(getName(b));
      });
    }
    return groups;
  }, [applicants]);

  const getQuota = (key: string) => quotas[key] ?? (byType[key] || []).filter((a) => (a.status || "pending") === "accepted").length;
  const totalSelected = ATTENDEE_TYPES.reduce((sum, t) => sum + Math.min(getQuota(t.key), (byType[t.key] || []).length), 0);
  const remaining = target - totalSelected;

  // Auto-distribute: proportionally fill to target
  const autoFill = () => {
    const totalAvailable = ATTENDEE_TYPES.reduce((s, t) => s + (byType[t.key] || []).length, 0);
    if (totalAvailable === 0) return;
    const newQuotas: Record<string, number> = {};
    let assigned = 0;
    const types = ATTENDEE_TYPES.filter((t) => (byType[t.key] || []).length > 0);
    for (const t of types) {
      const available = (byType[t.key] || []).length;
      const share = Math.round((available / totalAvailable) * target);
      newQuotas[t.key] = Math.min(share, available);
      assigned += newQuotas[t.key];
    }
    // Distribute remainder to largest groups
    let diff = target - assigned;
    const sorted = [...types].sort((a, b) => (byType[b.key] || []).length - (byType[a.key] || []).length);
    for (const t of sorted) {
      if (diff <= 0) break;
      const available = (byType[t.key] || []).length;
      const can = available - newQuotas[t.key];
      if (can > 0) { const add = Math.min(can, diff); newQuotas[t.key] += add; diff -= add; }
    }
    setQuotas(newQuotas);
  };

  // Accept top N from each group
  const acceptTopN = () => {
    const newQuotas: Record<string, number> = {};
    // Take all from each category, limited by their count, up to target
    let budget = target;
    // Priority: VCs first, then founders, etc.
    for (const t of ATTENDEE_TYPES) {
      const available = (byType[t.key] || []).length;
      const take = Math.min(available, budget);
      newQuotas[t.key] = take;
      budget -= take;
    }
    setQuotas(newQuotas);
  };

  const handleApply = async () => {
    setApplying(true);
    const acceptIds: string[] = [];
    const waitlistIds: string[] = [];
    for (const t of ATTENDEE_TYPES) {
      const items = byType[t.key] || [];
      const q = getQuota(t.key);
      items.forEach((a, i) => {
        if (i < q && (a.status || "pending") !== "accepted") acceptIds.push(a.applicant_id);
        if (i >= q && (a.status || "pending") === "accepted") waitlistIds.push(a.applicant_id);
      });
    }
    await onApply(acceptIds, waitlistIds);
    setApplying(false);
  };

  return (
    <div className="space-y-4">
      {/* Target + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Venue Capacity:</span>
          <div className="flex items-center gap-1">
            {[100, 150, 200, 250].map((n) => (
              <button key={n} onClick={() => setTarget(n)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${target === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                {n}
              </button>
            ))}
            <Input type="number" value={target} onChange={(e) => setTarget(Number(e.target.value) || 0)}
              className="w-16 h-7 text-xs text-center" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={autoFill}>
            Auto-fill {target}
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={acceptTopN}>
            Top {target}
          </Button>
        </div>
      </div>

      {/* Progress toward target */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className={`font-semibold tabular-nums ${remaining < 0 ? "text-destructive" : remaining === 0 ? "text-emerald-600" : "text-foreground"}`}>
            {totalSelected} / {target} selected
          </span>
          {remaining > 0 && <span className="text-muted-foreground">{remaining} spots left</span>}
          {remaining < 0 && <span className="text-destructive font-medium">{Math.abs(remaining)} over capacity</span>}
          {remaining === 0 && <span className="text-emerald-600 font-medium">Full</span>}
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full transition-all ${remaining < 0 ? "bg-destructive" : remaining === 0 ? "bg-emerald-500" : "bg-primary"}`}
            style={{ width: `${Math.min(100, (totalSelected / target) * 100)}%` }} />
        </div>
      </div>

      {/* Category sliders + expandable people lists */}
      <div className="space-y-2">
        {ATTENDEE_TYPES.map((t) => {
          const items = byType[t.key] || [];
          if (items.length === 0) return null;
          const quota = getQuota(t.key);
          const isExpanded = expandedCat === t.key;

          return (
            <div key={t.key} className="rounded-lg border overflow-hidden">
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                  <span className="text-sm font-medium flex-1">{t.label}</span>
                  <span className="text-xs text-muted-foreground">{items.length} available</span>
                  <button onClick={() => setExpandedCat(isExpanded ? null : t.key)}
                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                    {isExpanded ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <Slider
                    value={[quota]}
                    min={0}
                    max={items.length}
                    step={1}
                    onValueChange={([val]) => setQuotas((prev) => ({ ...prev, [t.key]: val }))}
                    className="flex-1"
                  />
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button onClick={() => setQuotas((p) => ({ ...p, [t.key]: Math.max(0, quota - 1) }))}
                      className="size-7 rounded flex items-center justify-center text-muted-foreground hover:bg-muted text-lg">-</button>
                    <span className="text-sm font-bold tabular-nums w-8 text-center">{quota}</span>
                    <button onClick={() => setQuotas((p) => ({ ...p, [t.key]: Math.min(items.length, quota + 1) }))}
                      className="size-7 rounded flex items-center justify-center text-muted-foreground hover:bg-muted text-lg">+</button>
                  </div>
                </div>
              </div>

              {/* Expandable people list */}
              {isExpanded && (
                <div className="border-t divide-y max-h-80 overflow-y-auto">
                  {items.map((a, i) => {
                    const isIn = i < quota;
                    const photo = getPhoto(a);
                    const score = Number(a.rank_score || 0);
                    return (
                      <div key={a.applicant_id}
                        className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${isIn ? "bg-background" : "bg-muted/30 opacity-60"}`}>
                        <span className="text-xs font-mono text-muted-foreground w-5 text-right shrink-0">{i + 1}</span>
                        {photo ? (
                          <img src={photo} alt="" className="size-6 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="size-6 rounded-full bg-muted flex items-center justify-center shrink-0 text-[10px] font-medium text-muted-foreground">
                            {getName(a).charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium truncate block">{getName(a)}</span>
                          <span className="text-[10px] text-muted-foreground truncate block">
                            {a.attendee_type_detail || getHeadline(a) || ""}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">{score}pts</span>
                        {a.linkedin_url && (
                          <a href={a.linkedin_url} target="_blank" rel="noopener noreferrer"
                            className="text-blue-500 hover:text-blue-600 shrink-0">
                            <Linkedin className="size-3" />
                          </a>
                        )}
                        {isIn ? (
                          <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle className="size-3.5 text-muted-foreground/30 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Apply */}
      <Button onClick={handleApply} disabled={applying} className="w-full">
        {applying ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Check className="size-4 mr-2" />}
        Accept Top {totalSelected} People
      </Button>
    </div>
  );
}

/* ── Judges Panel ── */
function JudgesPanel({ applicants, sessionId, onRefresh }: {
  applicants: Applicant[];
  sessionId: string;
  onRefresh: () => Promise<void>;
}) {
  const [rankingJudges, setRankingJudges] = useState<{ id: string; name: string; description: string }[]>([]);
  const [runningJudge, setRunningJudge] = useState<string | null>(null);
  const [expandedJudge, setExpandedJudge] = useState<string | null>(null);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [completedJudges, setCompletedJudges] = useState<Set<string>>(new Set());
  const [attendanceView, setAttendanceView] = useState<"all" | "in_person" | "virtual">("all");
  const autoRanRef = useRef(false);

  // Load ranking judges on mount
  useEffect(() => {
    api.listRankingJudges().then(setRankingJudges).catch(() => {});
  }, []);

  // Check which ranking judges have results
  const judgeResults = useMemo(() => {
    const results: Record<string, Applicant[]> = {};
    for (const judge of rankingJudges) {
      const field = `rank_${judge.id}`;
      const ranked = applicants
        .filter((a) => a[field] != null && Number(a[field]) > 0)
        .sort((a, b) => Number(a[field]) - Number(b[field]));
      if (ranked.length > 0) results[judge.id] = ranked;
    }
    return results;
  }, [applicants, rankingJudges]);

  // Auto-run judges that haven't been ranked yet
  useEffect(() => {
    if (autoRanRef.current || rankingJudges.length === 0 || applicants.length === 0) return;
    const missing = rankingJudges.filter((j) => !judgeResults[j.id]);
    if (missing.length === 0) return;
    const apiKey = typeof window !== "undefined" ? localStorage.getItem("ai_api_key") || "" : "";
    if (!apiKey) return;
    autoRanRef.current = true;

    (async () => {
      setRunningAll(true);
      for (const judge of missing) {
        setRunningJudge(judge.id);
        try {
          const provider = localStorage.getItem("ai_provider") || "anthropic";
          const model = localStorage.getItem("ai_model") || (provider === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o");
          await api.rankApplicants(judge.id, sessionId, { api_key: apiKey, model, provider });
          setCompletedJudges((prev) => new Set(prev).add(judge.id));
        } catch {
          toast.error(`Failed to rank with ${judge.name}`);
        }
        setRunningJudge(null);
      }
      setRunningAll(false);
      await onRefresh();
    })();
  }, [rankingJudges, judgeResults, applicants, sessionId, onRefresh]);

  const handleRunJudge = useCallback(async (judgeId: string) => {
    const apiKey = typeof window !== "undefined" ? localStorage.getItem("ai_api_key") || "" : "";
    const provider = typeof window !== "undefined" ? localStorage.getItem("ai_provider") || "anthropic" : "anthropic";
    const model = typeof window !== "undefined" ? localStorage.getItem("ai_model") || (provider === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o") : "claude-sonnet-4-20250514";
    if (!apiKey) { toast.error("Set an API key in Settings first"); return; }
    setRunningJudge(judgeId);
    try {
      const result = await api.rankApplicants(judgeId, sessionId, { api_key: apiKey, model, provider });
      toast.success(`${result.judge_name}: ranked ${result.ranked} people`);
      setCompletedJudges((prev) => new Set(prev).add(judgeId));
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ranking failed");
    } finally {
      setRunningJudge(null);
    }
  }, [sessionId, onRefresh]);

  const handleRunAll = useCallback(async () => {
    const apiKey = typeof window !== "undefined" ? localStorage.getItem("ai_api_key") || "" : "";
    if (!apiKey) { toast.error("Set an API key in Settings first"); return; }
    setRunningAll(true);
    setCompletedJudges(new Set());
    for (const judge of rankingJudges) {
      if (judgeResults[judge.id]) {
        setCompletedJudges((prev) => new Set(prev).add(judge.id));
        continue;
      }
      await handleRunJudge(judge.id);
    }
    setRunningAll(false);
  }, [rankingJudges, judgeResults, handleRunJudge]);

  // Attendance counts
  const inPersonCount = applicants.filter((a) => a.attendance_mode === "in_person").length;
  const virtualCount = applicants.filter((a) => a.attendance_mode === "virtual").length;
  const hasAttendance = inPersonCount > 0 || virtualCount > 0;

  // Filter by attendance
  const filterByAttendance = useCallback((list: Applicant[]) => {
    if (attendanceView === "all") return list;
    return list.filter((a) => (a.attendance_mode || "") === attendanceView);
  }, [attendanceView]);

  // Parse persona decisions from ai_reasoning
  const personaData = useMemo(() => {
    const judges: Record<string, {
      name: string; emoji: string; persona: typeof JUDGE_PERSONAS[number] | undefined;
      accepts: { applicant: Applicant; reasoning: string }[];
      passes: { applicant: Applicant; reasoning: string }[];
    }> = {};
    for (const a of applicants) {
      const reasoning = a.ai_reasoning || "";
      if (!reasoning || !reasoning.includes("[ACCEPT]") && !reasoning.includes("[PASS]")) continue;
      const parts = reasoning.split(" | ");
      for (const part of parts) {
        const match = part.match(/^(.+?)\s+\[(ACCEPT|PASS)\]:\s*(.*)$/);
        if (!match) continue;
        const fullName = match[1].trim();
        const decision = match[2].toLowerCase() as "accept" | "pass";
        const text = match[3].trim();
        const segments = [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(fullName)];
        const emoji = segments[0]?.segment || "";
        const judgeName = segments.slice(1).map((s) => s.segment).join("").trim();
        if (!judges[judgeName]) {
          const persona = JUDGE_PERSONAS.find((p) => p.name === judgeName || judgeName.includes(p.name.replace("The ", "")));
          judges[judgeName] = { name: judgeName, emoji, persona, accepts: [], passes: [] };
        }
        const entry = { applicant: a, reasoning: text };
        if (decision === "accept") judges[judgeName].accepts.push(entry);
        else judges[judgeName].passes.push(entry);
      }
    }
    return Object.values(judges);
  }, [applicants]);

  // Render an applicant row
  const renderRow = (a: Applicant, rank: number | null, reasoning: string, badge?: string) => {
    const photo = getPhoto(a);
    const isSelected = selectedApplicantId === a.applicant_id;
    const mode = a.attendance_mode as string;
    return (
      <div key={a.applicant_id}
        className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/30 cursor-pointer transition-colors"
        onClick={() => setSelectedApplicantId(isSelected ? null : a.applicant_id)}>
        {rank != null && <span className="text-[11px] font-mono font-bold text-muted-foreground w-7 text-right shrink-0">#{rank}</span>}
        {photo ? (
          <img src={photo} alt="" className="size-6 rounded-full object-cover shrink-0" />
        ) : (
          <div className="size-6 rounded-full bg-muted flex items-center justify-center shrink-0 text-[10px] font-medium text-muted-foreground">{getName(a).charAt(0).toUpperCase()}</div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium truncate">{getName(a)}</span>
            {mode === "virtual" && <span className="text-[9px] px-1 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 shrink-0">Virtual</span>}
            {mode === "in_person" && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 shrink-0">In Person</span>}
          </div>
          <span className="text-[10px] text-muted-foreground truncate block">{a.attendee_type_detail || getHeadline(a) || ""}</span>
          {isSelected && reasoning && <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed border-l-2 border-muted-foreground/20 pl-2">{reasoning}</p>}
        </div>
        {badge && <span className="text-[10px] font-mono text-muted-foreground shrink-0">{badge}</span>}
        {a.attendee_type && <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: getTypeColor(a.attendee_type) }} title={getTypeLabel(a.attendee_type)} />}
        {a.linkedin_url && <a href={a.linkedin_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-blue-500 hover:text-blue-600 shrink-0"><Linkedin className="size-3" /></a>}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-medium">{applicants.length} guests</p>
          <p className="text-xs text-muted-foreground">
            {Object.keys(judgeResults).length}/{rankingJudges.length} ranking judges complete
            {personaData.length > 0 && ` | ${personaData.length} panel judges`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasAttendance && (
            <div className="flex items-center rounded-lg border p-0.5">
              {[
                { key: "all" as const, label: "All", count: applicants.length },
                { key: "in_person" as const, label: "In Person", count: inPersonCount },
                { key: "virtual" as const, label: "Virtual", count: virtualCount },
              ].filter((f) => f.key === "all" || f.count > 0).map((f) => (
                <button key={f.key} onClick={() => setAttendanceView(f.key)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${attendanceView === f.key ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
          )}
          <Button size="sm" variant="outline" onClick={handleRunAll} disabled={runningAll || !!runningJudge}>
            {runningAll ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Scale className="size-4 mr-2" />}
            {runningAll ? `${completedJudges.size}/${rankingJudges.length}...` : "Re-run All"}
          </Button>
        </div>
      </div>

      {/* ── Ranking Judges ── */}
      {rankingJudges.map((judge) => {
        const allRanked = judgeResults[judge.id] || [];
        const ranked = filterByAttendance(allRanked);
        const isExpanded = expandedJudge === judge.id;
        const isRunning = runningJudge === judge.id;
        const hasResults = allRanked.length > 0;
        const rankField = `rank_${judge.id}`;
        const reasoningField = `rank_${judge.id}_reasoning`;

        return (
          <div key={judge.id} className="rounded-lg border overflow-hidden">
            <button
              onClick={() => { if (hasResults) { setExpandedJudge(isExpanded ? null : judge.id); setSelectedApplicantId(null); } }}
              className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
            >
              <div className={`size-8 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${hasResults ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" : isRunning ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400" : "bg-muted text-muted-foreground"}`}>
                {isRunning ? <Loader2 className="size-4 animate-spin" /> : hasResults ? <Check className="size-4" /> : <Scale className="size-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{judge.name}</span>
                  {hasResults && <span className="text-xs text-emerald-600 font-medium tabular-nums">{ranked.length} ranked</span>}
                  {isRunning && <span className="text-xs text-blue-600 font-medium">Ranking...</span>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{judge.description}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant={hasResults ? "ghost" : "outline"} className="h-7 text-xs"
                  onClick={() => handleRunJudge(judge.id)} disabled={isRunning || runningAll}>
                  {isRunning ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  <span className="ml-1.5">{hasResults ? "Re-run" : "Run"}</span>
                </Button>
              </div>
            </button>

            {isExpanded && hasResults && (
              <div className="border-t divide-y max-h-[500px] overflow-y-auto">
                {ranked.map((a) => renderRow(
                  a,
                  Number(a[rankField] || 0),
                  String(a[reasoningField] || ""),
                  a.panel_votes || undefined,
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Panel Judges (from AI analysis) ── */}
      {personaData.length > 0 && (
        <>
          <Separator />
          <h3 className="text-sm font-medium">Panel Judges</h3>
          {personaData.map((judge) => {
            const key = `persona_${judge.name}`;
            const isExpanded = expandedJudge === key;
            const filteredAccepts = filterByAttendance(judge.accepts.map((e) => e.applicant));
            const filteredPasses = filterByAttendance(judge.passes.map((e) => e.applicant));
            const acceptsMap = new Map(judge.accepts.map((e) => [e.applicant.applicant_id, e.reasoning]));
            const passesMap = new Map(judge.passes.map((e) => [e.applicant.applicant_id, e.reasoning]));

            return (
              <div key={key} className="rounded-lg border overflow-hidden">
                <button
                  onClick={() => { setExpandedJudge(isExpanded ? null : key); setSelectedApplicantId(null); }}
                  className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <span className="text-lg">{judge.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{judge.name}</span>
                    {judge.persona && <span className="text-xs text-muted-foreground ml-2">{judge.persona.specialty}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-medium text-emerald-600 tabular-nums">{filteredAccepts.length} accepted</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{filteredPasses.length} passed</span>
                    {isExpanded ? <ChevronUp className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t">
                    {filteredAccepts.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="size-3" />Accepted ({filteredAccepts.length})
                        </div>
                        <div className="divide-y max-h-64 overflow-y-auto">
                          {filteredAccepts.map((a) => renderRow(a, null, acceptsMap.get(a.applicant_id) || "", a.panel_votes || undefined))}
                        </div>
                      </div>
                    )}
                    {filteredPasses.length > 0 && (
                      <div>
                        <div className="px-3 py-1.5 bg-muted/50 text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                          <XCircle className="size-3" />Passed ({filteredPasses.length})
                        </div>
                        <div className="divide-y max-h-48 overflow-y-auto opacity-60">
                          {filteredPasses.map((a) => renderRow(a, null, passesMap.get(a.applicant_id) || "", a.panel_votes || undefined))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

export default function EventWorkspacePage() {
  const router = useRouter();
  const {
    sessionId, session, applicants, loading, error,
    refreshApplicants, refreshStats, refreshAll,
  } = useEvent();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [attendanceFilter, setAttendanceFilter] = useState<"all" | "in_person" | "virtual">("all");
  const [showImport, setShowImport] = useState(false);
  const [sortField, setSortField] = useState<"name" | "status" | "type" | "score">("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [copiedEmails, setCopiedEmails] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [cardIndex, setCardIndex] = useState(0);
  const [ranking, setRanking] = useState(false);
  const [showDragTip, setShowDragTip] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  /* ── Counts ── */
  const accepted = applicants.filter((a) => (a.status || "pending") === "accepted").length;
  const pending = applicants.filter((a) => (a.status || "pending") === "pending").length;
  const rejected = applicants.filter((a) => (a.status || "pending") === "rejected").length;
  const waitlisted = applicants.filter((a) => (a.status || "pending") === "waitlisted").length;
  const total = applicants.length;
  const analyzed = applicants.filter((a) => a.ai_reasoning).length;

  /* ── Sort & filter ── */
  const filtered = useMemo(() => {
    let list = applicants;
    // Filter by status or category
    if (statusFilter !== "all") {
      const isCategory = ATTENDEE_TYPES.some((t) => t.key === statusFilter);
      if (isCategory) {
        list = list.filter((a) => (a.attendee_type || "other") === statusFilter);
      } else {
        list = list.filter((a) => a.status === statusFilter);
      }
    }
    if (attendanceFilter !== "all") {
      list = list.filter((a) => (a.attendance_mode || "") === attendanceFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => {
        const s = [a.name, a.email, a.company, a.title, a.linkedin_headline as string]
          .filter(Boolean).join(" ").toLowerCase();
        return s.includes(q);
      });
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = getName(a).localeCompare(getName(b));
      else if (sortField === "status") cmp = (a.status || "pending").localeCompare(b.status || "pending");
      else if (sortField === "type") cmp = (a.attendee_type || "zzz").localeCompare(b.attendee_type || "zzz");
      else if (sortField === "score") {
        const ra = Number(a.global_rank || a.rank || 999);
        const rb = Number(b.global_rank || b.rank || 999);
        cmp = ra - rb;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [applicants, statusFilter, attendanceFilter, search, sortField, sortDir]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filtered.findIndex((a) => a.applicant_id === active.id);
    const newIndex = filtered.findIndex((a) => a.applicant_id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(filtered, oldIndex, newIndex);
    // Only update the items in the affected range
    const lo = Math.min(oldIndex, newIndex);
    const hi = Math.max(oldIndex, newIndex);
    try {
      const updates = reordered.slice(lo, hi + 1).map((a, i) =>
        api.updateApplicant(a.applicant_id, { extra: { global_rank: lo + i + 1, rank: lo + i + 1 } })
      );
      await Promise.all(updates);
      toast.success(`Moved to #${newIndex + 1}`);
      await refreshApplicants();
    } catch {
      toast.error("Failed to update rank");
    }
  }, [filtered, refreshApplicants]);

  /* ── Handlers ── */
  const handleStatusChange = useCallback(async (id: string, status: string) => {
    try {
      await api.updateApplicant(id, { status });
      await Promise.all([refreshApplicants(), refreshStats()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }, [refreshApplicants, refreshStats]);

  const handleDelete = useCallback(async () => {
    if (!confirm("Delete this event and all its applicants? This cannot be undone.")) return;
    try {
      await api.deleteSession(sessionId);
      toast.success("Event deleted");
      router.push("/events");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }, [sessionId, router]);

  const handleClearAll = useCallback(async () => {
    if (!confirm(`Reset all ${total} guests to pending?`)) return;
    setClearing(true);
    try {
      const ids = applicants.map((a) => a.applicant_id);
      await api.batchUpdateStatus(ids, "pending");
      toast.success("All statuses cleared to pending");
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear");
    } finally {
      setClearing(false);
    }
  }, [applicants, total, refreshAll]);

  const handleBlacklist = useCallback(async (applicant: Applicant) => {
    const email = applicant.email;
    if (!email) { toast.error("No email to blacklist"); return; }
    try {
      // Add to global blacklist
      const current = await api.getBlacklist();
      const emails = [...new Set([...(current.emails || []), email.toLowerCase()])];
      await api.updateBlacklist(emails);
      // Delete the applicant from this event
      await api.deleteApplicant(applicant.applicant_id);
      toast.success(`${getName(applicant)} blacklisted and removed`);
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to blacklist");
    }
  }, [refreshAll]);

  const handleCategoryChange = useCallback(async (id: string, newType: string) => {
    try {
      await api.updateApplicant(id, { extra: { attendee_type: newType, user_override_attendee_type: true } });
      await refreshApplicants();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update category");
    }
  }, [refreshApplicants]);

  const handleRankAll = useCallback(async () => {
    setRanking(true);
    try {
      const result = await api.rankSession(sessionId);
      toast.success(`Ranked ${result.classified || 0} guests${result.by_type ? ": " + Object.entries(result.by_type).map(([k, v]) => `${v} ${k}`).join(", ") : ""}`);
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ranking failed");
    } finally {
      setRanking(false);
    }
  }, [sessionId, refreshAll]);

  const VENUE_CAPACITY = 200;
  const overCapacity = accepted > VENUE_CAPACITY ? accepted - VENUE_CAPACITY : 0;

  const handleExportAll = useCallback(() => {
    if (!applicants.length) return;
    const skip = new Set(["applicant_id", "session_id"]);
    const keys = new Set<string>();
    for (const a of applicants) for (const k of Object.keys(a)) if (!skip.has(k)) keys.add(k);
    const pri = ["name", "email", "status", "attendee_type", "attendee_type_detail", "ai_score", "ai_reasoning", "company", "title", "location", "linkedin_url"];
    const headers = [...pri.filter((k) => keys.has(k)), ...[...keys].filter((k) => !pri.includes(k)).sort()];
    const esc = (v: unknown) => { const s = String(v ?? ""); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [headers.join(","), ...applicants.map((a) => headers.map((h) => esc(a[h])).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(session?.name || "event").replace(/\s+/g, "-").toLowerCase()}-all-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [applicants, session]);

  const handleExportAccepted = useCallback(() => {
    const acc = applicants.filter((a) => a.status === "accepted");
    if (!acc.length) { toast.error("No accepted guests"); return; }
    const headers = ["name", "email", "company", "title", "attendee_type", "attendee_type_detail", "linkedin_url"];
    const esc = (v: unknown) => { const s = String(v ?? ""); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [headers.join(","), ...acc.map((a) => headers.map((h) => esc(a[h])).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(session?.name || "event").replace(/\s+/g, "-").toLowerCase()}-accepted-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${acc.length} accepted guests`);
  }, [applicants, session]);

  const handleCopyEmails = useCallback(() => {
    const emails = applicants.filter((a) => a.status === "accepted").map((a) => a.email).filter(Boolean);
    if (!emails.length) { toast.error("No accepted emails"); return; }
    navigator.clipboard.writeText(emails.join("\n"));
    setCopiedEmails(true);
    toast.success(`Copied ${emails.length} emails — paste into Luma`);
    setTimeout(() => setCopiedEmails(false), 2000);
  }, [applicants]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const selectedApplicant = selectedId ? applicants.find((a) => a.applicant_id === selectedId) : null;

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center py-20"><p className="text-sm text-destructive mb-4">{error}</p><Button variant="outline" onClick={() => refreshAll()}>Retry</Button></div>;

  return (
    <div className="space-y-4 md:space-y-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{session?.name || "Event"}</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{total} guests</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={handleDelete}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* Status bar */}
      {total > 0 && (
        <div className="space-y-3">
          {/* Proportional status bar */}
          <div className="h-3 rounded-full overflow-hidden flex bg-muted">
            {accepted > 0 && (
              <button onClick={() => setStatusFilter(statusFilter === "accepted" ? "all" : "accepted")}
                className="bg-emerald-500 transition-all hover:brightness-110" style={{ width: `${(accepted / total) * 100}%` }} title={`${accepted} accepted`} />
            )}
            {waitlisted > 0 && (
              <button onClick={() => setStatusFilter(statusFilter === "waitlisted" ? "all" : "waitlisted")}
                className="bg-amber-500 transition-all hover:brightness-110" style={{ width: `${(waitlisted / total) * 100}%` }} title={`${waitlisted} waitlisted`} />
            )}
            {pending > 0 && (
              <button onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")}
                className="bg-blue-400 transition-all hover:brightness-110" style={{ width: `${(pending / total) * 100}%` }} title={`${pending} pending`} />
            )}
            {rejected > 0 && (
              <button onClick={() => setStatusFilter(statusFilter === "rejected" ? "all" : "rejected")}
                className="bg-red-500 transition-all hover:brightness-110" style={{ width: `${(rejected / total) * 100}%` }} title={`${rejected} rejected`} />
            )}
          </div>

          {/* Legend + clear */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 md:gap-4 text-xs md:text-sm flex-wrap">
              {[
                { label: "Accepted", value: accepted, color: "bg-emerald-500", filter: "accepted" },
                { label: "Waitlisted", value: waitlisted, color: "bg-amber-500", filter: "waitlisted" },
                { label: "Pending", value: pending, color: "bg-blue-400", filter: "pending" },
                { label: "Rejected", value: rejected, color: "bg-red-500", filter: "rejected" },
              ].filter((s) => s.value > 0).map((s) => (
                <button
                  key={s.label}
                  onClick={() => setStatusFilter(statusFilter === s.filter ? "all" : s.filter)}
                  className={`flex items-center gap-1.5 transition-colors ${
                    statusFilter === s.filter ? "font-semibold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className={`size-2.5 rounded-full ${s.color}`} />
                  <span className="tabular-nums">{s.value}</span> {s.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {/* Capacity indicator */}
              <span className={`text-xs tabular-nums font-medium ${overCapacity > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {accepted} / {VENUE_CAPACITY}
                {overCapacity > 0 && (
                  <span className="inline-flex items-center gap-1 ml-1">
                    <AlertTriangle className="size-3" />+{overCapacity} over
                  </span>
                )}
              </span>
              {(accepted + rejected + waitlisted > 0) && (
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7"
                  onClick={handleClearAll} disabled={clearing}>
                  {clearing ? <Loader2 className="size-3 mr-1.5 animate-spin" /> : <X className="size-3 mr-1.5" />}
                  Clear All
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Category mix overview ── */}
      {total > 0 && (() => {
        const typeCounts: Record<string, number> = {};
        const typeAccepted: Record<string, number> = {};
        for (const a of applicants) {
          const t = a.attendee_type || "other";
          typeCounts[t] = (typeCounts[t] || 0) + 1;
          if (a.status === "accepted") typeAccepted[t] = (typeAccepted[t] || 0) + 1;
        }
        return (
          <div className="flex items-center gap-3 flex-wrap">
            {ATTENDEE_TYPES.map((t) => {
              const count = typeCounts[t.key] || 0;
              const acc = typeAccepted[t.key] || 0;
              if (count === 0) return null;
              return (
                <button
                  key={t.key}
                  onClick={() => setStatusFilter(statusFilter === t.key ? "all" : t.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    statusFilter === t.key
                      ? "border-foreground/20 bg-accent"
                      : "border-transparent hover:bg-muted"
                  }`}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: t.color }} />
                  <span>{t.label}</span>
                  <span className="tabular-nums text-muted-foreground">{acc}/{count}</span>
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Attendance mode filter */}
      {total > 0 && (() => {
        const inPerson = applicants.filter((a) => a.attendance_mode === "in_person").length;
        const virtual = applicants.filter((a) => a.attendance_mode === "virtual").length;
        if (inPerson === 0 && virtual === 0) return null;
        return (
          <div className="flex items-center gap-2">
            {[
              { key: "all" as const, label: "All", count: total },
              { key: "in_person" as const, label: "In Person", count: inPerson },
              { key: "virtual" as const, label: "Virtual", count: virtual },
            ].filter((f) => f.key === "all" || f.count > 0).map((f) => (
              <button key={f.key}
                onClick={() => setAttendanceFilter(attendanceFilter === f.key ? "all" : f.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  attendanceFilter === f.key ? "border-foreground/20 bg-accent" : "border-transparent hover:bg-muted text-muted-foreground"
                }`}>
                {f.label} <span className="tabular-nums ml-1">{f.count}</span>
              </button>
            ))}
          </div>
        );
      })()}

      <Tabs defaultValue="guests">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="guests">Guests</TabsTrigger>
            <TabsTrigger value="judges">Judges</TabsTrigger>
            <TabsTrigger value="mix">Mix</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowImport(true)}>
              <Upload className="size-4 mr-2" />Import
            </Button>
          </div>
        </div>

        {/* ── Guests Tab ── */}
        <TabsContent value="guests" className="mt-4 space-y-4">
          {/* Search + view toggle */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guests..." className="pl-9 h-9" />
              {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="size-4 text-muted-foreground" /></button>}
            </div>
            <p className="text-xs text-muted-foreground">{filtered.length} results</p>
            <div className="flex items-center rounded-lg border p-0.5 ml-auto">
              <button onClick={() => setViewMode("table")}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === "table" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <TableIcon className="size-4" />
              </button>
              <button onClick={() => { setViewMode("cards"); setCardIndex(0); }}
                className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${viewMode === "cards" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                <LayoutGrid className="size-4" />
              </button>
            </div>
          </div>

          {total === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Users className="size-12 text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium mb-1">No guests yet</p>
                <p className="text-sm text-muted-foreground mb-4">Import a CSV or add guests from Luma</p>
                <Button onClick={() => setShowImport(true)}>
                  <Upload className="size-4 mr-2" />Import Guests
                </Button>
              </CardContent>
            </Card>
          ) : viewMode === "cards" ? (
            <CardReview
              applicants={filtered}
              index={cardIndex}
              onIndexChange={setCardIndex}
              onStatusChange={handleStatusChange}
              onBlacklist={handleBlacklist}
            />
          ) : (
            <>
            {/* Drag tip */}
            {showDragTip && (
              <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 mb-2">
                <Info className="size-3.5 shrink-0" />
                <span>Drag the <GripVertical className="size-3 inline -mt-0.5" /> handle to reorder guests. New rank saves automatically.</span>
                <button onClick={() => setShowDragTip(false)} className="ml-auto shrink-0 hover:text-blue-900 dark:hover:text-blue-100"><X className="size-3.5" /></button>
              </div>
            )}

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis]}>
              <div className="rounded-lg border overflow-hidden">
                <Table className="table-fixed w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-7" />
                      <TableHead className="w-7">#</TableHead>
                      <TableHead>
                        <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-foreground">
                          Guest <ArrowUpDown className="size-3" />
                        </button>
                      </TableHead>
                      <TableHead className="w-28 hidden md:table-cell">Category</TableHead>
                      <TableHead className="w-20">Status</TableHead>
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <SortableContext items={filtered.map((a) => a.applicant_id)} strategy={verticalListSortingStrategy}>
                    <TableBody>
                      {filtered.map((a, idx) => {
                        const photo = getPhoto(a);
                        const headline = getHeadline(a);
                        const rank = getRank(a);
                        return (
                          <SortableRow key={a.applicant_id} id={a.applicant_id}>
                            <TableCell className="text-center text-xs font-mono font-bold text-muted-foreground w-8" onClick={() => setSelectedId(a.applicant_id)}>
                              {rank?.rank || idx + 1}
                            </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3 min-w-0">
                            {photo ? (
                              <img src={photo} alt="" className="size-9 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="size-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-medium text-muted-foreground">
                                {getName(a).charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <p className="font-medium text-sm truncate">{getName(a)}</p>
                                {a.linkedin_url && (
                                  <a href={a.linkedin_url} target="_blank" rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-blue-500 hover:text-blue-600 shrink-0">
                                    <Linkedin className="size-3.5" />
                                  </a>
                                )}
                              </div>
                              {headline && <p className="text-xs text-muted-foreground truncate">{headline}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell" onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={a.attendee_type || "other"}
                            onValueChange={(val) => handleCategoryChange(a.applicant_id, val)}
                          >
                            <SelectTrigger className="h-7 text-[11px] w-full border-0 shadow-none px-1 hover:bg-muted">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ATTENDEE_TYPES.map((t) => (
                                <SelectItem key={t.key} value={t.key} className="text-xs">
                                  <span className="flex items-center gap-1.5">
                                    <span className="size-2 rounded-full" style={{ backgroundColor: t.color }} />
                                    {t.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              a.status === "accepted" ? "default" :
                              a.status === "rejected" ? "destructive" :
                              "secondary"
                            }
                            className="text-[11px]"
                          >
                            {(a.status || "pending").charAt(0).toUpperCase() + (a.status || "pending").slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              onClick={() => handleStatusChange(a.applicant_id, a.status === "accepted" ? "pending" : "accepted")}
                              className={`size-7 rounded-md flex items-center justify-center transition-colors ${
                                a.status === "accepted"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50"
                              }`}
                              title={a.status === "accepted" ? "Undo" : "Accept"}
                            >
                              <CheckCircle2 className="size-3.5" />
                            </button>
                            <button
                              onClick={() => handleStatusChange(a.applicant_id, a.status === "waitlisted" ? "pending" : "waitlisted")}
                              className={`size-7 rounded-md flex items-center justify-center transition-colors ${
                                a.status === "waitlisted"
                                  ? "bg-amber-100 text-amber-700"
                                  : "text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
                              }`}
                              title={a.status === "waitlisted" ? "Undo" : "Waitlist"}
                            >
                              <Clock className="size-3.5" />
                            </button>
                            <button
                              onClick={() => handleStatusChange(a.applicant_id, a.status === "rejected" ? "pending" : "rejected")}
                              className={`size-7 rounded-md flex items-center justify-center transition-colors ${
                                a.status === "rejected"
                                  ? "bg-red-100 text-red-700"
                                  : "text-muted-foreground hover:text-red-600 hover:bg-red-50"
                              }`}
                              title={a.status === "rejected" ? "Undo" : "Reject"}
                            >
                              <XCircle className="size-3.5" />
                            </button>
                          </div>
                        </TableCell>
                      </SortableRow>
                    );
                  })}
                    </TableBody>
                  </SortableContext>
                </Table>
              </div>
            </DndContext>
            </>
          )}
        </TabsContent>

        {/* ── Judges Tab ── */}
        <TabsContent value="judges" className="mt-4 space-y-4">
          <JudgesPanel applicants={applicants} sessionId={sessionId} onRefresh={refreshAll} />
        </TabsContent>

        {/* ── Mix Tab ── */}
        <TabsContent value="mix" className="mt-4 space-y-6">
          <MixPanel applicants={applicants} onApply={async (acceptIds, waitlistIds) => {
            try {
              if (acceptIds.length) await api.batchUpdateStatus(acceptIds, "accepted");
              if (waitlistIds.length) await api.batchUpdateStatus(waitlistIds, "waitlisted");
              toast.success(`${acceptIds.length} accepted, ${waitlistIds.length} waitlisted`);
              await refreshAll();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed to apply mix");
            }
          }} />
        </TabsContent>

        {/* ── Export Tab ── */}
        <TabsContent value="export" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${analyzed > 0 ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                  {analyzed > 0 ? <Check className="size-4" /> : "1"}
                </div>
                <div>
                  <p className={`text-sm font-medium ${analyzed > 0 ? "line-through text-muted-foreground" : ""}`}>Run AI Analysis</p>
                  <p className="text-xs text-muted-foreground">Classify and score all guests</p>
                </div>
                {analyzed === 0 && (
                  <Button size="sm" variant="outline" className="ml-auto" onClick={() => router.push(`/events/${sessionId}/analyze`)}>
                    <Brain className="size-4 mr-2" />Analyze
                  </Button>
                )}
              </div>
              <Separator />
              <div className="flex items-center gap-4">
                <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${accepted > 0 ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                  {accepted > 0 ? <Check className="size-4" /> : "2"}
                </div>
                <div>
                  <p className={`text-sm font-medium ${accepted > 0 ? "line-through text-muted-foreground" : ""}`}>Accept top guests</p>
                  <p className="text-xs text-muted-foreground">
                    {accepted > 0 ? `${accepted} accepted out of ${total}` : "Review and accept/reject guests"}
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-4">
                <div className="size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-muted text-muted-foreground">3</div>
                <div>
                  <p className="text-sm font-medium">Export & paste into Luma</p>
                  <p className="text-xs text-muted-foreground">Download CSV or copy emails to clipboard</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <ClipboardCopy className="size-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Copy Accepted Emails</p>
                    <p className="text-xs text-muted-foreground">Paste directly into Luma&apos;s guest list</p>
                  </div>
                </div>
                <Button
                  onClick={handleCopyEmails}
                  disabled={accepted === 0}
                  className="w-full"
                  variant={copiedEmails ? "outline" : "default"}
                >
                  {copiedEmails ? <Check className="size-4 mr-2" /> : <ClipboardCopy className="size-4 mr-2" />}
                  {copiedEmails ? "Copied!" : `Copy ${accepted} Emails`}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Download className="size-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Download CSV</p>
                    <p className="text-xs text-muted-foreground">Full export with all fields</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleExportAccepted} disabled={accepted === 0} variant="outline" className="flex-1" size="sm">
                    Accepted Only ({accepted})
                  </Button>
                  <Button onClick={handleExportAll} disabled={total === 0} variant="outline" className="flex-1" size="sm">
                    All Guests ({total})
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail sheet */}
      {selectedApplicant && (
        <DetailSheet
          applicant={selectedApplicant}
          onStatusChange={handleStatusChange}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* Import dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Guests</DialogTitle>
            <DialogDescription>Upload a CSV export from Luma or any spreadsheet.</DialogDescription>
          </DialogHeader>
          <CSVUploader
            onUploadSuccess={async (count) => {
              toast.success(`Imported ${count} guests`);
              await refreshAll();
              setShowImport(false);
            }}
            sessionId={sessionId}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Card Review ── */

function CardReview({
  applicants,
  index,
  onIndexChange,
  onStatusChange,
  onBlacklist,
}: {
  applicants: Applicant[];
  index: number;
  onIndexChange: (i: number) => void;
  onStatusChange: (id: string, status: string) => void;
  onBlacklist: (a: Applicant) => void;
}) {
  const current = applicants[index];

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      switch (e.key) {
        case "ArrowLeft": case "a":
          e.preventDefault();
          if (index > 0) onIndexChange(index - 1);
          break;
        case "ArrowRight": case "d":
          e.preventDefault();
          if (index < applicants.length - 1) onIndexChange(index + 1);
          break;
        case "1":
          e.preventDefault();
          if (current) onStatusChange(current.applicant_id, "accepted");
          break;
        case "2":
          e.preventDefault();
          if (current) onStatusChange(current.applicant_id, "waitlisted");
          break;
        case "3":
          e.preventDefault();
          if (current) onStatusChange(current.applicant_id, "rejected");
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  if (!current || applicants.length === 0) {
    return <p className="text-center py-12 text-sm text-muted-foreground">No guests to review.</p>;
  }

  const photo = getPhoto(current);
  const headline = getHeadline(current);
  const summary = getSummary(current);
  const rank = getRank(current);
  const about = (current.about as string) || (current.linkedin_about as string) || "";
  const experience = (current.experience as string) || (current.linkedin_experience as string) || "";
  const education = (current.education as string) || (current.linkedin_education as string) || "";
  const company = current.company || (current.linkedin_company as string) || "";
  const location = current.location || (current.linkedin_location as string) || "";

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-lg mx-auto">
      {/* Progress */}
      <div className="w-full flex items-center gap-3 text-xs text-muted-foreground">
        <span className="tabular-nums font-medium">{index + 1} / {applicants.length}</span>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${((index + 1) / applicants.length) * 100}%` }} />
        </div>
      </div>

      {/* Card */}
      <Card className="w-full shadow-lg border-border/80">
        {/* Photo + Name header */}
        <div className="p-6 pb-4">
          <div className="flex items-start gap-4">
            {photo ? (
              <img src={photo} alt="" className="size-20 rounded-2xl object-cover shrink-0 shadow-md" />
            ) : (
              <div className="size-20 rounded-2xl bg-gradient-to-br from-muted to-muted/60 flex items-center justify-center shrink-0 text-3xl font-bold text-muted-foreground/50 shadow-md">
                {getName(current).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">{getName(current)}</h2>
                {rank && (
                  <span className="text-sm font-bold text-muted-foreground tabular-nums">
                    #{rank.rank}
                    <span className="text-xs font-normal text-muted-foreground/60">/{rank.total}</span>
                  </span>
                )}
                {rank && rank.catRank > 0 && (
                  <span className="text-[10px] text-muted-foreground/60 tabular-nums">
                    {current.attendee_type ? getTypeLabel(current.attendee_type) : ""} #{rank.catRank}/{rank.catTotal}
                  </span>
                )}
                {rank && (
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary tabular-nums">
                    {rank.score}
                  </span>
                )}
              </div>
              {headline && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{headline}</p>}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {current.attendee_type && (
                  <Badge variant="outline" className="text-[11px]"
                    style={{ borderColor: getTypeColor(current.attendee_type) + "40", color: getTypeColor(current.attendee_type), backgroundColor: getTypeColor(current.attendee_type) + "10" }}>
                    {current.attendee_type_detail || getTypeLabel(current.attendee_type)}
                  </Badge>
                )}
                <Badge variant={current.status === "accepted" ? "default" : current.status === "rejected" ? "destructive" : "secondary"} className="text-[11px]">
                  {(current.status || "pending").charAt(0).toUpperCase() + (current.status || "pending").slice(1)}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Info chips — no PII (email/linkedin hidden) */}
        {(company || location) && (
          <div className="px-6 pb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {company && <span className="flex items-center gap-1"><Building2 className="size-3" />{company}</span>}
            {location && <span className="flex items-center gap-1"><MapPin className="size-3" />{location}</span>}
          </div>
        )}

        {/* AI Summary */}
        {(summary || current.ai_reasoning) && (
          <div className="px-6 pb-3">
            <div className="rounded-lg bg-muted/50 border border-border/50 p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="size-3.5 text-primary mt-0.5 shrink-0" />
                <p className="text-sm leading-relaxed">{summary || current.ai_reasoning}</p>
              </div>
            </div>
          </div>
        )}

        {/* Content: About, Experience, Education */}
        {(about || experience || education) && (
          <div className="px-6 pb-4 space-y-3 border-t pt-4">
            {about && (
              <div>
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">About</h4>
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{about}</p>
              </div>
            )}
            {experience && (
              <div>
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1"><Briefcase className="size-3" />Experience</h4>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line line-clamp-4">{experience}</p>
              </div>
            )}
            {education && (
              <div>
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1"><GraduationCap className="size-3" />Education</h4>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line line-clamp-3">{education}</p>
              </div>
            )}
          </div>
        )}

      </Card>

      {/* Floating controls */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t shadow-lg">
        <div className="max-w-lg mx-auto p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Button size="sm" variant={current.status === "accepted" ? "default" : "outline"} className="flex-1"
              onClick={() => onStatusChange(current.applicant_id, "accepted")}>
              <CheckCircle2 className="size-4 mr-1.5" />Accept
            </Button>
            <Button size="sm" variant={current.status === "waitlisted" ? "default" : "outline"} className="flex-1"
              onClick={() => onStatusChange(current.applicant_id, "waitlisted")}>
              <Clock className="size-4 mr-1.5" />Waitlist
            </Button>
            <Button size="sm" variant={current.status === "rejected" ? "destructive" : "outline"} className="flex-1"
              onClick={() => onStatusChange(current.applicant_id, "rejected")}>
              <XCircle className="size-4 mr-1.5" />Reject
            </Button>
            <Button size="sm" variant="outline" className="shrink-0 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => onBlacklist(current)}>
              <ShieldBan className="size-4 mr-1.5" />Blacklist
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" disabled={index === 0} onClick={() => onIndexChange(index - 1)}>
              <ChevronLeft className="size-4 mr-1" />Prev
            </Button>
            <span className="text-[10px] text-muted-foreground">
              <kbd className="px-1 py-0.5 rounded border bg-muted font-mono">A</kbd>/<kbd className="px-1 py-0.5 rounded border bg-muted font-mono">D</kbd> nav
              <span className="mx-1">|</span>
              <kbd className="px-1 py-0.5 rounded border bg-muted font-mono">1</kbd><kbd className="px-1 py-0.5 rounded border bg-muted font-mono">2</kbd><kbd className="px-1 py-0.5 rounded border bg-muted font-mono">3</kbd>
            </span>
            <Button variant="ghost" size="sm" disabled={index >= applicants.length - 1} onClick={() => onIndexChange(index + 1)}>
              Next<ChevronRight className="size-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
      <div className="h-28" />
    </div>
  );
}

/* ── Detail Sheet ── */

function DetailSheet({
  applicant,
  onStatusChange,
  onClose,
}: {
  applicant: Applicant;
  onStatusChange: (id: string, status: string) => void;
  onClose: () => void;
}) {
  const photo = getPhoto(applicant);
  const headline = getHeadline(applicant);
  const summary = getSummary(applicant);
  const about = (applicant.about as string) || (applicant.linkedin_about as string) || "";
  const experience = (applicant.experience as string) || (applicant.linkedin_experience as string) || "";
  const education = (applicant.education as string) || (applicant.linkedin_education as string) || "";

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-full max-w-md bg-background border-l shadow-xl overflow-y-auto animate-in slide-in-from-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            {photo ? (
              <img src={photo} alt="" className="size-16 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="size-16 rounded-xl bg-muted flex items-center justify-center shrink-0 text-2xl font-bold text-muted-foreground">
                {getName(applicant).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold">{getName(applicant)}</h2>
              {headline && <p className="text-sm text-muted-foreground">{headline}</p>}
              <div className="flex items-center gap-2 mt-2">
                {applicant.attendee_type && (
                  <Badge variant="outline" className="text-xs">
                    {applicant.attendee_type_detail || applicant.attendee_type}
                  </Badge>
                )}
                <Badge
                  variant={applicant.status === "accepted" ? "default" : applicant.status === "rejected" ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {(applicant.status || "pending").charAt(0).toUpperCase() + (applicant.status || "pending").slice(1)}
                </Badge>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="size-5" />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button size="sm" variant={applicant.status === "accepted" ? "default" : "outline"} className="flex-1"
              onClick={() => onStatusChange(applicant.applicant_id, "accepted")}>
              <CheckCircle2 className="size-4 mr-1" />Accept
            </Button>
            <Button size="sm" variant={applicant.status === "waitlisted" ? "default" : "outline"} className="flex-1"
              onClick={() => onStatusChange(applicant.applicant_id, "waitlisted")}>
              <Clock className="size-4 mr-1" />Waitlist
            </Button>
            <Button size="sm" variant={applicant.status === "rejected" ? "destructive" : "outline"} className="flex-1"
              onClick={() => onStatusChange(applicant.applicant_id, "rejected")}>
              <XCircle className="size-4 mr-1" />Reject
            </Button>
          </div>

          <Separator />

          {/* Contact */}
          <div className="space-y-2 text-sm">
            {applicant.email && (
              <a href={`mailto:${applicant.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <span className="truncate">{applicant.email}</span>
              </a>
            )}
            {applicant.linkedin_url && (
              <a href={applicant.linkedin_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:underline">
                <Linkedin className="size-4" />LinkedIn<ExternalLink className="size-3" />
              </a>
            )}
            {applicant.company && <p className="text-muted-foreground">{applicant.title ? `${applicant.title} @ ${applicant.company}` : applicant.company}</p>}
            {applicant.location && <p className="text-muted-foreground">{applicant.location}</p>}
          </div>

          {/* AI Summary */}
          {(summary || applicant.ai_reasoning) && (
            <>
              <Separator />
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="size-3" />AI Summary
                </h3>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-sm leading-relaxed">
                    {summary || applicant.ai_reasoning}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* About / Experience / Education */}
          {about && (
            <>
              <Separator />
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">About</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{about}</p>
              </div>
            </>
          )}
          {experience && (
            <>
              <Separator />
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Experience</h3>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{experience}</p>
              </div>
            </>
          )}
          {education && (
            <>
              <Separator />
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Education</h3>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{education}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
