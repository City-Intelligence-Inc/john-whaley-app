"use client";

import { useState } from "react";
import {
  Upload, Loader2, Brain, Download, Users, Search, X, Plus, ChevronDown,
  Key, Eye, EyeOff, CheckCircle2, XCircle, Building2, MapPin, Sparkles,
  Linkedin, ScanSearch, CircleCheck, AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ApplicantDetailSheet } from "@/components/applicant-detail-sheet";
import { CSVUploader } from "@/components/csv-uploader";
import { useEventsPage } from "./_hooks/use-events-page";

export default function EventsPage() {
  const e = useEventsPage();
  const router = useRouter();

  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const selectedApplicant = selectedApplicantId ? e.applicants.find(a => a.applicant_id === selectedApplicantId) || null : null;

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try { await e.createEvent(newName.trim()); setShowCreate(false); setNewName(""); }
    catch { toast.error("Failed to create"); }
    finally { setCreating(false); }
  };

  if (e.sessionsLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-gold" /></div>;

  return (
    <div className="space-y-4">
      {/* ── Top Bar ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 min-w-[160px] justify-between">
              <span className="truncate">{e.session?.name || "Select event"}</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[240px]">
            {e.sessions.map(s => (
              <DropdownMenuItem key={s.session_id} onClick={() => e.setSelectedSessionId(s.session_id)}>
                <span className="truncate flex-1">{s.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{s.applicant_count}</span>
              </DropdownMenuItem>
            ))}
            {e.sessions.length > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={() => setShowCreate(true)}><Plus className="size-3 mr-2" />New Event</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {e.selectedSessionId && (
          <>
            <Button size="sm" onClick={() => setShowImport(true)} className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Upload className="size-3 mr-1.5" />Import
            </Button>
            <Button size="sm" variant="outline" onClick={() => router.push(`/events/${e.selectedSessionId}/analyze`)} disabled={e.total === 0}>
              <Brain className="size-3 mr-1.5" />Analyze
            </Button>
          </>
        )}

        <div className="flex items-center gap-1 ml-auto">
          <div className="relative">
            <Key className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <Input type={showKey ? "text" : "password"} value={e.apiKey} onChange={ev => e.setApiKey(ev.target.value)}
              placeholder="AI API key" className="h-7 w-[160px] pl-6 pr-7 text-[11px] font-mono" />
            <button onClick={() => setShowKey(!showKey)} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
            </button>
          </div>
          {e.total > 0 && (
            <span className="text-[11px] text-muted-foreground ml-2">
              {e.accepted}/{e.total} going
            </span>
          )}
        </div>
      </div>

      {/* ── Empty ── */}
      {!e.selectedSessionId && (
        <Card className="py-12"><CardContent className="flex flex-col items-center text-center">
          <Users className="size-8 text-muted-foreground/20 mb-2" />
          <p className="text-sm font-medium mb-1">No events</p>
          <p className="text-xs text-muted-foreground mb-3">Create an event and import guests</p>
          <Button size="sm" onClick={() => setShowCreate(true)} className="bg-gold text-gold-foreground hover:bg-gold/90">
            <Plus className="size-3 mr-1.5" />New Event
          </Button>
        </CardContent></Card>
      )}

      {e.selectedSessionId && e.eventLoading && (
        <div className="flex items-center justify-center py-12"><Loader2 className="size-5 animate-spin text-gold" /></div>
      )}

      {/* ── Guest List ── */}
      {e.selectedSessionId && !e.eventLoading && (
        <div className="space-y-3">
          {e.total > 0 && (
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
              <Input value={e.search} onChange={ev => e.setSearch(ev.target.value)} placeholder="Search..." className="pl-8 h-7 text-xs" />
              {e.search && <button onClick={() => e.setSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="size-3" /></button>}
            </div>
          )}

          {e.total === 0 && (
            <Card className="py-10"><CardContent className="flex flex-col items-center text-center">
              <Upload className="size-6 text-muted-foreground/20 mb-2" />
              <p className="text-sm font-medium mb-1">No guests</p>
              <Button size="sm" onClick={() => setShowImport(true)} className="bg-gold text-gold-foreground hover:bg-gold/90 mt-2">
                <Upload className="size-3 mr-1.5" />Import CSV
              </Button>
            </CardContent></Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {e.filtered.map(a => {
              const photo = (a[`linkedin_image`] as string) || (a[`photo_url`] as string) || "";
              const headline = (a[`linkedin_headline`] as string) || a.title || "";
              const company = a.company || (a[`linkedin_company`] as string) || "";
              const location = a.location || (a[`linkedin_location`] as string) || "";
              const name = a.name || (a[`linkedin_name`] as string) || a.email || "No name";
              const issues = (a[`linkedin_issues`] as string) || "";
              const isClean = issues === "clean";
              const hasIssues = issues && !isClean;
              const investigating = e.investigatingIds.has(a.applicant_id);

              // Investigation results
              const investigations = Object.entries(a)
                .filter(([k]) => k.startsWith("investigation_"))
                .map(([k, v]) => ({
                  id: k.replace("investigation_", ""),
                  name: e.agents.find(ag => ag.id === k.replace("investigation_", ""))?.name || k,
                  summary: String(v).split("\n")[0],
                  full: String(v),
                }));

              return (
                <Card key={a.applicant_id} className="hover:border-border/80 transition-all">
                  <CardContent className="p-3 space-y-2">
                    {/* Header */}
                    <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setSelectedApplicantId(a.applicant_id)}>
                      {photo ? <img src={photo} alt="" className="size-9 rounded-full object-cover shrink-0" />
                        : <div className="size-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground/40">{name.charAt(0).toUpperCase()}</div>}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium truncate block">{name}</span>
                        {headline && <p className="text-[11px] text-muted-foreground truncate">{headline}</p>}
                      </div>
                    </div>

                    {/* Meta */}
                    {(company || location) && (
                      <div className="flex gap-2.5 text-[10px] text-muted-foreground">
                        {company && <span className="flex items-center gap-0.5 truncate"><Building2 className="size-2.5" />{company}</span>}
                        {location && <span className="flex items-center gap-0.5 truncate"><MapPin className="size-2.5" />{location}</span>}
                      </div>
                    )}

                    {/* AI reasoning */}
                    {a.ai_reasoning && (
                      <p className="text-[10px] text-muted-foreground/60 line-clamp-2 flex items-start gap-1">
                        <Sparkles className="size-2.5 mt-0.5 shrink-0 text-gold" />
                        {String(a.ai_reasoning).includes(" | ") ? String(a.ai_reasoning).split(" | ")[0].replace(/^.*?\]:\s*/, "") : a.ai_reasoning}
                      </p>
                    )}

                    {/* Investigations inline */}
                    {investigations.length > 0 && (
                      <div className="space-y-1">
                        {investigations.map(inv => (
                          <Collapsible key={inv.id}>
                            <CollapsibleTrigger className="flex items-center gap-1 w-full text-left">
                              <Badge variant="outline" className="text-[9px] h-4 gap-0.5 shrink-0">{inv.name}</Badge>
                              <span className="text-[10px] text-muted-foreground truncate">{inv.summary}</span>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="mt-1 rounded bg-muted/50 p-2 text-[10px] text-muted-foreground leading-relaxed whitespace-pre-wrap max-h-[150px] overflow-y-auto">
                                {inv.full}
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        ))}
                      </div>
                    )}

                    {/* Issues */}
                    {isClean && <Badge variant="secondary" className="text-emerald-500 bg-emerald-500/10 text-[9px] h-4"><CircleCheck className="size-2.5 mr-0.5" />Verified</Badge>}
                    {hasIssues && <span className="flex items-center gap-0.5 text-[9px] text-amber-500"><AlertTriangle className="size-2.5" />{issues.split("; ").map(i => i.replace("missing_", "No ").replace(/_/g, " ")).join(" / ")}</span>}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-0.5" onClick={ev => ev.stopPropagation()}>
                      <div className="flex items-center gap-0.5">
                        {a.linkedin_url && <a href={a.linkedin_url} target="_blank" rel="noopener noreferrer" className="p-1 text-blue-500 hover:text-blue-400"><Linkedin className="size-3" /></a>}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 text-muted-foreground hover:text-gold" disabled={investigating}>
                              {investigating ? <Loader2 className="size-3 animate-spin" /> : <ScanSearch className="size-3" />}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-[200px]">
                            {e.agents.map(ag => (
                              <DropdownMenuItem key={ag.id} onClick={() => e.runInvestigation(a.applicant_id, ag.id)}>
                                <div><div className="text-xs font-medium">{ag.name}</div><div className="text-[10px] text-muted-foreground">{ag.description}</div></div>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {a.status === "pending" ? (
                        <div className="flex gap-0.5">
                          <Button size="sm" variant="ghost" onClick={() => e.changeStatus(a.applicant_id, "accepted")} className="h-6 px-1.5 text-[10px] text-emerald-500 hover:bg-emerald-500/10">
                            <CheckCircle2 className="size-2.5 mr-0.5" />Approve
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => e.changeStatus(a.applicant_id, "rejected")} className="h-6 px-1.5 text-[10px] text-red-500 hover:bg-red-500/10">
                            <XCircle className="size-2.5 mr-0.5" />Decline
                          </Button>
                        </div>
                      ) : (
                        <Badge variant="secondary" className={`text-[9px] ${a.status === "accepted" ? "text-emerald-500" : a.status === "rejected" ? "text-red-500" : "text-amber-500"}`}>
                          {a.status === "accepted" ? "Going" : a.status === "rejected" ? "Not Going" : "Waitlisted"}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Detail Sheet */}
      {selectedApplicant && <ApplicantDetailSheet applicant={selectedApplicant} onStatusChange={(id, status) => e.changeStatus(id, status!)} onClose={() => setSelectedApplicantId(null)} />}

      {/* Import */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Import Guests</DialogTitle><DialogDescription>Upload a CSV.</DialogDescription></DialogHeader>
          <CSVUploader onUploadSuccess={(count) => { e.refreshAll(); e.loadSessions(); setShowImport(false); toast.success(`Imported ${count} guests`); }} sessionId={e.selectedSessionId || undefined} />
        </DialogContent>
      </Dialog>

      {/* Create */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>New Event</DialogTitle></DialogHeader>
          <Input placeholder="Event name" value={newName} onChange={ev => setNewName(ev.target.value)} onKeyDown={ev => { if (ev.key === "Enter") handleCreate(); }} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating} className="bg-gold hover:bg-gold/90 text-gold-foreground">
              {creating && <Loader2 className="size-3 mr-1.5 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
