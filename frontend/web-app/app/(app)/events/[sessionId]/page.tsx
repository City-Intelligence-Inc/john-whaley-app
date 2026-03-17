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
                  const score = a.ai_score ? parseInt(a.ai_score) : 0;
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
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-semibold truncate group-hover:text-gold transition-colors">{name}</h3>
                              {score > 0 && (
                                <span className={`text-sm font-bold tabular-nums ${score >= 70 ? "text-emerald-500" : score >= 40 ? "text-amber-500" : "text-red-500"}`}>{score}</span>
                              )}
                            </div>
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

                      {/* AI reasoning */}
                      {a.ai_reasoning && (
                        <div className="px-4 pb-2">
                          <div className="rounded-lg bg-gold/5 border border-gold/10 px-2.5 py-1.5">
                            <p className="text-[11px] text-muted-foreground line-clamp-2 flex items-start gap-1.5">
                              <Sparkles className="size-3 mt-0.5 shrink-0 text-gold" />
                              {a.ai_reasoning}
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
        <ProfileSwipeView
          applicants={applicants}
          statusFilter="all"
          sessionId={sessionId}
          onStatusChange={handleStatusChange}
          onSelectApplicant={setSelectedApplicantId}
        />
      )}

      {/* ════════════════════════════════════════════ */}
      {/*  ANALYSIS TAB                                */}
      {/* ════════════════════════════════════════════ */}
      {tab === "analysis" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Run the AI judge panel to score and classify all guests automatically.
          </p>
          <Button
            onClick={() => router.push(`/events/${sessionId}/analyze`)}
            disabled={total === 0}
            className="bg-gold text-gold-foreground hover:bg-gold/90"
          >
            <Brain className="size-4 mr-2" />
            Configure & Run Analysis
          </Button>
        </div>
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
