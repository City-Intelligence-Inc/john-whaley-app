"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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
} from "lucide-react";
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
import { useEvent } from "@/components/event-provider";
import { CSVUploader } from "@/components/csv-uploader";
import { api } from "@/lib/api";
import type { Applicant } from "@/lib/api";
import { ATTENDEE_TYPES } from "@/lib/constants";

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
  return typeof s === "string" ? s : String(s);
}

function getTypeColor(key: string): string {
  return ATTENDEE_TYPES.find((t) => t.key === key)?.color || "#6b7280";
}

function getTypeLabel(key: string): string {
  return ATTENDEE_TYPES.find((t) => t.key === key)?.label || key;
}

/* ── Mix Panel ── */
function MixPanel({ applicants, onApply }: {
  applicants: Applicant[];
  onApply: (acceptIds: string[], waitlistIds: string[]) => Promise<void>;
}) {
  const [quotas, setQuotas] = useState<Record<string, number>>({});
  const [applying, setApplying] = useState(false);

  const byType = useMemo(() => {
    const groups: Record<string, Applicant[]> = {};
    for (const t of ATTENDEE_TYPES) groups[t.key] = [];
    for (const a of applicants) {
      const t = a.attendee_type || "other";
      if (!groups[t]) groups[t] = [];
      groups[t].push(a);
    }
    // Sort each group by rank if available, else by name
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        const ra = Number(a.rank || 999);
        const rb = Number(b.rank || 999);
        if (ra !== rb) return ra - rb;
        return getName(a).localeCompare(getName(b));
      });
    }
    return groups;
  }, [applicants]);

  const getQuota = (key: string) => quotas[key] ?? (byType[key] || []).filter((a) => a.status === "accepted").length;
  const totalSelected = ATTENDEE_TYPES.reduce((sum, t) => sum + Math.min(getQuota(t.key), (byType[t.key] || []).length), 0);

  const handleApply = async () => {
    setApplying(true);
    const acceptIds: string[] = [];
    const waitlistIds: string[] = [];
    for (const t of ATTENDEE_TYPES) {
      const items = byType[t.key] || [];
      const target = getQuota(t.key);
      items.forEach((a, i) => {
        if (i < target && a.status !== "accepted") acceptIds.push(a.applicant_id);
        if (i >= target && a.status === "accepted") waitlistIds.push(a.applicant_id);
      });
    }
    await onApply(acceptIds, waitlistIds);
    setApplying(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Category Mix</h2>
          <p className="text-sm text-muted-foreground">Set how many from each category. Top-ranked people get accepted first.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tabular-nums">{totalSelected} total</span>
          <Button size="sm" onClick={handleApply} disabled={applying}>
            {applying ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Check className="size-4 mr-2" />}
            Apply Mix
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {ATTENDEE_TYPES.map((t) => {
          const items = byType[t.key] || [];
          if (items.length === 0) return null;
          const quota = getQuota(t.key);
          const currentAccepted = items.filter((a) => a.status === "accepted").length;

          return (
            <Card key={t.key}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  {/* Category info */}
                  <div className="flex items-center gap-2 w-32 shrink-0">
                    <span className="size-3 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="text-sm font-medium">{t.label}</span>
                    <span className="text-xs text-muted-foreground">({items.length})</span>
                  </div>

                  {/* Slider */}
                  <div className="flex-1">
                    <Slider
                      value={[quota]}
                      min={0}
                      max={items.length}
                      step={1}
                      onValueChange={([val]) => setQuotas((prev) => ({ ...prev, [t.key]: val }))}
                    />
                  </div>

                  {/* Count */}
                  <div className="flex items-center gap-1 w-20 justify-end shrink-0">
                    <button onClick={() => setQuotas((p) => ({ ...p, [t.key]: Math.max(0, quota - 1) }))}
                      className="size-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted">-</button>
                    <span className="text-sm font-bold tabular-nums w-8 text-center">{quota}</span>
                    <button onClick={() => setQuotas((p) => ({ ...p, [t.key]: Math.min(items.length, quota + 1) }))}
                      className="size-6 rounded flex items-center justify-center text-muted-foreground hover:bg-muted">+</button>
                  </div>
                </div>

                {/* Preview of top picks */}
                {quota > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {items.slice(0, Math.min(quota, 8)).map((a) => (
                      <span key={a.applicant_id} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full">
                        {getPhoto(a) ? (
                          <img src={getPhoto(a)} alt="" className="size-4 rounded-full object-cover" />
                        ) : null}
                        {getName(a)}
                      </span>
                    ))}
                    {quota > 8 && <span className="text-xs text-muted-foreground px-2 py-0.5">+{quota - 8} more</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
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
  const [showImport, setShowImport] = useState(false);
  const [sortField, setSortField] = useState<"name" | "status" | "type" | "score">("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [copiedEmails, setCopiedEmails] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [cardIndex, setCardIndex] = useState(0);
  const [ranking, setRanking] = useState(false);

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
  }, [applicants, statusFilter, search, sortField, sortDir]);

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
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate">{session?.name || "Event"}</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{total} guests</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={handleRankAll} disabled={ranking || total === 0}>
            {ranking ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Brain className="size-3.5 mr-1.5" />}
            <span className="hidden sm:inline">{ranking ? "Ranking..." : "Rank All"}</span>
            <span className="sm:hidden">{ranking ? "..." : "Rank"}</span>
          </Button>
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

      <Tabs defaultValue="guests">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="guests">Guests</TabsTrigger>
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
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="min-w-[200px]">
                      <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-foreground">
                        Guest <ArrowUpDown className="size-3" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[120px] hidden md:table-cell">
                      <button onClick={() => toggleSort("type")} className="flex items-center gap-1 hover:text-foreground">
                        Category <ArrowUpDown className="size-3" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[90px]">
                      <button onClick={() => toggleSort("status")} className="flex items-center gap-1 hover:text-foreground">
                        Status <ArrowUpDown className="size-3" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a, idx) => {
                    const photo = getPhoto(a);
                    const headline = getHeadline(a);
                    const summary = getSummary(a);
                    const rank = getRank(a);
                    return (
                      <TableRow
                        key={a.applicant_id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedId(a.applicant_id)}
                      >
                        <TableCell className="text-center text-xs font-mono text-muted-foreground" title={rank ? `Global #${rank.rank}/${rank.total} | ${a.attendee_type || "?"} #${rank.catRank}/${rank.catTotal} | Score: ${rank.score}` : ""}>
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
                              <p className="font-medium text-sm truncate">{getName(a)}</p>
                              {headline && <p className="text-xs text-muted-foreground truncate">{headline}</p>}
                              {summary && <p className="text-[10px] text-muted-foreground/60 truncate mt-0.5">{String(summary).split("\n")[0]}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {a.attendee_type && (
                            <span className="text-xs font-medium truncate block max-w-[110px]" style={{ color: getTypeColor(a.attendee_type) }}>
                              {getTypeLabel(a.attendee_type)}
                            </span>
                          )}
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
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
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

        {/* Action buttons */}
        <div className="border-t p-4 flex items-center gap-2">
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
          <Button size="icon" variant="ghost" className="shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onBlacklist(current)} title="Blacklist & remove">
            <ShieldBan className="size-4" />
          </Button>
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="sm" disabled={index === 0}
          onClick={() => onIndexChange(index - 1)}>
          <ChevronLeft className="size-4 mr-1" />Prev
        </Button>
        <span className="text-xs text-muted-foreground">
          <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px] font-mono">A</kbd> prev
          <span className="mx-2">|</span>
          <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px] font-mono">D</kbd> next
          <span className="mx-2">|</span>
          <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px] font-mono">1</kbd>
          <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px] font-mono mx-0.5">2</kbd>
          <kbd className="px-1 py-0.5 rounded border bg-muted text-[10px] font-mono">3</kbd> actions
        </span>
        <Button variant="outline" size="sm" disabled={index >= applicants.length - 1}
          onClick={() => onIndexChange(index + 1)}>
          Next<ChevronRight className="size-4 ml-1" />
        </Button>
      </div>
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
