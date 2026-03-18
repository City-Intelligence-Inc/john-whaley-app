"use client";

import { useState } from "react";
import {
  Upload, Loader2, Brain, Download, Users, Search, X, Plus, ChevronDown, Key, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ProfileSwipeView } from "@/components/profile-swipe-view";
import { ApplicantDetailSheet } from "@/components/applicant-detail-sheet";
import { CSVUploader } from "@/components/csv-uploader";
import { useEventsPage } from "./_hooks/use-events-page";
import { GuestCard } from "./_components/guest-card";
import { BulkInvestigateDialog } from "./_components/bulk-investigate-dialog";

export default function EventsPage() {
  const e = useEventsPage();

  const [tab, setTab] = useState<"guests" | "review">("guests");
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const selectedApplicant = selectedApplicantId ? e.applicants.find(a => a.applicant_id === selectedApplicantId) || null : null;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try { await e.createEvent(newName.trim()); setShowCreate(false); setNewName(""); }
    catch { toast.error("Failed to create event"); }
    finally { setCreating(false); }
  };

  const handleExport = () => {
    if (!e.applicants.length) return;
    const skip = new Set(["applicant_id", "session_id"]);
    const keys = new Set<string>();
    for (const a of e.applicants) for (const k of Object.keys(a)) if (!skip.has(k)) keys.add(k);
    const pri = ["name", "email", "status", "ai_score", "ai_reasoning", "company", "title", "location"];
    const headers = [...pri.filter(k => keys.has(k)), ...[...keys].filter(k => !pri.includes(k)).sort()];
    const esc = (v: unknown) => { const s = String(v ?? ""); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [headers.join(","), ...e.applicants.map(a => headers.map(h => esc(a[h])).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url;
    link.download = `${(e.session?.name || "event").replace(/\s+/g, "-").toLowerCase()}.csv`;
    link.click(); URL.revokeObjectURL(url);
  };

  if (e.sessionsLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-gold" /></div>;

  return (
    <div className="space-y-5">
      {/* ── Top Bar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Event selector */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-9 gap-2 min-w-[160px] justify-between">
              <span className="truncate text-sm">{e.session?.name || "Select event"}</span>
              <ChevronDown className="size-3.5 text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[260px]">
            {e.sessions.map(s => (
              <DropdownMenuItem key={s.session_id} onClick={() => e.setSelectedSessionId(s.session_id)}>
                <span className="truncate flex-1">{s.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{s.applicant_count}</span>
              </DropdownMenuItem>
            ))}
            {e.sessions.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => setShowCreate(true)}><Plus className="size-3.5 mr-2" />New Event</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {e.selectedSessionId && (
          <>
            <Button size="sm" onClick={() => setShowImport(true)} className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Upload className="size-3.5 mr-1.5" />Import
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowBulk(true)} disabled={e.total === 0 || !e.apiKey}>
              <Brain className="size-3.5 mr-1.5" />Analyze All
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport} disabled={e.total === 0}>
              <Download className="size-3.5 mr-1.5" />Export
            </Button>
          </>
        )}

        {/* API Key input */}
        <div className="flex items-center gap-1 ml-auto">
          <div className="relative">
            <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <Input
              type={showKey ? "text" : "password"}
              value={e.apiKey}
              onChange={ev => e.setApiKey(ev.target.value)}
              placeholder="AI API key"
              className="h-8 w-[180px] pl-7 pr-8 text-xs font-mono"
            />
            <button onClick={() => setShowKey(!showKey)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
            </button>
          </div>
          {e.total > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground ml-2">
              <span>{e.total} guests</span>
              <span className="text-emerald-500">{e.accepted} going</span>
              {e.pending > 0 && <span className="text-blue-500">{e.pending} pending</span>}
            </div>
          )}
        </div>
      </div>

      {/* ── No event ── */}
      {!e.selectedSessionId && (
        <Card className="py-16"><CardContent className="flex flex-col items-center text-center">
          <Users className="size-10 text-muted-foreground/30 mb-3" />
          <p className="font-medium mb-1">No events yet</p>
          <p className="text-sm text-muted-foreground mb-4">Create an event and import a guest list</p>
          <Button size="sm" onClick={() => setShowCreate(true)} className="bg-gold text-gold-foreground hover:bg-gold/90">
            <Plus className="size-3.5 mr-1.5" />New Event
          </Button>
        </CardContent></Card>
      )}

      {/* ── Loading ── */}
      {e.selectedSessionId && e.eventLoading && (
        <div className="flex items-center justify-center py-16"><Loader2 className="size-5 animate-spin text-gold" /></div>
      )}

      {/* ── Workspace ── */}
      {e.selectedSessionId && !e.eventLoading && (
        <>
          {/* Tabs */}
          <div className="flex items-center gap-4 border-b border-border/50">
            {(["guests", "review"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-gold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {t === "guests" ? `Guests (${e.total})` : "Review"}
              </button>
            ))}
          </div>

          {/* GUESTS */}
          {tab === "guests" && (
            <div className="space-y-4">
              {e.total > 0 && (
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input value={e.search} onChange={ev => e.setSearch(ev.target.value)} placeholder="Search guests..." className="pl-9 h-8 text-sm" />
                  {e.search && <button onClick={() => e.setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="size-3.5" /></button>}
                </div>
              )}

              {e.total === 0 && (
                <Card className="py-12"><CardContent className="flex flex-col items-center text-center">
                  <Upload className="size-8 text-muted-foreground/30 mb-3" />
                  <p className="font-medium mb-1">No guests yet</p>
                  <p className="text-sm text-muted-foreground mb-3">Import a CSV to get started</p>
                  <Button size="sm" onClick={() => setShowImport(true)} className="bg-gold text-gold-foreground hover:bg-gold/90">
                    <Upload className="size-3.5 mr-1.5" />Import CSV
                  </Button>
                </CardContent></Card>
              )}

              {e.total > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {e.filtered.map(a => (
                    <GuestCard
                      key={a.applicant_id}
                      applicant={a}
                      agents={e.agents}
                      investigating={e.investigatingIds.has(a.applicant_id)}
                      onStatusChange={e.changeStatus}
                      onInvestigate={e.runInvestigation}
                      onSelect={setSelectedApplicantId}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* REVIEW */}
          {tab === "review" && e.selectedSessionId && (
            <ProfileSwipeView applicants={e.applicants} statusFilter="all" sessionId={e.selectedSessionId}
              onStatusChange={e.changeStatus} onSelectApplicant={setSelectedApplicantId} />
          )}
        </>
      )}

      {/* Detail Sheet */}
      {selectedApplicant && (
        <ApplicantDetailSheet applicant={selectedApplicant}
          onStatusChange={(id, status) => e.changeStatus(id, status!)}
          onClose={() => setSelectedApplicantId(null)} />
      )}

      {/* Bulk Investigate */}
      <BulkInvestigateDialog open={showBulk} onOpenChange={setShowBulk} agents={e.agents}
        applicantCount={e.total} onRun={e.runBulkInvestigation}
        bulkInvestigating={e.bulkInvestigating} bulkProgress={e.bulkProgress} />

      {/* Import */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Import Guests</DialogTitle>
            <DialogDescription>Upload a CSV from Luma or any spreadsheet.</DialogDescription></DialogHeader>
          <CSVUploader onUploadSuccess={(count) => { e.refreshAll(); e.loadSessions(); setShowImport(false); toast.success(`Imported ${count} guests`); }}
            sessionId={e.selectedSessionId || undefined} />
        </DialogContent>
      </Dialog>

      {/* Create Event */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>New Event</DialogTitle></DialogHeader>
          <Input placeholder="Event name" value={newName} onChange={ev => setNewName(ev.target.value)}
            onKeyDown={ev => { if (ev.key === "Enter") handleCreate(); }} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating} className="bg-gold hover:bg-gold/90 text-gold-foreground">
              {creating && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
