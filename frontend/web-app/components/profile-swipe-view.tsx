"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Mail,
  Linkedin,
  MapPin,
  Building2,
  GraduationCap,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  SkipForward,
  ExternalLink,
  Briefcase,
  CheckCircle2,
  XCircle,
  Clock,
  Keyboard,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Applicant } from "@/lib/api";
import { ATTENDEE_TYPES } from "@/lib/constants";

const TYPE_COLORS: Record<string, string> = Object.fromEntries(
  ATTENDEE_TYPES.map((t) => [t.key, t.color])
);

interface ProfileSwipeViewProps {
  applicants: Applicant[];
  statusFilter: string;
  sessionId: string;
  onStatusChange: (id: string, status: string) => void;
  onSelectApplicant: (id: string) => void;
}

function getName(a: Applicant): string {
  return a.name || (a[`linkedin_name`] as string) || a.email || "No name";
}

function statusLabel(s: string) {
  switch (s) {
    case "accepted": return "Accepted";
    case "rejected": return "Rejected";
    case "waitlisted": return "Waitlisted";
    default: return "Pending";
  }
}

function statusDot(s: string) {
  switch (s) {
    case "accepted": return "bg-emerald-500";
    case "rejected": return "bg-red-500";
    case "waitlisted": return "bg-amber-500";
    default: return "bg-blue-500";
  }
}

