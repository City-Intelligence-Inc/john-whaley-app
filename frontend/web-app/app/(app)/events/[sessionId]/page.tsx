"use client";

import { useState, useCallback, useMemo } from "react";
import {
  Upload,
  Linkedin,
  Loader2,
  Brain,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  CreditCard,
  Search,
  X,
  ExternalLink,
  Mail,
  MapPin,
  Building2,
  GraduationCap,
  Sparkles,
  Minus,
  Plus,
  Zap,
  Check,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useEvent } from "@/components/event-provider";
import { ProfileSwipeView } from "@/components/profile-swipe-view";
import { ApplicantDetailSheet } from "@/components/applicant-detail-sheet";
import { CSVUploader } from "@/components/csv-uploader";
import { api } from "@/lib/api";
import type { Applicant } from "@/lib/api";
import { ATTENDEE_TYPES } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

/* ── helpers ── */

function getName(a: Applicant): string {
  return a.name || (a[`linkedin_name`] as string) || a.email || "No name";
}

function statusColor(s: string) {
  switch (s) {
    case "accepted": return "text-emerald-500";
    case "rejected": return "text-red-500";
    case "waitlisted": return "text-amber-500";
    default: return "text-muted-foreground";
  }
}

function statusLabel(s: string) {
  switch (s) {
    case "accepted": return "Going";
    case "rejected": return "Not Going";
    case "waitlisted": return "Waitlisted";
    default: return "Pending";
  }
}

/* ── helpers for analysis tab ── */

function getScore(a: Applicant): number {
  if (!a.ai_score) return 0;
  const n = Number(a.ai_score);
  return isNaN(n) ? 0 : n;
}

function getTypeColor(key: string): string {
  return ATTENDEE_TYPES.find((t) => t.key === key)?.color || "#6b7280";
}

function getTypeLabel(key: string): string {
  return ATTENDEE_TYPES.find((t) => t.key === key)?.label || key;
}

function getRejectionReason(a: Applicant): string {
  if (a.status === "accepted") return "";
  if (a.status === "rejected") return "Rejected";
  if (a.status === "waitlisted") return "Waitlisted";
  if (!a.ai_reasoning) return "Not analyzed";
  return "Pending";
}

/* ── Analysis Results Tab ── */

