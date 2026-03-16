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
  ShieldCheck,
  ShieldAlert,
  SkipForward,
  ExternalLink,
  Briefcase,
  Info,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Applicant } from "@/lib/api";

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

export function ProfileSwipeView({
  applicants,
  statusFilter,
  sessionId,
  onStatusChange,
  onSelectApplicant,
}: ProfileSwipeViewProps) {
  const [index, setIndex] = useState(0);
  const [showTutorial, setShowTutorial] = useState(true);

  // Whitelist / blacklist
  const [whitelistEmails, setWhitelistEmails] = useState<Set<string>>(new Set());
  const [blacklistEmails, setBlacklistEmails] = useState<Set<string>>(new Set());
  const [whitelistUrls, setWhitelistUrls] = useState<Set<string>>(new Set());
  const [blacklistUrls, setBlacklistUrls] = useState<Set<string>>(new Set());

  const loadLists = useCallback(async () => {
    try {
      const [wl, bl] = await Promise.all([
        api.getSessionWhitelist(sessionId),
        api.getSessionBlacklist(sessionId),
      ]);
      setWhitelistEmails(new Set((wl.emails || []).map((e: string) => e.toLowerCase())));
      setBlacklistEmails(new Set((bl.emails || []).map((e: string) => e.toLowerCase())));
      setWhitelistUrls(new Set((wl.linkedin_urls || []).map((u: string) => u.toLowerCase())));
      setBlacklistUrls(new Set((bl.linkedin_urls || []).map((u: string) => u.toLowerCase())));
    } catch { /* ignore */ }
  }, [sessionId]);

  useEffect(() => { loadLists(); }, [loadLists]);

  // Dismiss tutorial after first interaction or localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("swipe_tutorial_seen")) {
      setShowTutorial(false);
    }
  }, []);

  const dismissTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem("swipe_tutorial_seen", "1");
  };

  const filtered = applicants.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const current = sorted[index];

  const isWhitelisted = (a: Applicant) => {
    const email = (a.email || "").toLowerCase();
    const url = (a.linkedin_url || "").toLowerCase();
    return (email && whitelistEmails.has(email)) || (url && whitelistUrls.has(url));
  };

  const isBlacklisted = (a: Applicant) => {
    const email = (a.email || "").toLowerCase();
    const url = (a.linkedin_url || "").toLowerCase();
    return (email && blacklistEmails.has(email)) || (url && blacklistUrls.has(url));
  };

  const addToList = async (a: Applicant, list: "whitelist" | "blacklist") => {
    const email = (a.email || "").toLowerCase();
    const url = (a.linkedin_url || "").toLowerCase();

    const newWlEmails = new Set(whitelistEmails);
    const newWlUrls = new Set(whitelistUrls);
    const newBlEmails = new Set(blacklistEmails);
    const newBlUrls = new Set(blacklistUrls);

    if (list === "whitelist") {
      if (email) { newWlEmails.add(email); newBlEmails.delete(email); }
      if (url) { newWlUrls.add(url); newBlUrls.delete(url); }
    } else {
      if (email) { newBlEmails.add(email); newWlEmails.delete(email); }
      if (url) { newBlUrls.add(url); newWlUrls.delete(url); }
    }

    setWhitelistEmails(newWlEmails);
    setWhitelistUrls(newWlUrls);
    setBlacklistEmails(newBlEmails);
    setBlacklistUrls(newBlUrls);

    try {
      await Promise.all([
        api.updateSessionWhitelist(sessionId, { emails: [...newWlEmails], linkedin_urls: [...newWlUrls] }),
        api.updateSessionBlacklist(sessionId, { emails: [...newBlEmails], linkedin_urls: [...newBlUrls] }),
      ]);
      toast.success(
        list === "whitelist"
          ? `Whitelisted ${getName(a)}`
          : `Blacklisted ${getName(a)}`
      );
    } catch {
      toast.error("Failed to update list");
      loadLists();
    }

    // Auto-advance
    if (index < sorted.length - 1) setIndex(index + 1);
  };

  const skip = () => {
    if (index < sorted.length - 1) setIndex(index + 1);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!current || showTutorial) return;
      if (e.key === "ArrowRight" || e.key === "d") {
        addToList(current, "whitelist");
      } else if (e.key === "ArrowLeft" || e.key === "a") {
        addToList(current, "blacklist");
      } else if (e.key === "ArrowDown" || e.key === "s" || e.key === " ") {
        e.preventDefault();
        skip();
      } else if (e.key === "ArrowUp" || e.key === "w") {
        if (index > 0) setIndex(index - 1);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  if (sorted.length === 0) {
    return (
      <div className="text-center py-16 text-sm text-muted-foreground">
        No profiles to review with the current filter.
      </div>
    );
  }

  if (!current) return null;

  const photo = (current[`linkedin_image`] as string) || (current[`photo_url`] as string) || "";
  const headline = (current[`linkedin_headline`] as string) || current.title || "";
  const about = (current[`linkedin_about`] as string) || "";
  const experience = (current[`linkedin_experience`] as string) || "";
  const education = (current[`linkedin_education`] as string) || "";
  const company = current.company || (current[`linkedin_company`] as string) || "";
  const location = current.location || (current[`linkedin_location`] as string) || "";
  const wl = isWhitelisted(current);
  const bl = isBlacklisted(current);

  const wlCount = sorted.filter(isWhitelisted).length;
  const blCount = sorted.filter(isBlacklisted).length;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Tutorial overlay */}
      {showTutorial && (
        <div className="w-full max-w-xl rounded-xl border border-gold/30 bg-gold/5 p-5 relative">
          <button
            onClick={dismissTutorial}
            className="absolute top-3 right-3 p-1 rounded-md hover:bg-muted text-muted-foreground"
          >
            <X className="size-4" />
          </button>
          <div className="flex items-start gap-3">
            <Info className="size-5 text-gold shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-foreground">Review profiles one at a time</p>
              <div className="text-muted-foreground space-y-1">
                <p>Go through each attendee and decide who gets priority access:</p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="size-4 text-emerald-500" />
                    <span><strong>Whitelist</strong> = auto-accept in analysis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="size-4 text-red-500" />
                    <span><strong>Blacklist</strong> = auto-reject in analysis</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <SkipForward className="size-4 text-muted-foreground" />
                    <span><strong>Skip</strong> = let AI decide</span>
                  </div>
                </div>
                <p className="text-xs mt-2 text-muted-foreground/70">
                  Keyboard: <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">D</kbd> or <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">→</kbd> whitelist
                  {" "}<kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">A</kbd> or <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">←</kbd> blacklist
                  {" "}<kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">S</kbd> or <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Space</kbd> skip
                  {" "}<kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">W</kbd> or <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">↑</kbd> go back
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full max-w-xl flex items-center gap-3 text-xs text-muted-foreground">
        <span className="tabular-nums font-medium">{index + 1} / {sorted.length}</span>
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-gold rounded-full transition-all"
            style={{ width: `${((index + 1) / sorted.length) * 100}%` }}
          />
        </div>
        <div className="flex items-center gap-3">
          {wlCount > 0 && (
            <span className="flex items-center gap-1 text-emerald-500">
              <ShieldCheck className="size-3" />{wlCount}
            </span>
          )}
          {blCount > 0 && (
            <span className="flex items-center gap-1 text-red-500">
              <ShieldAlert className="size-3" />{blCount}
            </span>
          )}
        </div>
      </div>

      {/* Card */}
      <div className={`w-full max-w-xl rounded-2xl border bg-card/80 overflow-hidden transition-all ${
        wl ? "ring-2 ring-emerald-500/40 border-emerald-500/30" :
        bl ? "ring-2 ring-red-500/40 border-red-500/30" :
        "border-border/50"
      }`}>
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-start gap-4">
            {photo ? (
              <img
                src={photo}
                alt=""
                className="size-20 rounded-xl object-cover shrink-0 ring-2 ring-border/50"
              />
            ) : (
              <div className="size-20 rounded-xl bg-muted flex items-center justify-center shrink-0 text-2xl font-bold text-muted-foreground">
                {getName(current).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-foreground truncate">
                {getName(current)}
              </h2>
              {headline && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{headline}</p>
              )}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {wl && (
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                    <ShieldCheck className="size-3 mr-1" /> Whitelisted
                  </Badge>
                )}
                {bl && (
                  <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
                    <ShieldAlert className="size-3 mr-1" /> Blacklisted
                  </Badge>
                )}
                {current.attendee_type && (
                  <Badge variant="outline" className="text-xs">
                    {current.attendee_type_detail || current.attendee_type}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="px-6 pb-4 space-y-3">
          {/* Info chips */}
          <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
            {company && (
              <span className="flex items-center gap-1.5">
                <Building2 className="size-3.5" />{company}
              </span>
            )}
            {location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-3.5" />{location}
              </span>
            )}
            {current.email && (
              <a href={`mailto:${current.email}`} className="flex items-center gap-1.5 hover:text-foreground">
                <Mail className="size-3.5" />{current.email}
              </a>
            )}
            {current.linkedin_url && (
              <a href={current.linkedin_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-blue-500 hover:text-blue-400">
                <Linkedin className="size-3.5" />LinkedIn <ExternalLink className="size-3" />
              </a>
            )}
          </div>

          {/* About */}
          {about && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">About</h4>
              <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4">{about}</p>
            </div>
          )}

          {/* Experience */}
          {experience && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <Briefcase className="size-3" /> Experience
              </h4>
              <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4 whitespace-pre-line">{experience}</p>
            </div>
          )}

          {/* Education */}
          {education && (
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                <GraduationCap className="size-3" /> Education
              </h4>
              <p className="text-sm text-foreground/80 leading-relaxed line-clamp-2 whitespace-pre-line">{education}</p>
            </div>
          )}

          {/* AI reasoning if exists */}
          {current.ai_reasoning && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-sm text-muted-foreground flex items-start gap-2">
                <Sparkles className="size-4 mt-0.5 shrink-0 text-gold" />
                {current.ai_reasoning}
              </p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="border-t border-border/50 p-4 flex items-center gap-3">
          <Button
            onClick={() => addToList(current, "blacklist")}
            variant={bl ? "default" : "outline"}
            className={`flex-1 h-12 text-base ${bl ? "bg-red-600 hover:bg-red-700 text-white" : "border-red-500/30 text-red-500 hover:bg-red-500/10"}`}
          >
            <ShieldAlert className="size-5 mr-2" />
            Blacklist
          </Button>

          <Button
            onClick={skip}
            variant="outline"
            className="h-12 px-6 text-base border-border/50"
          >
            <SkipForward className="size-5 mr-1" />
            Skip
          </Button>

          <Button
            onClick={() => addToList(current, "whitelist")}
            variant={wl ? "default" : "outline"}
            className={`flex-1 h-12 text-base ${wl ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10"}`}
          >
            <ShieldCheck className="size-5 mr-2" />
            Whitelist
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={index === 0}
          onClick={() => setIndex(index - 1)}
          className="text-muted-foreground"
        >
          <ChevronLeft className="size-4 mr-1" /> Previous
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={index >= sorted.length - 1}
          onClick={() => setIndex(index + 1)}
          className="text-muted-foreground"
        >
          Next <ChevronRight className="size-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
