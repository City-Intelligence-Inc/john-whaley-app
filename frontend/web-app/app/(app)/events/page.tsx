"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Upload, Linkedin, Loader2, Brain, Download, CheckCircle2, XCircle,
  Users, Search, X, MapPin, Building2, Sparkles, Plus, ChevronDown,
  Trash2, CircleCheck, AlertTriangle, ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ProfileSwipeView } from "@/components/profile-swipe-view";
import { ApplicantDetailSheet } from "@/components/applicant-detail-sheet";
import { CSVUploader } from "@/components/csv-uploader";
import { api } from "@/lib/api";
import type { Session, Applicant } from "@/lib/api";

function getName(a: Applicant): string {
  return a.name || (a[`linkedin_name`] as string) || a.email || "No name";
}

export default function MainPage() {
  const router = useRouter();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [eventLoading, setEventLoading] = useState(false);

  const [tab, setTab] = useState<"guests" | "review">("guests");
  const [search, setSearch] = useState("");
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newEventName, setNewEventName] = useState("");
  const [creating, setCreating] = useState(false);

  /* ── Data loading ── */
  const loadSessions = useCallback(async () => {
    try {
      const data = await api.listSessions();
      setSessions(data);
      if (data.length > 0 && !selectedSessionId) setSelectedSessionId(data[0].session_id);
    } catch { toast.error("Failed to load events"); }
    finally { setSessionsLoading(false); }
  }, [selectedSessionId]);

  useEffect(() => { loadSessions(); }, []);

  const loadEvent = useCallback(async (sid: string) => {
    setEventLoading(true);
    try {
      const [s, a] = await Promise.all([api.getSession(sid), api.listApplicants(sid)]);
      setSession(s);
      setApplicants(a);
    } catch { toast.error("Failed to load event"); }
    finally { setEventLoading(false); }
  }, []);

  useEffect(() => { if (selectedSessionId) loadEvent(selectedSessionId); }, [selectedSessionId, loadEvent]);

  const refreshAll = useCallback(async () => {
    if (selectedSessionId) await loadEvent(selectedSessionId);
  }, [selectedSessionId, loadEvent]);

  /* ── Counts ── */
  const accepted = applicants.filter((a) => a.status === "accepted").length;
  const pending = applicants.filter((a) => a.status === "pending").length;
  const total = applicants.length;

  const selectedApplicant = useMemo(
    () => selectedApplicantId ? applicants.find((a) => a.applicant_id === selectedApplicantId) || null : null,
    [selectedApplicantId, applicants]
  );

  /* ── Handlers ── */
  const handleStatusChange = useCallback(async (id: string, status: string) => {
    try { await api.updateApplicant(id, { status }); await refreshAll(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  }, [refreshAll]);

  const handleUploadSuccess = useCallback((_count: number) => {
    refreshAll(); loadSessions(); setShowImportDialog(false);
    toast.success(`Imported ${_count} guests`);
  }, [refreshAll, loadSessions]);

  const handleCreateEvent = useCallback(async () => {
    if (!newEventName.trim()) return;
    setCreating(true);
    try {
      const s = await api.createSession({ name: newEventName.trim(), source: "manual" });
      setShowCreateDialog(false); setNewEventName("");
      await loadSessions(); setSelectedSessionId(s.session_id);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setCreating(false); }
  }, [newEventName, loadSessions]);

  const handleExportCSV = useCallback(() => {
    if (!applicants.length) return;
    const skip = new Set(["applicant_id", "session_id"]);
    const keys = new Set<string>();
    for (const a of applicants) for (const k of Object.keys(a)) if (!skip.has(k)) keys.add(k);
    const pri = ["name", "email", "status", "ai_score", "ai_reasoning", "company", "title", "location", "linkedin_url"];
    const headers = [...pri.filter((k) => keys.has(k)), ...[...keys].filter((k) => !pri.includes(k)).sort()];
    const esc = (v: unknown) => { const s = String(v ?? ""); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [headers.join(","), ...applicants.map((a) => headers.map((h) => esc(a[h])).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url;
    link.download = `${(session?.name || "event").replace(/\s+/g, "-").toLowerCase()}.csv`;
    link.click(); URL.revokeObjectURL(url);
  }, [applicants, session]);

  /* ── Filtered list ── */
  const filtered = useMemo(() => {
    let list = applicants;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => [a.name, a.email, a.company, a.title, a[`linkedin_headline`] as string].filter(Boolean).join(" ").toLowerCase().includes(q));
    }
    return list.sort((a, b) => getName(a).localeCompare(getName(b)));
  }, [applicants, search]);

  /* ── Loading ── */
  if (sessionsLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-gold" /></div>;

  return (
    <div className="space-y-5">
      {/* ── Top bar: Event selector + actions ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-9 gap-2 min-w-[180px] justify-between">
              <span className="truncate text-sm">{session?.name || "Select event"}</span>
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[260px]">
            {sessions.map((s) => (
              <DropdownMenuItem key={s.session_id} onClick={() => setSelectedSessionId(s.session_id)}>
                <span className="truncate flex-1">{s.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{s.applicant_count}</span>
              </DropdownMenuItem>
            ))}
            {sessions.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => setShowCreateDialog(true)}>
              <Plus className="size-3.5 mr-2" />New Event
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {selectedSessionId && (
          <>
            <Button size="sm" onClick={() => setShowImportDialog(true)} className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Upload className="size-3.5 mr-1.5" />Import
            </Button>
            <Button size="sm" variant="outline" onClick={() => router.push(`/events/${selectedSessionId}/analyze`)} disabled={total === 0}>
              <Brain className="size-3.5 mr-1.5" />Analyze
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportCSV} disabled={total === 0}>
              <Download className="size-3.5 mr-1.5" />Export
            </Button>
          </>
        )}

        {/* Stats inline */}
        {total > 0 && (
          <div className="flex items-center gap-3 ml-auto text-xs text-muted-foreground">
            <span>{total} total</span>
            <span className="text-emerald-500">{accepted} going</span>
            {pending > 0 && <span className="text-blue-500">{pending} pending</span>}
          </div>
        )}
      </div>

      {/* ── No event ── */}
      {!selectedSessionId && (
        <Card className="py-16">
          <CardContent className="flex flex-col items-center text-center">
            <Users className="size-10 text-muted-foreground/30 mb-3" />
            <p className="font-medium mb-1">No events yet</p>
            <p className="text-sm text-muted-foreground mb-4">Create an event and import a guest list</p>
            <Button size="sm" onClick={() => setShowCreateDialog(true)} className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Plus className="size-3.5 mr-1.5" />New Event
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Loading event ── */}
      {selectedSessionId && eventLoading && (
        <div className="flex items-center justify-center py-16"><Loader2 className="size-5 animate-spin text-gold" /></div>
      )}

      {/* ── Workspace ── */}
      {selectedSessionId && !eventLoading && (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-4 border-b border-border/50">
            {(["guests", "review"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t ? "border-gold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}>
                {t === "guests" ? `Guests (${total})` : "Review"}
              </button>
            ))}
          </div>

          {/* GUESTS TAB */}
          {tab === "guests" && (
            <div className="space-y-4">
              {/* Search */}
              {total > 0 && (
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guests..." className="pl-9 h-8 text-sm" />
                  {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="size-3.5" /></button>}
                </div>
              )}

              {/* Empty */}
              {total === 0 && (
                <Card className="py-12">
                  <CardContent className="flex flex-col items-center text-center">
                    <Upload className="size-8 text-muted-foreground/30 mb-3" />
                    <p className="font-medium mb-1">No guests yet</p>
                    <p className="text-sm text-muted-foreground mb-3">Import a CSV to get started</p>
                    <Button size="sm" onClick={() => setShowImportDialog(true)} className="bg-gold text-gold-foreground hover:bg-gold/90">
                      <Upload className="size-3.5 mr-1.5" />Import CSV
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Guest list */}
              {total > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {filtered.map((a) => {
                    const photo = (a[`linkedin_image`] as string) || (a[`photo_url`] as string) || "";
                    const headline = (a[`linkedin_headline`] as string) || a.title || "";
                    const company = a.company || (a[`linkedin_company`] as string) || "";
                    const location = a.location || (a[`linkedin_location`] as string) || "";
                    const score = a.ai_score ? parseInt(a.ai_score) : 0;
                    const isPending = a.status === "pending";
                    const name = getName(a);
                    const issues = (a[`linkedin_issues`] as string) || "";
                    const isClean = issues === "clean";
                    const hasIssues = issues && !isClean;

                    return (
                      <Card key={a.applicant_id} className="group hover:border-border/80 transition-all cursor-pointer"
                        onClick={() => setSelectedApplicantId(a.applicant_id)}>
                        <CardContent className="p-4 space-y-2">
                          {/* Header */}
                          <div className="flex items-center gap-3">
                            {photo ? (
                              <img src={photo} alt="" className="size-10 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="size-10 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-semibold text-muted-foreground/40">
                                {name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate">{name}</span>
                                {score > 0 && (
                                  <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${score >= 70 ? "text-emerald-500" : score >= 40 ? "text-amber-500" : "text-red-500"}`}>{score}</Badge>
                                )}
                              </div>
                              {headline && <p className="text-xs text-muted-foreground truncate">{headline}</p>}
                            </div>
                          </div>

                          {/* Meta */}
                          {(company || location) && (
                            <div className="flex gap-3 text-[11px] text-muted-foreground">
                              {company && <span className="flex items-center gap-1 truncate"><Building2 className="size-3 shrink-0" />{company}</span>}
                              {location && <span className="flex items-center gap-1 truncate"><MapPin className="size-3 shrink-0" />{location}</span>}
                            </div>
                          )}

                          {/* AI reasoning */}
                          {a.ai_reasoning && (
                            <p className="text-[11px] text-muted-foreground/70 line-clamp-2 flex items-start gap-1.5">
                              <Sparkles className="size-3 mt-0.5 shrink-0 text-gold" />{a.ai_reasoning}
                            </p>
                          )}

                          {/* Issues + Status */}
                          <div className="flex items-center justify-between pt-1" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              {isClean && <Badge variant="secondary" className="text-emerald-500 bg-emerald-500/10 text-[10px] h-5"><CircleCheck className="size-3 mr-0.5" />Verified</Badge>}
                              {hasIssues && (
                                <span className="flex items-center gap-1 text-[10px] text-amber-500">
                                  <AlertTriangle className="size-3 shrink-0" />
                                  {issues.split("; ").map(i => i.replace("missing_", "No ").replace(/_/g, " ")).join(" / ")}
                                </span>
                              )}
                              {a.linkedin_url && (
                                <a href={a.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400">
                                  <Linkedin className="size-3.5" />
                                </a>
                              )}
                            </div>
                            {isPending ? (
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => handleStatusChange(a.applicant_id, "accepted")}
                                  className="h-6 px-2 text-[10px] text-emerald-500 hover:bg-emerald-500/10">
                                  <CheckCircle2 className="size-3 mr-0.5" />Approve
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleStatusChange(a.applicant_id, "rejected")}
                                  className="h-6 px-2 text-[10px] text-red-500 hover:bg-red-500/10">
                                  <XCircle className="size-3 mr-0.5" />Decline
                                </Button>
                              </div>
                            ) : (
                              <Badge variant="secondary" className={`text-[10px] ${a.status === "accepted" ? "text-emerald-500" : a.status === "rejected" ? "text-red-500" : "text-amber-500"}`}>
                                {a.status === "accepted" ? "Going" : a.status === "rejected" ? "Not Going" : a.status === "waitlisted" ? "Waitlisted" : "Pending"}
                              </Badge>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* REVIEW TAB */}
          {tab === "review" && selectedSessionId && (
            <ProfileSwipeView applicants={applicants} statusFilter="all" sessionId={selectedSessionId}
              onStatusChange={handleStatusChange} onSelectApplicant={setSelectedApplicantId} />
          )}
        </>
      )}

      {/* Detail Sheet */}
      {selectedApplicant && (
        <ApplicantDetailSheet applicant={selectedApplicant}
          onStatusChange={(id, status) => handleStatusChange(id, status!)}
          onClose={() => setSelectedApplicantId(null)} />
      )}

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Guests</DialogTitle>
            <DialogDescription>Upload a CSV from Luma or any spreadsheet.</DialogDescription>
          </DialogHeader>
          <CSVUploader onUploadSuccess={handleUploadSuccess} sessionId={selectedSessionId || undefined} />
        </DialogContent>
      </Dialog>

      {/* Create Event Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>New Event</DialogTitle></DialogHeader>
          <Input placeholder="Event name" value={newEventName} onChange={(e) => setNewEventName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreateEvent(); }} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateEvent} disabled={!newEventName.trim() || creating} className="bg-gold hover:bg-gold/90 text-gold-foreground">
              {creating && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