function AnalysisResultsTab({
  applicants,
  sessionId,
  onStatusChange,
  onRefresh,
  onRunAnalysis,
}: {
  applicants: Applicant[];
  sessionId: string;
  onStatusChange: (id: string, status: string) => void;
  onRefresh: () => Promise<void>;
  onRunAnalysis: () => void;
}) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [quotas, setQuotas] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  // Group by category
  const grouped = useMemo(() => {
    const groups: Record<string, Applicant[]> = {};
    for (const t of ATTENDEE_TYPES) groups[t.key] = [];
    groups["unclassified"] = [];
    for (const a of applicants) {
      const type = a.attendee_type || "unclassified";
      if (!groups[type]) groups[type] = [];
      groups[type].push(a);
    }
    return groups;
  }, [applicants]);

  // Initialize quotas from current accepted counts
  const currentAccepted = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [key, items] of Object.entries(grouped)) {
      counts[key] = items.filter((a) => a.status === "accepted").length;
    }
    return counts;
  }, [grouped]);

  // Keep dataset order but put accepted first
  const sortedGroups = useMemo(() => {
    const result: Record<string, Applicant[]> = {};
    for (const [key, items] of Object.entries(grouped)) {
      result[key] = [...items].sort((a, b) => {
        const aAccepted = a.status === "accepted" ? 0 : 1;
        const bAccepted = b.status === "accepted" ? 0 : 1;
        return aAccepted - bAccepted;
      });
    }
    return result;
  }, [grouped]);

  const totalAccepted = applicants.filter((a) => a.status === "accepted").length;
  const totalAnalyzed = applicants.filter((a) => a.ai_score).length;
  const hasAnalysis = totalAnalyzed > 0;

  // Get effective quota (user-set or current accepted count)
  const getQuota = (key: string) => quotas[key] ?? currentAccepted[key] ?? 0;

  // Auto-apply quotas: accept top N by score in each category
  const handleAutoApply = useCallback(async () => {
    setSaving(true);
    try {
      const toAccept: string[] = [];
      const toWaitlist: string[] = [];
      for (const [key, items] of Object.entries(sortedGroups)) {
        const target = getQuota(key);
        items.forEach((a, idx) => {
          if (idx < target) {
            if (a.status !== "accepted") toAccept.push(a.applicant_id);
          } else {
            if (a.status === "accepted") toWaitlist.push(a.applicant_id);
          }
        });
      }
      if (toAccept.length > 0) await api.batchUpdateStatus(toAccept, "accepted");
      if (toWaitlist.length > 0) await api.batchUpdateStatus(toWaitlist, "waitlisted");
      toast.success(`Updated: ${toAccept.length} accepted, ${toWaitlist.length} waitlisted`);
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply quotas");
    } finally {
      setSaving(false);
    }
  }, [sortedGroups, quotas, currentAccepted, onRefresh]);

  const categoryOrder = [...ATTENDEE_TYPES.map((t) => t.key), "unclassified"];

  return (
    <div className="space-y-6">
      {/* Run analysis button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {hasAnalysis
              ? `${totalAnalyzed} of ${applicants.length} guests analyzed. ${totalAccepted} accepted.`
              : "Run the AI judge panel to score and classify all guests."}
          </p>
        </div>
        <Button
          onClick={onRunAnalysis}
          disabled={applicants.length === 0}
          variant={hasAnalysis ? "outline" : "default"}
          className={hasAnalysis ? "border-border/50" : "bg-gold text-gold-foreground hover:bg-gold/90"}
        >
          <Brain className="size-4 mr-2" />
          {hasAnalysis ? "Re-Run Analysis" : "Run Analysis"}
        </Button>
      </div>

      {hasAnalysis && (
        <>
          {/* Category Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {categoryOrder.map((key) => {
              const items = grouped[key] || [];
              if (items.length === 0) return null;
              const accepted = items.filter((a) => a.status === "accepted").length;
              const color = key === "unclassified" ? "#6b7280" : getTypeColor(key);
              const label = key === "unclassified" ? "Unclassified" : getTypeLabel(key);
              const isExpanded = expandedCategory === key;

              return (
                <button
                  key={key}
                  onClick={() => setExpandedCategory(isExpanded ? null : key)}
                  className={`rounded-xl border p-4 text-left transition-all hover:border-border ${
                    isExpanded
                      ? "border-border bg-card ring-1"
                      : "border-border/50 bg-card/50"
                  }`}
                  style={isExpanded ? { borderColor: color } : undefined}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="size-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">{label}</span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold" style={{ color }}>{accepted}</span>
                    <span className="text-sm text-muted-foreground">/ {items.length}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {accepted === 0 ? "none accepted" : `${accepted} accepted`}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Quota Controls */}
          <Card className="border-border/50 bg-card/50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="size-4 text-gold" />
                  Category Quotas
                </CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Total: <span className="font-semibold text-foreground">{Object.entries(grouped).reduce((sum, [key, items]) => sum + Math.min(getQuota(key), items.length), 0)}</span>
                  </span>
                  <Button
                    size="sm"
                    className="h-7 text-xs bg-gold text-gold-foreground hover:bg-gold/90"
                    onClick={handleAutoApply}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Zap className="size-3 mr-1" />}
                    Apply Quotas
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {categoryOrder.map((key) => {
                const items = grouped[key] || [];
                if (items.length === 0) return null;
                const color = key === "unclassified" ? "#6b7280" : getTypeColor(key);
                const label = key === "unclassified" ? "Unclassified" : getTypeLabel(key);
                const quota = getQuota(key);
                const accepted = currentAccepted[key] || 0;

                return (
                  <div key={key} className="flex items-center gap-4">
                    <div className="flex items-center gap-2 w-40 shrink-0">
                      <div className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="text-xs font-medium truncate">{label}</span>
                      <span className="text-[10px] text-muted-foreground">({items.length})</span>
                    </div>
                    <div className="flex-1">
                      <Slider
                        value={[quota]}
                        min={0}
                        max={items.length}
                        step={1}
                        onValueChange={([val]) => setQuotas((prev) => ({ ...prev, [key]: val }))}
                        className="h-4"
                      />
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setQuotas((prev) => ({ ...prev, [key]: Math.max(0, quota - 1) }))}
                        className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="text-sm font-semibold tabular-nums w-8 text-center">{quota}</span>
                      <button
                        onClick={() => setQuotas((prev) => ({ ...prev, [key]: Math.min(items.length, quota + 1) }))}
                        className="size-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                    {quota !== accepted && (
                      <Badge variant="outline" className="text-[10px] bg-gold/10 text-gold border-gold/30 shrink-0">
                        was {accepted}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Expanded Category Detail */}
          {expandedCategory && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="size-3 rounded-full"
                      style={{ backgroundColor: expandedCategory === "unclassified" ? "#6b7280" : getTypeColor(expandedCategory) }}
                    />
                    <CardTitle className="text-sm font-semibold">
                      {expandedCategory === "unclassified" ? "Unclassified" : getTypeLabel(expandedCategory)}
                    </CardTitle>
                    <Badge variant="secondary" className="text-xs">
                      {(grouped[expandedCategory] || []).length} total
                    </Badge>
                  </div>
                  <button
                    onClick={() => setExpandedCategory(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="rounded-lg border border-border/30 divide-y divide-border/20">
                  {(sortedGroups[expandedCategory] || []).map((a, idx) => {
                    const isAccepted = a.status === "accepted";
                    const isRejected = a.status === "rejected";
                    const isWaitlisted = a.status === "waitlisted";
                    const notIn = !isAccepted;
                    const photo = (a[`linkedin_image`] as string) || (a[`photo_url`] as string) || "";
                    const headline = (a[`linkedin_headline`] as string) || a.title || "";
                    const rejectionReason = getRejectionReason(a);

                    return (
                      <div
                        key={a.applicant_id}
                        className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                          notIn ? "opacity-50" : "hover:bg-muted/30"
                        }`}
                      >
                        {/* Rank */}
                        <span className="text-xs font-mono text-muted-foreground w-6 text-right shrink-0">
                          {idx + 1}
                        </span>

                        {/* Photo */}
                        {photo ? (
                          <img src={photo} alt="" className="size-8 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground">
                            {getName(a).charAt(0).toUpperCase()}
                          </div>
                        )}

                        {/* Name + headline */}
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm font-medium truncate block ${notIn ? "text-muted-foreground" : ""}`}>
                            {getName(a)}
                          </span>
                          {headline && (
                            <p className={`text-xs truncate ${notIn ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
                              {headline}
                            </p>
                          )}
                        </div>

                        {/* Status / rejection reason */}
                        <div className="flex items-center gap-2 shrink-0">
                          {isAccepted && (
                            <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                              Accepted
                            </Badge>
                          )}
                          {isRejected && (
                            <span className="text-[10px] text-muted-foreground/60 max-w-[140px] truncate" title={rejectionReason}>
                              {rejectionReason}
                            </span>
                          )}
                          {isWaitlisted && (
                            <span className="text-[10px] text-amber-500/60">Waitlisted</span>
                          )}
                          {a.status === "pending" && (
                            <span className="text-[10px] text-muted-foreground/40">Pending</span>
                          )}
                        </div>

                        {/* Quick accept/reject */}
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onStatusChange(a.applicant_id, isAccepted ? "waitlisted" : "accepted")}
                            className={`size-6 rounded flex items-center justify-center transition-colors ${
                              isAccepted
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "text-muted-foreground/40 hover:text-emerald-400 hover:bg-emerald-500/10"
                            }`}
                            title={isAccepted ? "Remove" : "Accept"}
                          >
                            <Check className="size-3" />
                          </button>
                          <button
                            onClick={() => onStatusChange(a.applicant_id, isRejected ? "waitlisted" : "rejected")}
                            className={`size-6 rounded flex items-center justify-center transition-colors ${
                              isRejected
                                ? "bg-red-500/20 text-red-400"
                                : "text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10"
                            }`}
                            title={isRejected ? "Un-reject" : "Reject"}
                          >
                            <X className="size-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

/* ── page ── */

export default function EventWorkspacePage() {
  const router = useRouter();
  const {
    sessionId, session, applicants, stats, loading, error,
    refreshApplicants, refreshStats, refreshAll,
  } = useEvent();

  const [tab, setTab] = useState<"guests" | "review" | "analysis">("guests");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("all");

  // Filter applicants by category for the review tab
  const categoryFilteredApplicants = useMemo(() => {
    if (categoryFilter === "all") return applicants;
    if (categoryFilter === "unclassified") return applicants.filter((a) => !a.attendee_type);
    return applicants.filter((a) => (a.attendee_type || "other") === categoryFilter);
  }, [applicants, categoryFilter]);

  // LinkedIn enrichment
  const [liAtCookie, setLiAtCookie] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("li_at_cookie") || "" : ""
  );
  const [enriching, setEnriching] = useState(false);
  const [showLiAtPopover, setShowLiAtPopover] = useState(false);

  const selectedApplicant = useMemo(
    () => selectedApplicantId ? applicants.find((a) => a.applicant_id === selectedApplicantId) || null : null,
    [selectedApplicantId, applicants]
  );

  /* ── counts ── */
  const accepted = applicants.filter((a) => a.status === "accepted").length;
  const pending = applicants.filter((a) => a.status === "pending").length;
  const rejected = applicants.filter((a) => a.status === "rejected").length;
  const waitlisted = applicants.filter((a) => a.status === "waitlisted").length;
  const total = applicants.length;
  const barTotal = total || 1;

  /* ── handlers ── */
  const handleStatusChange = useCallback(async (id: string, status: string) => {
    try {
      await api.updateApplicant(id, { status });
      await Promise.all([refreshApplicants(), refreshStats()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  }, [refreshApplicants, refreshStats]);

  const handleUploadSuccess = useCallback((_count: number) => {
    refreshAll();
    setShowImportDialog(false);
    toast.success(`Imported ${_count} guests`);
  }, [refreshAll]);

  const handleEnrichLinkedIn = useCallback(async () => {
    if (liAtCookie.trim()) localStorage.setItem("li_at_cookie", liAtCookie);
    setEnriching(true);
    setShowLiAtPopover(false);
    const toastId = toast.loading("Starting LinkedIn enrichment...");
    try {
      await api.enrichLinkedInStream(
        { session_id: sessionId, li_at: liAtCookie.trim() || undefined },
        {
          onStart: (data) => toast.loading(`Scraping ${data.total} profiles...`, { id: toastId }),
          onProgress: (data) => toast.loading(`[${data.completed}/${data.total}] ${data.name || "..."}`, { id: toastId }),
          onError: (data) => toast.loading(`[${data.completed}/${data.total}] Error: ${data.name || ""}`, { id: toastId }),
          onComplete: (data) => { toast.success(`Done: ${data.enriched} enriched`, { id: toastId }); refreshApplicants(); },
        }
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enrichment failed", { id: toastId });
    } finally {
      setEnriching(false);
    }
  }, [sessionId, liAtCookie, refreshApplicants]);

  const handleExportCSV = useCallback(() => {
    if (applicants.length === 0) return;
    const skip = new Set(["applicant_id", "session_id"]);
    const keys = new Set<string>();
    for (const a of applicants) for (const k of Object.keys(a)) if (!skip.has(k)) keys.add(k);
    const pri = ["name", "email", "status", "ai_score", "ai_reasoning", "company", "title", "location", "linkedin_url"];
    const headers = [...pri.filter((k) => keys.has(k)), ...[...keys].filter((k) => !pri.includes(k)).sort()];
    const esc = (v: unknown) => { const s = String(v ?? ""); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [headers.join(","), ...applicants.map((a) => headers.map((h) => esc(a[h])).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(session?.name || "event").replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [applicants, session]);

  /* ── filtered guest list ── */
  const filtered = useMemo(() => {
    let list = applicants;
    if (statusFilter !== "all") list = list.filter((a) => a.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => {
        const s = [a.name, a.email, a.company, a.title, a[`linkedin_headline`] as string].filter(Boolean).join(" ").toLowerCase();
        return s.includes(q);
      });
    }
    return list.sort((a, b) => (getName(a)).localeCompare(getName(b)));
  }, [applicants, statusFilter, search]);

  /* ── loading / error ── */
  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-gold" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center py-20"><p className="text-sm text-destructive mb-4">{error}</p><Button variant="outline" onClick={() => refreshAll()}>Retry</Button></div>;

  return (
    <div className="space-y-6">
      {/* ── Event Title ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {session?.name || "Event"}
        </h1>
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-6 border-b border-border/50">
        {(["guests", "review", "analysis"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-gold text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "guests" ? "Guests" : t === "review" ? "Review" : "Analysis"}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════ */}
      {/*  GUESTS TAB                                  */}
      {/* ════════════════════════════════════════════ */}
      {tab === "guests" && (
        <div className="space-y-6">
          {/* At a Glance */}
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">At a Glance</h2>

            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold text-emerald-500">{accepted}</span>
              <span className="text-lg text-muted-foreground">Going</span>
            </div>

            {/* Status bar */}
            <div className="h-3 rounded-full overflow-hidden flex bg-muted">
              {accepted > 0 && <div className="bg-emerald-500 transition-all" style={{ width: `${(accepted / barTotal) * 100}%` }} />}
              {waitlisted > 0 && <div className="bg-amber-500 transition-all" style={{ width: `${(waitlisted / barTotal) * 100}%` }} />}
              {pending > 0 && <div className="bg-blue-500 transition-all" style={{ width: `${(pending / barTotal) * 100}%` }} />}
              {rejected > 0 && <div className="bg-red-500 transition-all" style={{ width: `${(rejected / barTotal) * 100}%` }} />}
            </div>

            <div className="flex items-center gap-4 text-sm flex-wrap">
              {pending > 0 && <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-blue-500" />{pending} Pending</span>}
              {waitlisted > 0 && <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-500" />{waitlisted} Waitlisted</span>}
              {rejected > 0 && <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-red-500" />{rejected} Not Going</span>}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button onClick={() => setShowImportDialog(true)} className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Upload className="size-4 mr-2" />Import Guests
            </Button>
            <Button variant="outline" onClick={() => setTab("review")} className="border-border/50">
              <CreditCard className="size-4 mr-2" />Review Guests
            </Button>
            <Popover open={showLiAtPopover} onOpenChange={setShowLiAtPopover}>
              <PopoverTrigger asChild>
                <Button variant="outline" disabled={enriching || total === 0} className="border-border/50">
                  {enriching ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Linkedin className="size-4 mr-2" />}
                  Enrich LinkedIn
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="start">
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs font-medium">li_at Cookie (optional)</Label>
                    <Input type="password" value={liAtCookie} onChange={(e) => setLiAtCookie(e.target.value)}
                      placeholder="AQEDAQNh..." className="h-8 text-xs font-mono mt-1" />
                  </div>
                  <Button onClick={handleEnrichLinkedIn} disabled={enriching} className="w-full bg-gold text-gold-foreground hover:bg-gold/90" size="sm">
                    {enriching ? "Enriching..." : "Start Enrichment"}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            <Button variant="outline" disabled={total === 0} onClick={handleExportCSV} className="border-border/50">
              <Download className="size-4 mr-2" />Export
            </Button>
          </div>

          {/* Guest List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Guest List</h2>
              <span className="text-xs text-muted-foreground">{filtered.length} guests</span>
            </div>

            {/* Search + filter */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="pl-9 h-9" />
                {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="size-4" /></button>}
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-border/50 bg-background px-3 text-sm text-foreground"
              >
                <option value="all">All Guests</option>
                <option value="accepted">Going</option>
                <option value="pending">Pending</option>
                <option value="waitlisted">Waitlisted</option>
                <option value="rejected">Not Going</option>
              </select>
            </div>

            {/* Empty state */}
            {total === 0 && (
              <div className="text-center py-16">
                <Users className="size-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-lg font-medium mb-1">No guests yet</p>
                <p className="text-sm text-muted-foreground mb-4">Import a CSV to get started</p>
                <Button onClick={() => setShowImportDialog(true)} className="bg-gold text-gold-foreground hover:bg-gold/90">
                  <Upload className="size-4 mr-2" />Import Guests
                </Button>
              </div>
            )}

            {/* Guest cards */}
            {total > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((a) => {
                  const photo = (a[`linkedin_image`] as string) || (a[`photo_url`] as string) || "";
                  const headline = (a[`linkedin_headline`] as string) || a.title || "";
                  const about = (a[`linkedin_about`] as string) || "";
                  const company = a.company || (a[`linkedin_company`] as string) || "";
                  const location = a.location || (a[`linkedin_location`] as string) || "";
                  const education = (a[`linkedin_education`] as string) || "";
                  const isPending = a.status === "pending";
                  const name = getName(a);

                  return (
                    <div
                      key={a.applicant_id}
                      className="rounded-xl border border-border/50 bg-card/50 hover:border-border transition-all overflow-hidden cursor-pointer group"
                      onClick={() => setSelectedApplicantId(a.applicant_id)}
                    >
                      {/* Card header with photo */}
                      <div className="p-4 pb-3">
                        <div className="flex items-start gap-3">
                          {photo ? (
                            <img src={photo} alt="" className="size-14 rounded-xl object-cover shrink-0 ring-1 ring-border/50" />
                          ) : (
                            <div className="size-14 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center shrink-0 text-xl font-bold text-muted-foreground/50">
                              {name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-semibold truncate group-hover:text-gold transition-colors">{name}</h3>
                            {headline && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">{headline}</p>}
                          </div>
                        </div>
                      </div>

                      {/* Info chips */}
                      {(company || location || education) && (
                        <div className="px-4 pb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          {company && <span className="flex items-center gap-1"><Building2 className="size-3" />{company}</span>}
                          {location && <span className="flex items-center gap-1"><MapPin className="size-3" />{location}</span>}
                          {education && <span className="flex items-center gap-1"><GraduationCap className="size-3" /><span className="truncate max-w-[150px]">{education.split("\n")[0]}</span></span>}
                        </div>
                      )}

                      {/* About snippet */}
                      {about && (
                        <div className="px-4 pb-2">
                          <p className="text-[11px] text-muted-foreground/70 line-clamp-2 leading-relaxed">{about}</p>
                        </div>
                      )}

                      {/* AI reasoning — show first judge's reasoning only */}
                      {a.ai_reasoning && (
                        <div className="px-4 pb-2">
                          <div className="rounded-lg bg-gold/5 border border-gold/10 px-2.5 py-1.5">
                            <p className="text-[11px] text-muted-foreground line-clamp-2 flex items-start gap-1.5">
                              <Sparkles className="size-3 mt-0.5 shrink-0 text-gold" />
                              {a.ai_reasoning.includes(" | ")
                                ? a.ai_reasoning.split(" | ")[0].replace(/^.*?\]:\s*/, "")
                                : a.ai_reasoning}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Footer: status + actions */}
                      <div className="px-4 py-2.5 border-t border-border/30 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          {a.attendee_type && (
                            <Badge variant="outline" className="text-[10px] h-5">{a.attendee_type_detail || a.attendee_type}</Badge>
                          )}
                          {a.linkedin_url && (
                            <a href={a.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400">
                              <Linkedin className="size-3.5" />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isPending ? (
                            <>
                              <button onClick={() => handleStatusChange(a.applicant_id, "accepted")}
                                className="h-7 px-2.5 rounded-md text-[11px] font-medium text-emerald-500 hover:bg-emerald-500/10 flex items-center gap-1 transition-colors">
                                <CheckCircle2 className="size-3" />Approve
                              </button>
                              <button onClick={() => handleStatusChange(a.applicant_id, "rejected")}
                                className="h-7 px-2.5 rounded-md text-[11px] font-medium text-red-500 hover:bg-red-500/10 flex items-center gap-1 transition-colors">
                                <XCircle className="size-3" />Decline
                              </button>
                            </>
                          ) : (
                            <span className={`text-xs font-medium flex items-center gap-1 ${statusColor(a.status)}`}>
                              <span className={`size-1.5 rounded-full ${a.status === "accepted" ? "bg-emerald-500" : a.status === "rejected" ? "bg-red-500" : a.status === "waitlisted" ? "bg-amber-500" : "bg-blue-500"}`} />
                              {statusLabel(a.status)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/*  REVIEW TAB                                  */}
      {/* ════════════════════════════════════════════ */}
      {tab === "review" && (
        <div className="space-y-4">
          {/* Category selector */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Select a category to review:</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  categoryFilter === "all"
                    ? "bg-gold/15 text-gold border border-gold/30"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({applicants.length})
              </button>
              {ATTENDEE_TYPES.map((t) => {
                const count = applicants.filter((a) => (a.attendee_type || "other") === t.key).length;
                if (count === 0) return null;
                return (
                  <button
                    key={t.key}
                    onClick={() => setCategoryFilter(t.key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      categoryFilter === t.key
                        ? "bg-gold/15 text-gold border border-gold/30"
                        : "bg-card border border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="inline-block size-2 rounded-full mr-1.5" style={{ backgroundColor: t.color }} />
                    {t.label} ({count})
                  </button>
                );
              })}
              {(() => {
                const unclassified = applicants.filter((a) => !a.attendee_type).length;
                return unclassified > 0 ? (
                  <button
                    onClick={() => setCategoryFilter("unclassified")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      categoryFilter === "unclassified"
                        ? "bg-gold/15 text-gold border border-gold/30"
                        : "bg-card border border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Unclassified ({unclassified})
                  </button>
                ) : null;
              })()}
            </div>
          </div>

          <ProfileSwipeView
            applicants={categoryFilteredApplicants}
            statusFilter="all"
            sessionId={sessionId}
            onStatusChange={handleStatusChange}
            onSelectApplicant={setSelectedApplicantId}
          />
        </div>
      )}

      {/* ════════════════════════════════════════════ */}
      {/*  ANALYSIS TAB                                */}
      {/* ════════════════════════════════════════════ */}
      {tab === "analysis" && (
        <AnalysisResultsTab
          applicants={applicants}
          sessionId={sessionId}
          onStatusChange={handleStatusChange}
          onRefresh={refreshAll}
          onRunAnalysis={() => router.push(`/events/${sessionId}/analyze`)}
        />
      )}

      {/* ── Detail Sheet ── */}
      {selectedApplicant && (
        <ApplicantDetailSheet
          applicant={selectedApplicant}
          onStatusChange={(id, status) => handleStatusChange(id, status!)}
          onClose={() => setSelectedApplicantId(null)}
        />
      )}

      {/* ── Import Dialog ── */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Guests</DialogTitle>
            <DialogDescription>
              Upload a CSV export from Luma or any spreadsheet with guest data.
            </DialogDescription>
          </DialogHeader>
          <CSVUploader onUploadSuccess={handleUploadSuccess} sessionId={sessionId} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
