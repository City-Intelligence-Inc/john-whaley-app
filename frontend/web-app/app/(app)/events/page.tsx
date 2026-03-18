"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Upload,
  Linkedin,
  Loader2,
  Brain,
  Download,
  CheckCircle2,
  XCircle,
  Users,
  CreditCard,
  Search,
  X,
  MapPin,
  Building2,
  GraduationCap,
  Sparkles,
  Plus,
  ChevronDown,
  Trash2,
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
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ProfileSwipeView } from "@/components/profile-swipe-view";
import { ApplicantDetailSheet } from "@/components/applicant-detail-sheet";
import { CSVUploader } from "@/components/csv-uploader";
import { api } from "@/lib/api";
import type { Session, Applicant, Stats } from "@/lib/api";

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

export default function MainPage() {
  const router = useRouter();
  const { user } = useUser();

  // Sessions
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  // Event data (for selected session)
  const [session, setSession] = useState<Session | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [eventLoading, setEventLoading] = useState(false);

  // UI
  const [tab, setTab] = useState<"guests" | "review" | "analysis">("guests");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [creating, setCreating] = useState(false);

  // LinkedIn enrichment
  const [liAtCookie, setLiAtCookie] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("li_at_cookie") || "" : ""
  );
  const [enriching, setEnriching] = useState(false);
  const [showLiAtPopover, setShowLiAtPopover] = useState(false);

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const data = await api.listSessions();
      setSessions(data);
      // Auto-select first session if none selected
      if (!selectedSessionId && data.length > 0) {
        setSelectedSessionId(data[0].session_id);
      }
    } catch {
      toast.error("Failed to load events");
    } finally {
      setSessionsLoading(false);
    }
  }, [selectedSessionId]);

  useEffect(() => { loadSessions(); }, []);

  // Load event data when session changes
  const loadEvent = useCallback(async (sid: string) => {
    setEventLoading(true);
    try {
      const [s, a, st] = await Promise.all([
        api.getSession(sid),
        api.listApplicants(sid),
        api.getStats(sid),
      ]);
      setSession(s);
      setApplicants(a);
      setStats(st);
    } catch {
      toast.error("Failed to load event data");
    } finally {
      setEventLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSessionId) loadEvent(selectedSessionId);
  }, [selectedSessionId, loadEvent]);

  const refreshAll = useCallback(async () => {
    if (selectedSessionId) await loadEvent(selectedSessionId);
  }, [selectedSessionId, loadEvent]);

  const refreshApplicants = useCallback(async () => {
    if (!selectedSessionId) return;
    const a = await api.listApplicants(selectedSessionId);
    setApplicants(a);
  }, [selectedSessionId]);

  // Counts
  const accepted = applicants.filter((a) => a.status === "accepted").length;
  const pending = applicants.filter((a) => a.status === "pending").length;
  const rejected = applicants.filter((a) => a.status === "rejected").length;
  const waitlisted = applicants.filter((a) => a.status === "waitlisted").length;
  const total = applicants.length;
  const barTotal = total || 1;

  const selectedApplicant = useMemo(
    () => selectedApplicantId ? applicants.find((a) => a.applicant_id === selectedApplicantId) || null : null,
    [selectedApplicantId, applicants]
  );

  // Handlers
  const handleStatusChange = useCallback(async (id: string, status: string) => {
    try {
      await api.updateApplicant(id, { status });
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }, [refreshAll]);

  const handleUploadSuccess = useCallback((_count: number) => {
    refreshAll();
    loadSessions();
    setShowImportDialog(false);
    toast.success(`Imported ${_count} guests`);
  }, [refreshAll, loadSessions]);

  const handleCreateEvent = useCallback(async () => {
    if (!newEventName.trim()) return;
    setCreating(true);
    try {
      const s = await api.createSession({ name: newEventName.trim(), source: "manual" });
      setShowCreateDialog(false);
      setNewEventName("");
      await loadSessions();
      setSelectedSessionId(s.session_id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }, [newEventName, loadSessions]);

  const handleDeleteEvent = useCallback(async (sid: string) => {
    try {
      await api.deleteSession(sid);
      if (selectedSessionId === sid) {
        setSelectedSessionId(null);
        setSession(null);
        setApplicants([]);
      }
      await loadSessions();
      toast.success("Event deleted");
    } catch {
      toast.error("Failed to delete");
    }
  }, [selectedSessionId, loadSessions]);

  const handleEnrichLinkedIn = useCallback(async () => {
    if (!selectedSessionId) return;
    if (liAtCookie.trim()) localStorage.setItem("li_at_cookie", liAtCookie);
    setEnriching(true);
    setShowLiAtPopover(false);
    const toastId = toast.loading("Starting LinkedIn enrichment...");
    try {
      await api.enrichLinkedInStream(
        { session_id: selectedSessionId, li_at: liAtCookie.trim() || undefined },
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
  }, [selectedSessionId, liAtCookie, refreshApplicants]);

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

  // Filtered guest list
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
    return list.sort((a, b) => getName(a).localeCompare(getName(b)));
  }, [applicants, statusFilter, search]);

  // Loading
  if (sessionsLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-gold" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* ── Event Selector Bar ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10 px-4 gap-2 border-border/50 min-w-[200px] justify-between">
              <span className="truncate">{session?.name || "Select event"}</span>
              <ChevronDown className="size-4 text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[280px]">
            {sessions.map((s) => (
              <DropdownMenuItem key={s.session_id} onClick={() => setSelectedSessionId(s.session_id)}
                className="flex items-center justify-between">
                <span className="truncate">{s.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">{s.applicant_count}</span>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteEvent(s.session_id); }}
                    className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </DropdownMenuItem>
            ))}
            {sessions.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => setShowCreateDialog(true)}>
              <Plus className="size-4 mr-2" />New Event
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {selectedSessionId && (
          <>
            <Button onClick={() => setShowImportDialog(true)} className="bg-gold text-gold-foreground hover:bg-gold/90 h-10">
              <Upload className="size-4 mr-2" />Import
            </Button>
            <Button variant="outline" onClick={handleExportCSV} disabled={total === 0} className="h-10 border-border/50">
              <Download className="size-4 mr-2" />Export
            </Button>
            <Popover open={showLiAtPopover} onOpenChange={setShowLiAtPopover}>
              <PopoverTrigger asChild>
                <Button variant="outline" disabled={enriching || total === 0} className="h-10 border-border/50">
                  {enriching ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Linkedin className="size-4 mr-2" />}
                  Enrich
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
                    {enriching ? "Enriching..." : "Start"}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </>
        )}
      </div>

      {/* ── No Event Selected ── */}
      {!selectedSessionId && (
        <div className="text-center py-20">
          <Users className="size-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-lg font-medium mb-1">No events yet</p>
          <p className="text-sm text-muted-foreground mb-4">Create an event and import guests to get started</p>
          <Button onClick={() => setShowCreateDialog(true)} className="bg-gold text-gold-foreground hover:bg-gold/90">
            <Plus className="size-4 mr-2" />New Event
          </Button>
        </div>
      )}

      {/* ── Event Loading ── */}
      {selectedSessionId && eventLoading && (
        <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-gold" /></div>
      )}

      {/* ── Event Workspace ── */}
      {selectedSessionId && !eventLoading && (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-6 border-b border-border/50">
            {(["guests", "review", "analysis"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`pb-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t ? "border-gold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                {t === "guests" ? "Guests" : t === "review" ? "Review" : "Analysis"}
              </button>
            ))}
          </div>

          {/* ── GUESTS TAB ── */}
          {tab === "guests" && (
            <div className="space-y-6">
              {/* At a Glance */}
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-emerald-500">{accepted}</span>
                  <span className="text-lg text-muted-foreground">Going</span>
                  <span className="text-sm text-muted-foreground ml-2">of {total}</span>
                </div>
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

              {/* Search + filter */}
              {total > 0 && (
                <div className="flex items-center gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                    <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="pl-9 h-9" />
                    {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="size-4" /></button>}
                  </div>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                    className="h-9 rounded-md border border-border/50 bg-background px-3 text-sm text-foreground">
                    <option value="all">All Guests</option>
                    <option value="accepted">Going</option>
                    <option value="pending">Pending</option>
                    <option value="waitlisted">Waitlisted</option>
                    <option value="rejected">Not Going</option>
                  </select>
                </div>
              )}

              {/* Empty */}
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
                      <div key={a.applicant_id}
                        className="rounded-xl border border-border/50 bg-card/50 hover:border-border transition-all overflow-hidden cursor-pointer group"
                        onClick={() => setSelectedApplicantId(a.applicant_id)}>
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
                        {(company || location || education) && (
                          <div className="px-4 pb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            {company && <span className="flex items-center gap-1"><Building2 className="size-3" />{company}</span>}
                            {location && <span className="flex items-center gap-1"><MapPin className="size-3" />{location}</span>}
                            {education && <span className="flex items-center gap-1"><GraduationCap className="size-3" /><span className="truncate max-w-[150px]">{education.split("\n")[0]}</span></span>}
                          </div>
                        )}
                        {about && <div className="px-4 pb-2"><p className="text-[11px] text-muted-foreground/70 line-clamp-2 leading-relaxed">{about}</p></div>}
                        {a.ai_reasoning && (
                          <div className="px-4 pb-2">
                            <div className="rounded-lg bg-gold/5 border border-gold/10 px-2.5 py-1.5">
                              <p className="text-[11px] text-muted-foreground line-clamp-2 flex items-start gap-1.5">
                                <Sparkles className="size-3 mt-0.5 shrink-0 text-gold" />{a.ai_reasoning}
                              </p>
                            </div>
                          </div>
                        )}
                        <div className="px-4 py-2.5 border-t border-border/30 flex items-center justify-between" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            {a.attendee_type && <Badge variant="outline" className="text-[10px] h-5">{a.attendee_type_detail || a.attendee_type}</Badge>}
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
          )}

          {/* ── REVIEW TAB ── */}
          {tab === "review" && selectedSessionId && (
            <ProfileSwipeView
              applicants={applicants}
              statusFilter="all"
              sessionId={selectedSessionId}
              onStatusChange={handleStatusChange}
              onSelectApplicant={setSelectedApplicantId}
            />
          )}

          {/* ── ANALYSIS TAB ── */}
          {tab === "analysis" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Run the AI judge panel to score and classify all guests automatically.
              </p>
              <Button
                onClick={() => router.push(`/events/${selectedSessionId}/analyze`)}
                disabled={total === 0}
                className="bg-gold text-gold-foreground hover:bg-gold/90">
                <Brain className="size-4 mr-2" />Configure & Run Analysis
              </Button>
            </div>
          )}
        </>
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
            <DialogDescription>Upload a CSV export from Luma or any spreadsheet.</DialogDescription>
          </DialogHeader>
          <CSVUploader onUploadSuccess={handleUploadSuccess} sessionId={selectedSessionId || undefined} />
        </DialogContent>
      </Dialog>

      {/* ── Create Event Dialog ── */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Event</DialogTitle>
            <DialogDescription>Create a blank event to start adding guests.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input placeholder="Event name" value={newEventName} onChange={(e) => setNewEventName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateEvent(); }}
              className="bg-background border-border/50 focus-visible:ring-gold/40" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateEvent} disabled={!newEventName.trim() || creating}
              className="bg-gold hover:bg-gold/90 text-gold-foreground">
              {creating && <Loader2 className="size-4 mr-2 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