export function ProfileSwipeView({
  applicants,
  statusFilter,
  sessionId,
  onStatusChange,
}: ProfileSwipeViewProps) {
  const [index, setIndex] = useState(0);
  const [showKeys, setShowKeys] = useState(false);
  const [animDir, setAnimDir] = useState<"left" | "right" | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Whitelist / blacklist
  const [wlEmails, setWlEmails] = useState<Set<string>>(new Set());
  const [blEmails, setBlEmails] = useState<Set<string>>(new Set());
  const [wlUrls, setWlUrls] = useState<Set<string>>(new Set());
  const [blUrls, setBlUrls] = useState<Set<string>>(new Set());

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
    } catch { /* ignore */ }
  }, [sessionId]);

  useEffect(() => { loadLists(); }, [loadLists]);

  const filtered = applicants.filter((a) => statusFilter === "all" || a.status === statusFilter);
  const sorted = [...filtered].sort((a, b) => getName(a).localeCompare(getName(b)));
  const current = sorted[index];

  const isWl = (a: Applicant) => {
    const e = (a.email || "").toLowerCase(), u = (a.linkedin_url || "").toLowerCase();
    return (e && wlEmails.has(e)) || (u && wlUrls.has(u));
  };
  const isBl = (a: Applicant) => {
    const e = (a.email || "").toLowerCase(), u = (a.linkedin_url || "").toLowerCase();
    return (e && blEmails.has(e)) || (u && blUrls.has(u));
  };

  const advance = useCallback((dir: "left" | "right") => {
    setAnimDir(dir);
    setTimeout(() => {
      if (index < sorted.length - 1) setIndex(index + 1);
      setAnimDir(null);
    }, 150);
  }, [index, sorted.length]);

  const addToList = async (a: Applicant, list: "whitelist" | "blacklist") => {
    const email = (a.email || "").toLowerCase(), url = (a.linkedin_url || "").toLowerCase();
    const nwE = new Set(wlEmails), nwU = new Set(wlUrls), nbE = new Set(blEmails), nbU = new Set(blUrls);
    if (list === "whitelist") {
      if (email) { nwE.add(email); nbE.delete(email); }
      if (url) { nwU.add(url); nbU.delete(url); }
    } else {
      if (email) { nbE.add(email); nwE.delete(email); }
      if (url) { nbU.add(url); nwU.delete(url); }
    }
    setWlEmails(nwE); setWlUrls(nwU); setBlEmails(nbE); setBlUrls(nbU);
    try {
      await Promise.all([
        api.updateSessionWhitelist(sessionId, { emails: [...nwE], linkedin_urls: [...nwU] }),
        api.updateSessionBlacklist(sessionId, { emails: [...nbE], linkedin_urls: [...nbU] }),
      ]);
    } catch { toast.error("Failed to update list"); loadLists(); }
    advance(list === "whitelist" ? "right" : "left");
  };

  const handleAccept = (a: Applicant) => { onStatusChange(a.applicant_id, "accepted"); advance("right"); };
  const handleReject = (a: Applicant) => { onStatusChange(a.applicant_id, "rejected"); advance("left"); };
  const handlePass = () => advance("right");

  // Keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!current) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      switch (e.key) {
        case "ArrowRight": case "d": handleAccept(current); break;
        case "ArrowLeft": case "a": handleReject(current); break;
        case " ": case "s": case "ArrowDown": e.preventDefault(); handlePass(); break;
        case "ArrowUp": case "w": if (index > 0) setIndex(index - 1); break;
        case "e": addToList(current, "whitelist"); break;
        case "q": addToList(current, "blacklist"); break;
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  if (sorted.length === 0) {
    return <div className="text-center py-16 text-sm text-muted-foreground">No profiles to review.</div>;
  }
  if (!current) return null;

  const photo = (current[`linkedin_image`] as string) || (current[`photo_url`] as string) || "";
  const headline = (current[`linkedin_headline`] as string) || current.title || "";
  const about = (current[`linkedin_about`] as string) || "";
  const experience = (current[`linkedin_experience`] as string) || "";
  const education = (current[`linkedin_education`] as string) || "";
  const company = current.company || (current[`linkedin_company`] as string) || "";
  const location = current.location || (current[`linkedin_location`] as string) || "";
  const wl = isWl(current), bl = isBl(current);
  const wlCount = sorted.filter(isWl).length, blCount = sorted.filter(isBl).length;
  const acceptedCount = sorted.filter((a) => a.status === "accepted").length;
  const rejectedCount = sorted.filter((a) => a.status === "rejected").length;

  return (
    <div className="flex gap-6 items-start">
      {/* ── Main card area ── */}
      <div className="flex-1 flex flex-col items-center gap-3 max-w-2xl mx-auto">
        {/* Progress */}
        <div className="w-full flex items-center gap-3 text-xs text-muted-foreground">
          <span className="tabular-nums font-medium">{index + 1}/{sorted.length}</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${((index + 1) / sorted.length) * 100}%` }} />
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-500"><CheckCircle2 className="size-3" />{acceptedCount}</span>
            <span className="flex items-center gap-1 text-red-500"><XCircle className="size-3" />{rejectedCount}</span>
            {wlCount > 0 && <span className="flex items-center gap-1 text-emerald-400"><ShieldCheck className="size-3" />{wlCount}</span>}
            {blCount > 0 && <span className="flex items-center gap-1 text-red-400"><ShieldAlert className="size-3" />{blCount}</span>}
          </div>
          <button onClick={() => setShowKeys(!showKeys)} className="p-1 rounded hover:bg-muted" title="Keyboard shortcuts">
            <Keyboard className="size-3.5" />
          </button>
        </div>

        {/* Keyboard hint */}
        {showKeys && (
          <div className="w-full text-xs text-muted-foreground bg-muted/50 rounded-lg px-4 py-2 flex flex-wrap gap-x-4 gap-y-1">
            <span><kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">D</kbd> / <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">&rarr;</kbd> Accept</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">A</kbd> / <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">&larr;</kbd> Reject</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">Space</kbd> / <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">S</kbd> Pass</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">E</kbd> Whitelist</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">Q</kbd> Blacklist</span>
            <span><kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">W</kbd> / <kbd className="px-1 py-0.5 rounded bg-muted font-mono text-[10px]">&uarr;</kbd> Back</span>
          </div>
        )}

        {/* Card */}
        <div
          ref={cardRef}
          className={`w-full rounded-2xl border bg-card overflow-hidden transition-all duration-150 ${
            animDir === "left" ? "-translate-x-4 opacity-50" :
            animDir === "right" ? "translate-x-4 opacity-50" : ""
          } ${
            wl ? "ring-2 ring-emerald-500/30 border-emerald-500/20" :
            bl ? "ring-2 ring-red-500/30 border-red-500/20" :
            "border-border/50"
          }`}
        >
          {/* Profile header */}
          <div className="p-5">
            <div className="flex items-start gap-4">
              {photo ? (
                <img src={photo} alt="" className="size-16 rounded-xl object-cover shrink-0" />
              ) : (
                <div className="size-16 rounded-xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center shrink-0 text-2xl font-bold text-muted-foreground/60">
                  {getName(current).charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-foreground truncate">{getName(current)}</h2>
                {headline && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{headline}</p>}

                {/* Category + status badges */}
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {current.attendee_type && (() => {
                    const c = TYPE_COLORS[current.attendee_type] || "#6b7280";
                    return (
                      <Badge className="text-[10px] border" style={{ backgroundColor: `${c}20`, color: c, borderColor: `${c}40` }}>
                        {current.attendee_type_detail || current.attendee_type}
                      </Badge>
                    );
                  })()}
                  <span className="flex items-center gap-1.5 text-xs">
                    <span className={`size-2 rounded-full ${statusDot(current.status)}`} />
                    {statusLabel(current.status)}
                  </span>
                  {wl && <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px]"><ShieldCheck className="size-2.5 mr-0.5" />WL</Badge>}
                  {bl && <Badge className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px]"><ShieldAlert className="size-2.5 mr-0.5" />BL</Badge>}
                </div>
              </div>
            </div>
          </div>

          {/* Info chips */}
          <div className="px-5 pb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {company && <span className="flex items-center gap-1"><Building2 className="size-3" />{company}</span>}
            {location && <span className="flex items-center gap-1"><MapPin className="size-3" />{location}</span>}
            {current.email && <a href={`mailto:${current.email}`} className="flex items-center gap-1 hover:text-foreground"><Mail className="size-3" />{current.email}</a>}
            {current.linkedin_url && <a href={current.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-500 hover:text-blue-400"><Linkedin className="size-3" />Profile<ExternalLink className="size-2.5" /></a>}
          </div>

          {/* Content sections — only show if data exists */}
          {(about || experience || education) && (
            <div className="px-5 pb-4 space-y-3 border-t border-border/30 pt-3">
              {about && (
                <div>
                  <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">About</h4>
                  <p className="text-sm text-foreground/80 leading-relaxed line-clamp-3">{about}</p>
                </div>
              )}
              {experience && (
                <div>
                  <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1"><Briefcase className="size-3" />Experience</h4>
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line line-clamp-4">{experience}</p>
                </div>
              )}
              {education && (
                <div>
                  <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-1"><GraduationCap className="size-3" />Education</h4>
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-line line-clamp-2">{education}</p>
                </div>
              )}
            </div>
          )}

          {/* AI reasoning — truncated, only show if exists */}
          {current.ai_reasoning && (
            <div className="px-5 pb-4">
              <div className="rounded-lg bg-gold/5 border border-gold/10 p-3">
                <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3 flex items-start gap-1.5">
                  <Sparkles className="size-3 mt-0.5 shrink-0 text-gold" />
                  {current.ai_reasoning.includes(" | ")
                    ? current.ai_reasoning.split(" | ")[0].replace(/^.*?\]:\s*/, "")
                    : current.ai_reasoning}
                </p>
              </div>
            </div>
          )}

          {/* ── Primary actions: Accept / Pass / Reject ── */}
          <div className="border-t border-border/50 p-3 flex items-center gap-2">
            <button
              onClick={() => handleReject(current)}
              className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-medium border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <XCircle className="size-4" /> Reject
            </button>
            <button
              onClick={handlePass}
              className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-medium border border-border/50 text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <SkipForward className="size-4" /> Pass
            </button>
            <button
              onClick={() => handleAccept(current)}
              className="flex-1 h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-medium border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 transition-colors"
            >
              <CheckCircle2 className="size-4" /> Accept
            </button>
          </div>

          {/* ── Secondary: Whitelist / Blacklist ── */}
          <div className="px-3 pb-3 flex items-center gap-2">
            <button
              onClick={() => addToList(current, "blacklist")}
              className={`flex-1 h-8 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium transition-colors ${
                bl ? "bg-red-600 text-white" : "text-muted-foreground hover:text-red-500 hover:bg-red-500/5"
              }`}
            >
              <ShieldAlert className="size-3" />{bl ? "Blacklisted" : "Blacklist"}
            </button>
            <button
              onClick={() => addToList(current, "whitelist")}
              className={`flex-1 h-8 rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium transition-colors ${
                wl ? "bg-emerald-600 text-white" : "text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/5"
              }`}
            >
              <ShieldCheck className="size-3" />{wl ? "Whitelisted" : "Whitelist"}
            </button>
          </div>
        </div>

        {/* Nav */}
        <div className="flex items-center gap-4">
          <button disabled={index === 0} onClick={() => setIndex(index - 1)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
            <ChevronLeft className="size-4" />Prev
          </button>
          <button disabled={index >= sorted.length - 1} onClick={() => setIndex(index + 1)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
            Next<ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* ── Mini sidebar list (desktop) ── */}
      <div className="hidden lg:block w-56 shrink-0 space-y-1 max-h-[calc(100vh-200px)] overflow-y-auto rounded-xl border border-border/50 p-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-2 py-1">All Guests</p>
        {sorted.map((a, i) => {
          const active = i === index;
          const photo = (a[`linkedin_image`] as string) || "";
          return (
            <button
              key={a.applicant_id}
              onClick={() => setIndex(i)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                active ? "bg-gold/10" : "hover:bg-muted/50"
              }`}
            >
              {photo ? (
                <img src={photo} alt="" className="size-6 rounded-full object-cover shrink-0" />
              ) : (
                <div className="size-6 rounded-full bg-muted flex items-center justify-center shrink-0 text-[10px] font-medium text-muted-foreground">
                  {getName(a).charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-xs truncate ${active ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                  {getName(a)}
                </p>
              </div>
              <span className={`size-2 rounded-full shrink-0 ${statusDot(a.status)}`} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
