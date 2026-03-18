"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Mail,
  Linkedin,
  MapPin,
  Building2,
  GraduationCap,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Briefcase,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  onCategorize?: (id: string, type: string) => void;
  onBlacklist?: (email: string) => void;
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
  onStatusChange,
  onCategorize,
  onBlacklist,
}: ProfileSwipeViewProps) {
  const [index, setIndex] = useState(0);

  const filtered = applicants.filter((a) => statusFilter === "all" || a.status === statusFilter);
  const sorted = [...filtered].sort((a, b) => getName(a).localeCompare(getName(b)));
  const current = sorted[index];

  // Counts for all applicants (not just filtered)
  const acceptedCount = applicants.filter((a) => a.status === "accepted").length;
  const rejectedCount = applicants.filter((a) => a.status === "rejected").length;
  const waitlistedCount = applicants.filter((a) => a.status === "waitlisted").length;
  const pendingCount = applicants.filter((a) => a.status === "pending").length;

  const advance = useCallback(() => {
    if (index < sorted.length - 1) setIndex(index + 1);
  }, [index, sorted.length]);

  const handleAction = useCallback((status: string) => {
    if (!current) return;
    onStatusChange(current.applicant_id, status);
    advance();
  }, [current, onStatusChange, advance]);

  // Keyboard
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (!current) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON") return;
      switch (e.key) {
        case "ArrowRight": case "d": e.preventDefault(); handleAction("accepted"); break;
        case "ArrowLeft": case "a": e.preventDefault(); handleAction("rejected"); break;
        case "ArrowDown": case "s": e.preventDefault(); handleAction("waitlisted"); break;
        case " ": e.preventDefault(); advance(); break;
        case "ArrowUp": case "w": if (index > 0) setIndex(index - 1); break;
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
  const isUnclassified = !current.attendee_type;

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
        </div>

        {/* Card */}
        <div className="w-full rounded-2xl border border-border/50 bg-card overflow-hidden">
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
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-foreground truncate">{getName(current)}</h2>
                  <span className="text-lg font-bold tabular-nums text-muted-foreground">#{index + 1}</span>
                </div>
                {headline && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{headline}</p>}

                {/* Category + status */}
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
                </div>
              </div>
            </div>
          </div>

          {/* Classify if unclassified */}
          {isUnclassified && onCategorize && (
            <div className="px-5 pb-3">
              <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 flex items-center gap-3">
                <span className="text-xs text-amber-500 font-medium shrink-0">Unclassified</span>
                <Select onValueChange={(val) => onCategorize(current.applicant_id, val)}>
                  <SelectTrigger className="h-7 flex-1 text-xs">
                    <SelectValue placeholder="Assign category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ATTENDEE_TYPES.map((t) => (
                      <SelectItem key={t.key} value={t.key} className="text-xs">
                        <div className="flex items-center gap-2">
                          <div className="size-2 rounded-full" style={{ backgroundColor: t.color }} />
                          {t.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Info chips */}
          <div className="px-5 pb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {company && <span className="flex items-center gap-1"><Building2 className="size-3" />{company}</span>}
            {location && <span className="flex items-center gap-1"><MapPin className="size-3" />{location}</span>}
            {current.email && <a href={`mailto:${current.email}`} className="flex items-center gap-1 hover:text-foreground"><Mail className="size-3" />{current.email}</a>}
            {current.linkedin_url && <a href={current.linkedin_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-500 hover:text-blue-400"><Linkedin className="size-3" />Profile<ExternalLink className="size-2.5" /></a>}
          </div>

          {/* Content sections */}
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

          {/* AI / Judge decisions */}
          {current.ai_reasoning && (
            <div className="px-5 pb-4 space-y-2">
              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                <Sparkles className="size-3 text-gold" />
                {current.panel_votes ? "Judge Panel" : "AI Assessment"}
                {current.panel_votes && (
                  <span className="ml-auto text-xs font-medium text-foreground">{current.panel_votes} votes</span>
                )}
              </h4>
              {current.ai_reasoning.includes(" | ") ? (
                // Panel mode: show each judge's decision
                <div className="space-y-1.5">
                  {current.ai_reasoning.split(" | ").map((part, i) => {
                    const match = part.match(/^(.+?)\s*\[(ACCEPT|PASS)\]:\s*(.*)$/);
                    if (!match) return null;
                    const [, judgeName, decision, reasoning] = match;
                    const isAccept = decision === "ACCEPT";
                    return (
                      <div key={i} className={`rounded-lg p-2.5 text-xs ${isAccept ? "bg-emerald-500/5 border border-emerald-500/15" : "bg-muted/30 border border-border/30"}`}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`font-semibold ${isAccept ? "text-emerald-400" : "text-muted-foreground"}`}>
                            {isAccept ? "ACCEPT" : "PASS"}
                          </span>
                          <span className="text-muted-foreground">{judgeName}</span>
                        </div>
                        <p className="text-foreground/70 leading-relaxed">{reasoning}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // Single reviewer mode
                <div className="rounded-lg bg-gold/5 border border-gold/10 p-2.5">
                  <p className="text-xs text-foreground/80 leading-relaxed">{current.ai_reasoning}</p>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="border-t border-border/50 p-3 flex items-center gap-2">
            {onBlacklist && current.email && (
              <button
                onClick={() => {
                  onBlacklist(current.email!);
                  handleAction("rejected");
                }}
                className="h-10 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
                title="Blacklist & reject — this person will be auto-rejected on future events"
              >
                <ShieldAlert className="size-3.5" />
              </button>
            )}
            <button
              onClick={() => handleAction("rejected")}
              className={`flex-1 h-10 rounded-xl flex items-center justify-center gap-1.5 text-sm font-medium transition-colors ${
                current.status === "rejected"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "border border-red-500/20 text-red-500 hover:bg-red-500/10"
              }`}
            >
              <XCircle className="size-4" /> Reject
            </button>
            <button
              onClick={() => handleAction("waitlisted")}
              className={`flex-1 h-10 rounded-xl flex items-center justify-center gap-1.5 text-sm font-medium transition-colors ${
                current.status === "waitlisted"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  : "border border-border/50 text-muted-foreground hover:bg-muted/50"
              }`}
            >
              <Clock className="size-4" /> Waitlist
            </button>
            <button
              onClick={() => handleAction("accepted")}
              className={`flex-1 h-10 rounded-xl flex items-center justify-center gap-1.5 text-sm font-medium transition-colors ${
                current.status === "accepted"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10"
              }`}
            >
              <CheckCircle2 className="size-4" /> Accept
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
          const sidePhoto = (a[`linkedin_image`] as string) || "";
          return (
            <button
              key={a.applicant_id}
              onClick={() => setIndex(i)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                active ? "bg-gold/10" : "hover:bg-muted/50"
              }`}
            >
              {sidePhoto ? (
                <img src={sidePhoto} alt="" className="size-6 rounded-full object-cover shrink-0" />
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

      {/* ── Floating progress bar ── */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card/95 backdrop-blur border border-border/50 rounded-2xl shadow-xl px-6 py-3 flex items-center gap-5">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-500">
          <CheckCircle2 className="size-4" />{acceptedCount}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-amber-500">
          <Clock className="size-4" />{waitlistedCount}
        </span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-red-500">
          <XCircle className="size-4" />{rejectedCount}
        </span>
        {pendingCount > 0 && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            {pendingCount} pending
          </span>
        )}
        <div className="h-4 w-px bg-border/50" />
        <span className="text-sm font-medium text-foreground">{applicants.length} total</span>
      </div>
    </div>
  );
}
