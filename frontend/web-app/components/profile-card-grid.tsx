"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Linkedin,
  MapPin,
  Building2,
  GraduationCap,
  Sparkles,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import type { Applicant } from "@/lib/api";

interface ProfileCardGridProps {
  applicants: Applicant[];
  statusFilter: string;
  sessionId: string;
  onStatusChange: (id: string, status: string) => void;
  onSelectApplicant: (id: string) => void;
}

function scoreColor(score: number): string {
  if (score >= 70) return "text-emerald-500";
  if (score >= 40) return "text-amber-500";
  if (score > 0) return "text-red-500";
  return "text-muted-foreground";
}

function statusBadge(status: string) {
  switch (status) {
    case "accepted":
      return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Accepted</Badge>;
    case "rejected":
      return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">Rejected</Badge>;
    case "waitlisted":
      return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Waitlisted</Badge>;
    default:
      return <Badge variant="secondary">Pending</Badge>;
  }
}

export function ProfileCardGrid({
  applicants,
  statusFilter,
  sessionId,
  onStatusChange,
  onSelectApplicant,
}: ProfileCardGridProps) {
  const [search, setSearch] = useState("");

  const [wlEmails, setWlEmails] = useState<Set<string>>(new Set());
  const [blEmails, setBlEmails] = useState<Set<string>>(new Set());
  const [wlUrls, setWlUrls] = useState<Set<string>>(new Set());
  const [blUrls, setBlUrls] = useState<Set<string>>(new Set());
  const [listsLoaded, setListsLoaded] = useState(false);

  const [aiQueryOpen, setAiQueryOpen] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);

  const loadLists = useCallback(async () => {
    try {
      const [wl, bl] = await Promise.all([
        api.getSessionWhitelist(sessionId),
        api.getSessionBlacklist(sessionId),
      ]);
      setWlEmails(new Set((wl.emails || []).map((e: string) => e.toLowerCase())));
      setBlEmails(new Set((bl.emails || []).map((e: string) => e.toLowerCase())));
      setWlUrls(new Set((wl.linkedin_urls || []).map((u: string) => u.toLowerCase())));
      setBlUrls(new Set((bl.linkedin_urls || []).map((u: string) => u.toLowerCase())));
    } catch { /* ignore */ } finally { setListsLoaded(true); }
  }, [sessionId]);

  useEffect(() => { loadLists(); }, [loadLists]);

  const isWl = (a: Applicant) => {
    const e = (a.email || "").toLowerCase(), u = (a.linkedin_url || "").toLowerCase();
    return (e && wlEmails.has(e)) || (u && wlUrls.has(u));
  };
  const isBl = (a: Applicant) => {
    const e = (a.email || "").toLowerCase(), u = (a.linkedin_url || "").toLowerCase();
    return (e && blEmails.has(e)) || (u && blUrls.has(u));
  };

  const toggleList = async (a: Applicant, list: "whitelist" | "blacklist") => {
    const email = (a.email || "").toLowerCase(), url = (a.linkedin_url || "").toLowerCase();
    const nwE = new Set(wlEmails), nwU = new Set(wlUrls), nbE = new Set(blEmails), nbU = new Set(blUrls);
    const isOn = list === "whitelist" ? isWl(a) : isBl(a);
    if (list === "whitelist") {
      if (isOn) { if (email) nwE.delete(email); if (url) nwU.delete(url); }
      else { if (email) { nwE.add(email); nbE.delete(email); } if (url) { nwU.add(url); nbU.delete(url); } }
    } else {
      if (isOn) { if (email) nbE.delete(email); if (url) nbU.delete(url); }
      else { if (email) { nbE.add(email); nwE.delete(email); } if (url) { nbU.add(url); nwU.delete(url); } }
    }
    setWlEmails(nwE); setWlUrls(nwU); setBlEmails(nbE); setBlUrls(nbU);
    try {
      await Promise.all([
        api.updateSessionWhitelist(sessionId, { emails: [...nwE], linkedin_urls: [...nwU] }),
        api.updateSessionBlacklist(sessionId, { emails: [...nbE], linkedin_urls: [...nbU] }),
      ]);
    } catch { toast.error("Failed to update list"); loadLists(); }
  };

  const filtered = applicants.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const s = [a.name, a.email, a.company, a.title, a[`linkedin_headline`] as string, a[`linkedin_company`] as string].filter(Boolean).join(" ").toLowerCase();
      if (!s.includes(q)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    return (a.name || "").localeCompare(b.name || "");
  });

  const handleAiQuery = async (id: string) => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true); setAiResult(null);
    try {
      const result = await api.reviewApplicant(id, { prompt: aiPrompt, api_key: "", model: "gpt-4o-mini", provider: "openai" });
      setAiResult(result.ai_reasoning || result.ai_review || "No response.");
    } catch (err) { toast.error(err instanceof Error ? err.message : "AI query failed"); }
    finally { setAiLoading(false); }
  };

  const queryApplicant = sorted.find((a) => a.applicant_id === aiQueryOpen);
  const wlCount = applicants.filter(isWl).length;
  const blCount = applicants.filter(isBl).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Input placeholder="Search by name, company, headline..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm bg-background border-border/50 focus-visible:ring-gold/40" />
        <p className="text-xs text-muted-foreground">{sorted.length} profiles</p>
        {listsLoaded && (wlCount > 0 || blCount > 0) && (
          <div className="flex items-center gap-2 text-xs">
            {wlCount > 0 && <span className="flex items-center gap-1 text-emerald-500"><ShieldCheck className="size-3" />{wlCount} whitelisted</span>}
            {blCount > 0 && <span className="flex items-center gap-1 text-red-500"><ShieldAlert className="size-3" />{blCount} blacklisted</span>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sorted.map((a) => {
          const score = a.ai_score ? parseInt(a.ai_score) : 0;
          const photo = (a[`linkedin_image`] as string) || (a[`photo_url`] as string) || "";
          const headline = (a[`linkedin_headline`] as string) || "";
          const about = (a[`linkedin_about`] as string) || "";
          const education = (a[`linkedin_education`] as string) || "";
          const company = a.company || (a[`linkedin_company`] as string) || "";
          const location = a.location || (a[`linkedin_location`] as string) || "";
          const wl = isWl(a), bl = isBl(a);

          return (
            <Card key={a.applicant_id} className={`group border-border/50 bg-card/50 transition-all overflow-hidden ${
              wl ? "ring-1 ring-emerald-500/30 border-emerald-500/20" :
              bl ? "ring-1 ring-red-500/30 border-red-500/20 opacity-60" : "hover:border-gold/30"
            }`}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  {photo ? (
                    <img src={photo} alt="" className="size-14 rounded-xl object-cover shrink-0 ring-1 ring-border/50" />
                  ) : (
                    <div className="size-14 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center shrink-0 text-lg font-semibold text-muted-foreground/50">
                      {(a.name || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <button onClick={() => onSelectApplicant(a.applicant_id)} className="text-left">
                      <h3 className="text-sm font-semibold text-foreground truncate hover:text-gold transition-colors">{a.name || "Unknown"}</h3>
                    </button>
                    {headline ? <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{headline}</p>
                    : a.title ? <p className="text-xs text-muted-foreground truncate mt-0.5">{a.title}</p> : null}
                    {wl && <Badge className="mt-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]"><ShieldCheck className="size-2.5 mr-0.5" />Whitelisted</Badge>}
                    {bl && <Badge className="mt-1 bg-red-500/10 text-red-500 border-red-500/20 text-[10px]"><ShieldAlert className="size-2.5 mr-0.5" />Blacklisted</Badge>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {statusBadge(a.status)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {company && <span className="flex items-center gap-1"><Building2 className="size-3" />{company}</span>}
                  {location && <span className="flex items-center gap-1"><MapPin className="size-3" />{location}</span>}
                  {education && <span className="flex items-center gap-1"><GraduationCap className="size-3" /><span className="truncate max-w-[200px]">{education.split("\n")[0]}</span></span>}
                </div>
                {about && <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">{about}</p>}
                {a.ai_reasoning && (
                  <div className="rounded-md bg-gold/5 border border-gold/10 p-2">
                    <p className="text-xs text-muted-foreground line-clamp-2 flex items-start gap-1.5">
                      <Sparkles className="size-3 mt-0.5 shrink-0 text-gold" />{a.ai_reasoning}
                    </p>
                  </div>
                )}
                {a.attendee_type && <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{a.attendee_type_detail || a.attendee_type}</Badge>}

                <div className="flex items-center gap-1 pt-1">
                  <Button size="sm" variant={a.status === "accepted" ? "default" : "outline"}
                    onClick={() => onStatusChange(a.applicant_id, "accepted")} className="h-7 text-xs px-2">
                    <CheckCircle2 className="size-3 mr-1 text-emerald-500" />Accept
                  </Button>
                  <Button size="sm" variant={a.status === "waitlisted" ? "default" : "outline"}
                    onClick={() => onStatusChange(a.applicant_id, "waitlisted")} className="h-7 text-xs px-2">
                    <Clock className="size-3 mr-1 text-amber-500" />Wait
                  </Button>
                  <Button size="sm" variant={a.status === "rejected" ? "default" : "outline"}
                    onClick={() => onStatusChange(a.applicant_id, "rejected")} className="h-7 text-xs px-2">
                    <XCircle className="size-3 mr-1 text-red-500" />Reject
                  </Button>
                  <div className="flex-1" />
                  <button onClick={() => toggleList(a, "blacklist")}
                    className={`p-1.5 rounded-md transition-colors ${bl ? "bg-red-500/10 text-red-500" : "text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/5"}`}
                    title={bl ? "Remove from blacklist" : "Blacklist"}>
                    <ShieldAlert className="size-3.5" />
                  </button>
                  <button onClick={() => toggleList(a, "whitelist")}
                    className={`p-1.5 rounded-md transition-colors ${wl ? "bg-emerald-500/10 text-emerald-500" : "text-muted-foreground/40 hover:text-emerald-500 hover:bg-emerald-500/5"}`}
                    title={wl ? "Remove from whitelist" : "Whitelist"}>
                    <ShieldCheck className="size-3.5" />
                  </button>
                  <button onClick={() => { setAiQueryOpen(a.applicant_id); setAiPrompt(""); setAiResult(null); }}
                    className="p-1.5 rounded-md text-muted-foreground/40 hover:text-gold hover:bg-gold/5 transition-colors" title="Ask AI">
                    <MessageSquare className="size-3.5" />
                  </button>
                  {a.linkedin_url && (
                    <a href={a.linkedin_url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-md text-muted-foreground/40 hover:text-blue-500 hover:bg-blue-500/5 transition-colors">
                      <Linkedin className="size-3.5" />
                    </a>
                  )}
                  {a.email && (
                    <a href={`mailto:${a.email}`} className="p-1.5 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted transition-colors">
                      <Mail className="size-3.5" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {sorted.length === 0 && <div className="text-center py-12 text-sm text-muted-foreground">No profiles match your search.</div>}

      <Dialog open={!!aiQueryOpen} onOpenChange={(open) => { if (!open) { setAiQueryOpen(null); setAiResult(null); } }}>
        <DialogContent className="sm:max-w-lg bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-gold" />Ask AI about {queryApplicant?.name || "this person"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="e.g. Is this person a good fit for an AI startup event?" value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && aiQueryOpen) handleAiQuery(aiQueryOpen); }}
              className="bg-background border-border/50" />
            {aiResult && <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed max-h-[300px] overflow-y-auto">{aiResult}</div>}
          </div>
          <DialogFooter>
            <Button onClick={() => aiQueryOpen && handleAiQuery(aiQueryOpen)} disabled={aiLoading || !aiPrompt.trim()}
              className="bg-gold hover:bg-gold/90 text-gold-foreground">
              {aiLoading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Sparkles className="size-4 mr-2" />}
              {aiLoading ? "Thinking..." : "Ask AI"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
