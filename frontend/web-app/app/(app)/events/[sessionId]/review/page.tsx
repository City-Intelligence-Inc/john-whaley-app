"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Loader2,
  ArrowUpDown,
  Check,
  X,
  GripVertical,
  Zap,
  RefreshCw,
  Users,
  Trophy,
  Gavel,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useEvent } from "@/components/event-provider";
import { api } from "@/lib/api";
import type { Applicant } from "@/lib/api";
import { ATTENDEE_TYPES } from "@/lib/constants";
import { JUDGE_PERSONAS } from "@/lib/judge-personas";

/* ── Helpers ── */

function getName(a: Applicant): string {
  return a.name || (a.linkedin_name as string) || a.email || "No name";
}

function getHeadline(a: Applicant): string {
  return (a.linkedin_headline as string) || a.title || "";
}

function getScore(a: Applicant): number {
  if (!a.ai_score) return 0;
  const n = Number(a.ai_score);
  return isNaN(n) ? 0 : n;
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

function scoreBg(score: number): string {
  if (score >= 70) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
  if (score >= 40) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-red-500/15 text-red-400 border-red-500/30";
}

function statusBadge(status: string): string {
  switch (status) {
    case "accepted": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "rejected": return "bg-red-500/15 text-red-400 border-red-500/30";
    case "waitlisted": return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    default: return "bg-muted text-muted-foreground border-border/50";
  }
}

function statusLabel(s: string): string {
  switch (s) {
    case "accepted": return "Accepted";
    case "rejected": return "Rejected";
    case "waitlisted": return "Waitlisted";
    default: return "Pending";
  }
}

function getTypeLabel(key: string): string {
  return ATTENDEE_TYPES.find((t) => t.key === key)?.label || key;
}

function getTypeColor(key: string): string {
  return ATTENDEE_TYPES.find((t) => t.key === key)?.color || "#6b7280";
}

/** Parse panel_votes JSON string: { judge_id: { score, decision, reasoning } } */
function parsePanelVotes(a: Applicant): Record<string, { score: number; decision: string; reasoning: string }> {
  if (!a.panel_votes) return {};
  try {
    const raw = typeof a.panel_votes === "string" ? JSON.parse(a.panel_votes) : a.panel_votes;
    const result: Record<string, { score: number; decision: string; reasoning: string }> = {};
    for (const [judgeId, val] of Object.entries(raw)) {
      const v = val as Record<string, unknown>;
      result[judgeId] = {
        score: Number(v.score || 0),
        decision: String(v.decision || "pass"),
        reasoning: String(v.reasoning || ""),
      };
    }
    return result;
  } catch {
    return {};
  }
}

/* ────────────────────────────────────────────────────────────────────── */
/*  PHASE 1: Category Verification                                       */
/* ────────────────────────────────────────────────────────────────────── */

function CategoryVerification({
  applicants,
  onRecategorize,
}: {
  applicants: Applicant[];
  onRecategorize: (id: string, newType: string) => Promise<void>;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  // Group applicants by attendee_type
  const grouped = useMemo(() => {
    const groups: Record<string, Applicant[]> = {};
    // Initialize all types
    for (const t of ATTENDEE_TYPES) {
      groups[t.key] = [];
    }
    groups["unclassified"] = [];

    for (const a of applicants) {
      const type = a.attendee_type || "unclassified";
      if (!groups[type]) groups[type] = [];
      groups[type].push(a);
    }
    return groups;
  }, [applicants]);

  // Filter applicants by search
  const matchesSearch = useCallback(
    (a: Applicant) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return [getName(a), getHeadline(a), a.email, a.company]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    },
    [searchQuery]
  );

  const categoryOrder = [...ATTENDEE_TYPES.map((t) => t.key), "unclassified"];

  return (
    <div className="space-y-6">
      {/* Description */}
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Verify that each applicant is categorized correctly. Use the dropdown to move applicants between categories if the AI miscategorized them.
        </p>
        <div className="relative max-w-md">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search applicants..."
            className="h-9"
          />
        </div>
      </div>

      {/* Category groups */}
      <div className="space-y-4">
        {categoryOrder.map((typeKey) => {
          const items = grouped[typeKey] || [];
          if (items.length === 0) return null;
          const filtered = items.filter(matchesSearch);
          if (filtered.length === 0 && searchQuery.trim()) return null;

          const typeLabel = typeKey === "unclassified" ? "Unclassified" : getTypeLabel(typeKey);
          const typeColor = typeKey === "unclassified" ? "#6b7280" : getTypeColor(typeKey);

          return (
            <Card key={typeKey} className="border-border/50">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="size-3 rounded-full shrink-0"
                      style={{ backgroundColor: typeColor }}
                    />
                    <CardTitle className="text-sm font-semibold">
                      {typeLabel}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {items.length}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                <div className="rounded-lg border border-border/30 divide-y divide-border/20">
                  {(searchQuery.trim() ? filtered : items).map((a) => (
                    <div
                      key={a.applicant_id}
                      className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-muted/30"
                    >
                      <GripVertical className="size-3.5 text-muted-foreground/40 shrink-0" />

                      {/* Name + headline */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {getName(a)}
                          </span>
                          {a.attendee_type_detail && (
                            <span className="text-xs text-muted-foreground/70 truncate">
                              {a.attendee_type_detail}
                            </span>
                          )}
                        </div>
                        {getHeadline(a) && (
                          <p className="text-xs text-muted-foreground truncate">
                            {getHeadline(a)}
                          </p>
                        )}
                      </div>

                      {/* Status badge */}
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${statusBadge(a.status)}`}
                      >
                        {statusLabel(a.status)}
                      </Badge>

                      {/* Re-categorize dropdown */}
                      <Select
                        value={a.attendee_type || "unclassified"}
                        onValueChange={(val) => onRecategorize(a.applicant_id, val)}
                      >
                        <SelectTrigger className="h-7 w-[140px] text-xs shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ATTENDEE_TYPES.map((t) => (
                            <SelectItem key={t.key} value={t.key} className="text-xs">
                              <div className="flex items-center gap-2">
                                <div
                                  className="size-2 rounded-full"
                                  style={{ backgroundColor: t.color }}
                                />
                                {t.label}
                              </div>
                            </SelectItem>
                          ))}
                          <SelectItem value="other" className="text-xs">
                            Other
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Summary counts */}
      <Card className="border-border/50">
        <CardContent className="py-4 px-4">
          <div className="flex items-center flex-wrap gap-4">
            {categoryOrder.map((typeKey) => {
              const items = grouped[typeKey] || [];
              if (items.length === 0) return null;
              const typeLabel = typeKey === "unclassified" ? "Unclassified" : getTypeLabel(typeKey);
              const typeColor = typeKey === "unclassified" ? "#6b7280" : getTypeColor(typeKey);
              return (
                <div key={typeKey} className="flex items-center gap-2 text-sm">
                  <div className="size-2.5 rounded-full" style={{ backgroundColor: typeColor }} />
                  <span className="text-muted-foreground">{typeLabel}:</span>
                  <span className="font-semibold">{items.length}</span>
                </div>
              );
            })}
            <Separator orientation="vertical" className="h-5" />
            <div className="text-sm">
              <span className="text-muted-foreground">Total:</span>{" "}
              <span className="font-semibold">{applicants.length}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  PHASE 2: Judge Rankings                                               */
/* ────────────────────────────────────────────────────────────────────── */

function JudgeRankings({ applicants }: { applicants: Applicant[] }) {
  const [sortJudge, setSortJudge] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filterType, setFilterType] = useState<string>("all");

  // Determine which judges have scores for these applicants
  const activeJudges = useMemo(() => {
    const judgeIds = new Set<string>();
    for (const a of applicants) {
      const votes = parsePanelVotes(a);
      for (const jid of Object.keys(votes)) {
        judgeIds.add(jid);
      }
    }
    // Return JUDGE_PERSONAS that have votes, maintaining order
    return JUDGE_PERSONAS.filter((j) => judgeIds.has(j.id));
  }, [applicants]);

  // Filter and sort applicants
  const displayApplicants = useMemo(() => {
    let list = applicants;

    // Filter by type
    if (filterType !== "all") {
      list = list.filter((a) => a.attendee_type === filterType);
    }

    // Sort
    if (sortJudge) {
      list = [...list].sort((a, b) => {
        const va = parsePanelVotes(a)[sortJudge]?.score || 0;
        const vb = parsePanelVotes(b)[sortJudge]?.score || 0;
        return sortDir === "desc" ? vb - va : va - vb;
      });
    } else {
      // Default: sort by overall ai_score desc
      list = [...list].sort((a, b) => getScore(b) - getScore(a));
    }

    return list;
  }, [applicants, filterType, sortJudge, sortDir]);

  const handleSortToggle = (judgeId: string) => {
    if (sortJudge === judgeId) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortJudge(judgeId);
      setSortDir("desc");
    }
  };

  // If no judges have scored yet, show empty state
  if (activeJudges.length === 0) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Judge rankings appear here after you run the AI Judge Panel analysis. Each judge scores candidates in their area of expertise.
        </p>
        <Card className="border-border/50">
          <CardContent className="py-16 text-center">
            <Trophy className="size-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-medium mb-1">No judge rankings yet</p>
            <p className="text-sm text-muted-foreground">
              Run the AI analysis with the Judge Panel enabled to populate rankings.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-muted-foreground">
          Each column shows a judge&apos;s score for each applicant. Click a column header to sort by that judge.
        </p>
        <div className="flex items-center gap-3">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">All Categories</SelectItem>
              {ATTENDEE_TYPES.map((t) => (
                <SelectItem key={t.key} value={t.key} className="text-xs">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => { setSortJudge(null); setSortDir("desc"); }}
          >
            Reset Sort
          </Button>
        </div>
      </div>

      {/* Rankings Table */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="text-xs font-semibold w-[40px]">#</TableHead>
              <TableHead className="text-xs font-semibold min-w-[180px]">Applicant</TableHead>
              <TableHead className="text-xs font-semibold w-[80px]">Type</TableHead>
              <TableHead
                className="text-xs font-semibold w-[70px] cursor-pointer hover:text-foreground transition-colors"
                onClick={() => { setSortJudge(null); setSortDir((d) => d === "desc" ? "asc" : "desc"); }}
              >
                <div className="flex items-center gap-1">
                  Score
                  <ArrowUpDown className="size-3" />
                </div>
              </TableHead>
              {activeJudges.map((judge) => (
                <TableHead
                  key={judge.id}
                  className="text-xs font-semibold w-[80px] cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleSortToggle(judge.id)}
                >
                  <div className="flex items-center gap-1" title={`${judge.name} - ${judge.specialty}`}>
                    <span>{judge.emoji}</span>
                    <span className="truncate max-w-[60px]">
                      {judge.name.replace("The ", "")}
                    </span>
                    {sortJudge === judge.id && (
                      <ArrowUpDown className="size-3 text-gold shrink-0" />
                    )}
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-xs font-semibold w-[90px]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayApplicants.map((a, i) => {
              const votes = parsePanelVotes(a);
              const overallScore = getScore(a);

              return (
                <TableRow key={a.applicant_id} className="group">
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {i + 1}
                  </TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{getName(a)}</p>
                      {getHeadline(a) && (
                        <p className="text-xs text-muted-foreground truncate max-w-[250px]">
                          {getHeadline(a)}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {a.attendee_type && (
                      <div className="flex items-center gap-1.5">
                        <div
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: getTypeColor(a.attendee_type) }}
                        />
                        <span className="text-xs text-muted-foreground truncate">
                          {a.attendee_type}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`text-sm font-semibold tabular-nums ${scoreColor(overallScore)}`}>
                      {overallScore > 0 ? overallScore : "-"}
                    </span>
                  </TableCell>
                  {activeJudges.map((judge) => {
                    const vote = votes[judge.id];
                    const score = vote?.score || 0;
                    return (
                      <TableCell key={judge.id}>
                        {vote ? (
                          <div className="flex items-center gap-1" title={vote.reasoning}>
                            <span className={`text-xs font-semibold tabular-nums ${scoreColor(score)}`}>
                              {score}
                            </span>
                            {vote.decision === "accept" && (
                              <Check className="size-3 text-emerald-400" />
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">-</span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${statusBadge(a.status)}`}
                    >
                      {statusLabel(a.status)}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Judge Legend */}
      <Card className="border-border/50">
        <CardContent className="py-4 px-4">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            Judge Panel
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeJudges.map((judge) => (
              <div key={judge.id} className="flex items-start gap-2">
                <span className="text-lg shrink-0">{judge.emoji}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold">{judge.name}</p>
                  <p className="text-[10px] text-muted-foreground">{judge.specialty}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Score Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="font-medium">Score colors:</span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-emerald-500" /> 70+ High
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-amber-500" /> 40-69 Medium
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-full bg-red-500" /> &lt;40 Low
        </span>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  PHASE 3: Committee Decision                                           */
/* ────────────────────────────────────────────────────────────────────── */

function CommitteeDecision({
  applicants,
  sessionId,
  session,
  onRefresh,
}: {
  applicants: Applicant[];
  sessionId: string;
  session: { name?: string; selection_preferences?: { venue_capacity?: number | null; attendee_mix?: Record<string, number> } } | null;
  onRefresh: () => Promise<void>;
}) {
  const existingPrefs = session?.selection_preferences;
  const [capacity, setCapacity] = useState<number>(existingPrefs?.venue_capacity || 100);
  const [mix, setMix] = useState<Record<string, number>>(() => {
    const defaults: Record<string, number> = {};
    for (const t of ATTENDEE_TYPES) {
      defaults[t.key] = existingPrefs?.attendee_mix?.[t.key] ?? Math.round(100 / ATTENDEE_TYPES.length);
    }
    return defaults;
  });
  const [decisions, setDecisions] = useState<Record<string, "accepted" | "rejected" | "waitlisted" | null>>({});
  const [reallocating, setReallocating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Compute target seats per category
  const targets = useMemo(() => {
    const result: Record<string, number> = {};
    for (const t of ATTENDEE_TYPES) {
      result[t.key] = Math.round((mix[t.key] || 0) / 100 * capacity);
    }
    return result;
  }, [mix, capacity]);

  // Sum of mix percentages
  const mixTotal = useMemo(() => Object.values(mix).reduce((s, v) => s + v, 0), [mix]);

  // Top candidates per type, sorted by score
  const rankedByType = useMemo(() => {
    const result: Record<string, Applicant[]> = {};
    for (const t of ATTENDEE_TYPES) {
      result[t.key] = applicants
        .filter((a) => a.attendee_type === t.key)
        .sort((a, b) => getScore(b) - getScore(a));
    }
    return result;
  }, [applicants]);

  // Current decision counts per type
  const acceptedCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of ATTENDEE_TYPES) {
      counts[t.key] = (rankedByType[t.key] || []).filter(
        (a) =>
          decisions[a.applicant_id] === "accepted" ||
          (!decisions[a.applicant_id] && a.status === "accepted")
      ).length;
    }
    return counts;
  }, [rankedByType, decisions]);

  const totalAccepted = useMemo(
    () => Object.values(acceptedCounts).reduce((s, v) => s + v, 0),
    [acceptedCounts]
  );

  // Toggle decision for an applicant
  const toggleDecision = (id: string, newStatus: "accepted" | "rejected") => {
    setDecisions((prev) => ({
      ...prev,
      [id]: prev[id] === newStatus ? null : newStatus,
    }));
  };

  // Auto-fill: accept top N per category based on mix targets
  const handleAutoFill = () => {
    const newDecisions: Record<string, "accepted" | "rejected" | "waitlisted" | null> = {};
    for (const t of ATTENDEE_TYPES) {
      const ranked = rankedByType[t.key] || [];
      const target = targets[t.key] || 0;
      ranked.forEach((a, idx) => {
        if (idx < target) {
          newDecisions[a.applicant_id] = "accepted";
        } else {
          newDecisions[a.applicant_id] = "waitlisted";
        }
      });
    }
    setDecisions(newDecisions);
    toast.success("Auto-filled decisions based on category targets");
  };

  // Save decisions to backend
  const handleSaveDecisions = async () => {
    setSaving(true);
    const toUpdate = Object.entries(decisions).filter(([, v]) => v !== null);
    try {
      // Batch update statuses
      const grouped: Record<string, string[]> = {};
      for (const [id, status] of toUpdate) {
        if (!status) continue;
        if (!grouped[status]) grouped[status] = [];
        grouped[status].push(id);
      }
      for (const [status, ids] of Object.entries(grouped)) {
        await api.batchUpdateStatus(ids, status);
      }
      toast.success(`Updated ${toUpdate.length} applicant statuses`);
      await onRefresh();
      setDecisions({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save decisions");
    } finally {
      setSaving(false);
    }
  };

  // Reallocate via backend
  const handleReallocate = async () => {
    setReallocating(true);
    try {
      const result = await api.reallocate({
        session_id: sessionId,
        venue_capacity: capacity,
        attendee_mix: mix,
      });
      toast.success(
        `Reallocated: ${result.accepted} accepted, ${result.waitlisted} waitlisted`
      );
      await onRefresh();
      setDecisions({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reallocation failed");
    } finally {
      setReallocating(false);
    }
  };

  const pendingChanges = Object.values(decisions).filter((v) => v !== null).length;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Set capacity targets and category mix to determine the optimal guest list.
        Auto-fill selects the top-ranked candidates in each category.
      </p>

      {/* Capacity & Mix Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Capacity */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="size-4 text-gold" />
              Venue Capacity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value) || 0)}
                className="h-9 w-24 text-center font-semibold"
                min={1}
              />
              <span className="text-sm text-muted-foreground">total seats</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className={totalAccepted > capacity ? "text-red-400 font-semibold" : "text-emerald-400 font-semibold"}>
                {totalAccepted}
              </span>
              <span className="text-muted-foreground">of {capacity} filled</span>
              {totalAccepted > capacity && (
                <Badge variant="outline" className="text-[10px] bg-red-500/15 text-red-400 border-red-500/30">
                  Over capacity
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mix percentages */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Category Mix</CardTitle>
              <span className={`text-xs font-mono ${mixTotal === 100 ? "text-emerald-400" : "text-amber-400"}`}>
                {mixTotal}%
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {ATTENDEE_TYPES.map((t) => (
              <div key={t.key} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-2 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="text-xs font-medium">{t.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {targets[t.key]} seats
                    </span>
                    <span className="text-xs font-semibold tabular-nums w-8 text-right">
                      {mix[t.key]}%
                    </span>
                  </div>
                </div>
                <Slider
                  value={[mix[t.key]]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={([val]) => setMix((prev) => ({ ...prev, [t.key]: val }))}
                  className="h-4"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={handleAutoFill} className="bg-gold text-gold-foreground hover:bg-gold/90">
          <Zap className="size-4 mr-2" />
          Auto-Fill
        </Button>
        <Button
          variant="outline"
          onClick={handleReallocate}
          disabled={reallocating}
          className="border-border/50"
        >
          {reallocating ? (
            <Loader2 className="size-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="size-4 mr-2" />
          )}
          Reallocate
        </Button>
        {pendingChanges > 0 && (
          <Button
            onClick={handleSaveDecisions}
            disabled={saving}
            className="bg-emerald-600 text-white hover:bg-emerald-500"
          >
            {saving ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Check className="size-4 mr-2" />
            )}
            Save {pendingChanges} Changes
          </Button>
        )}
      </div>

      {/* Per-category candidate lists */}
      <div className="space-y-4">
        {ATTENDEE_TYPES.map((t) => {
          const ranked = rankedByType[t.key] || [];
          if (ranked.length === 0) return null;
          const target = targets[t.key];
          const accepted = acceptedCounts[t.key];

          return (
            <Card key={t.key} className="border-border/50">
              <CardHeader className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-3 rounded-full" style={{ backgroundColor: t.color }} />
                    <CardTitle className="text-sm font-semibold">{t.label}</CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {ranked.length} candidates
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={accepted > target ? "text-red-400" : accepted === target ? "text-emerald-400" : "text-muted-foreground"}>
                      {accepted}/{target} seats filled
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                <div className="rounded-lg border border-border/30 divide-y divide-border/20">
                  {ranked.map((a, idx) => {
                    const score = getScore(a);
                    const localDecision = decisions[a.applicant_id];
                    const effectiveStatus = localDecision || a.status;
                    const isAccepted = effectiveStatus === "accepted";
                    const isRejected = effectiveStatus === "rejected";
                    const isAboveTarget = idx < target;

                    return (
                      <div
                        key={a.applicant_id}
                        className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                          isAboveTarget && !isRejected
                            ? "bg-emerald-500/5"
                            : ""
                        }`}
                      >
                        {/* Rank */}
                        <span className="text-xs font-mono text-muted-foreground w-6 text-right shrink-0">
                          {idx + 1}
                        </span>

                        {/* Score badge */}
                        <Badge
                          variant="outline"
                          className={`text-[10px] tabular-nums font-semibold shrink-0 ${scoreBg(score)}`}
                        >
                          {score > 0 ? score : "-"}
                        </Badge>

                        {/* Name + headline */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{getName(a)}</p>
                          {getHeadline(a) && (
                            <p className="text-xs text-muted-foreground truncate">
                              {getHeadline(a)}
                            </p>
                          )}
                        </div>

                        {/* Decision buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => toggleDecision(a.applicant_id, "accepted")}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                              isAccepted
                                ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                                : "text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10"
                            }`}
                          >
                            <Check className="size-3" />
                            Accept
                          </button>
                          <button
                            onClick={() => toggleDecision(a.applicant_id, "rejected")}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                              isRejected
                                ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                                : "text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                            }`}
                          >
                            <X className="size-3" />
                            Reject
                          </button>
                        </div>

                        {/* Current backend status */}
                        {localDecision && localDecision !== a.status && (
                          <Badge variant="outline" className="text-[10px] bg-gold/10 text-gold border-gold/30 shrink-0">
                            changed
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  MAIN PAGE                                                             */
/* ────────────────────────────────────────────────────────────────────── */

export default function ReviewPage() {
  const { sessionId, session, applicants, loading, error, refreshAll, refreshApplicants } = useEvent();

  // Recategorize handler for Phase 1
  const handleRecategorize = useCallback(
    async (applicantId: string, newType: string) => {
      try {
        await api.updateApplicant(applicantId, {
          extra: { attendee_type: newType, user_override_attendee_type: true },
        });
        toast.success("Category updated");
        await refreshApplicants();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update category");
      }
    },
    [refreshApplicants]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-gold" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm text-destructive mb-4">{error}</p>
        <Button variant="outline" onClick={() => refreshAll()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Review Committee
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {session?.name || "Event"} — {applicants.length} applicants
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="categories">
        <TabsList variant="line" className="border-b border-border/50">
          <TabsTrigger value="categories" className="text-sm">
            <Users className="size-4 mr-1.5" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="rankings" className="text-sm">
            <Trophy className="size-4 mr-1.5" />
            Rankings
          </TabsTrigger>
          <TabsTrigger value="committee" className="text-sm">
            <Gavel className="size-4 mr-1.5" />
            Committee
          </TabsTrigger>
        </TabsList>

        <TabsContent value="categories" className="pt-4">
          <CategoryVerification
            applicants={applicants}
            onRecategorize={handleRecategorize}
          />
        </TabsContent>

        <TabsContent value="rankings" className="pt-4">
          <JudgeRankings applicants={applicants} />
        </TabsContent>

        <TabsContent value="committee" className="pt-4">
          <CommitteeDecision
            applicants={applicants}
            sessionId={sessionId}
            session={session}
            onRefresh={refreshAll}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
