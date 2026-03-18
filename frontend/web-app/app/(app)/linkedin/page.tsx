"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Search, X, Loader2, ExternalLink, BarChart3, ChevronDown, ChevronUp,
  Building2, MapPin, GraduationCap, Briefcase, User, Image, FileText,
  Sparkles, Key, Eye, EyeOff, LayoutGrid, List, Linkedin, ArrowUpDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Profile {
  url: string;
  name: string;
  headline: string;
  location: string;
  company: string;
  photo_url: string;
  about: string;
  experience: string;
  education: string;
  [key: string]: unknown;
}

const CATEGORIES = [
  { key: "all", label: "All", color: "#888" },
  { key: "vc", label: "VC", color: "#f59e0b" },
  { key: "founder", label: "Founder", color: "#8b5cf6" },
  { key: "engineer", label: "Engineer", color: "#3b82f6" },
  { key: "pm", label: "PM", color: "#10b981" },
  { key: "student", label: "Student", color: "#6366f1" },
  { key: "press", label: "Press", color: "#ec4899" },
  { key: "other", label: "Other", color: "#6b7280" },
];

export default function LinkedInPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [view, setView] = useState<"list" | "cards">("list");
  const [sortBy, setSortBy] = useState<"rank" | "name">("rank");

  const [apiKey, setApiKey] = useState(() => typeof window !== "undefined" ? localStorage.getItem("ai_api_key") || "" : "");
  const [showKey, setShowKey] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [sumProgress, setSumProgress] = useState<{ completed: number; total: number } | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API_URL}/linkedin/database`);
        const data = await res.json();
        setProfiles(data.items || []);
      } catch { toast.error("Failed to load"); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  // Category counts
  const catCounts = useMemo(() => {
    const counts: Record<string, number> = { all: profiles.length };
    for (const p of profiles) {
      const c = String(p.category || "other");
      counts[c] = (counts[c] || 0) + 1;
    }
    return counts;
  }, [profiles]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = profiles;
    if (category !== "all") list = list.filter(p => String(p.category || "other") === category);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => [p.name, p.headline, p.company, p.location, p.about].filter(Boolean).join(" ").toLowerCase().includes(q));
    }
    if (sortBy === "rank") {
      list = [...list].sort((a, b) => (Number(a.category_rank) || 999) - (Number(b.category_rank) || 999));
    } else {
      list = [...list].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    }
    return list;
  }, [profiles, category, search, sortBy]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Applicant Pool</h1>
          <p className="text-sm text-muted-foreground mt-1">{profiles.length} profiles</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Key className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <Input type={showKey ? "text" : "password"} value={apiKey}
              onChange={e => { setApiKey(e.target.value); localStorage.setItem("ai_api_key", e.target.value); }}
              placeholder="AI API key" className="h-8 w-[160px] pl-6 pr-7 text-[11px] font-mono" />
            <button onClick={() => setShowKey(!showKey)} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              {showKey ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
            </button>
          </div>
          <Button size="sm" disabled={summarizing || !apiKey}
            onClick={async () => {
              setSummarizing(true); setSumProgress(null);
              try {
                await api.summarizeAllProfiles(
                  { api_key: apiKey, model: "gpt-4o-mini", provider: "openai" },
                  {
                    onStart: (d) => setSumProgress({ completed: 0, total: d.total }),
                    onProgress: (d) => setSumProgress({ completed: d.completed, total: d.total }),
                    onError: (d) => setSumProgress({ completed: d.completed, total: d.total }),
                    onComplete: async () => { const res = await fetch(`${API_URL}/linkedin/database`); const data = await res.json(); setProfiles(data.items || []); toast.success("Done"); },
                  }
                );
              } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
              finally { setSummarizing(false); setSumProgress(null); }
            }}
            className="bg-gold text-gold-foreground hover:bg-gold/90">
            {summarizing ? <Loader2 className="size-3 mr-1.5 animate-spin" /> : <Sparkles className="size-3 mr-1.5" />}
            {summarizing ? "Running..." : "AI Summaries"}
          </Button>
        </div>
      </div>

      {sumProgress && (
        <div className="space-y-1">
          <Progress value={sumProgress.total > 0 ? (sumProgress.completed / sumProgress.total) * 100 : 0} className="h-1.5" />
          <p className="text-xs text-muted-foreground">{sumProgress.completed} / {sumProgress.total}</p>
        </div>
      )}

      {/* Category tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {CATEGORIES.map(cat => {
          const count = catCounts[cat.key] || 0;
          if (cat.key !== "all" && count === 0) return null;
          const active = category === cat.key;
          return (
            <button key={cat.key} onClick={() => setCategory(cat.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                active ? "text-white" : "text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted"
              }`}
              style={active ? { backgroundColor: cat.color } : undefined}>
              {cat.label}
              <span className={`tabular-nums ${active ? "text-white/70" : "text-muted-foreground/60"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Controls: search + view toggle + sort */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-9 h-8 text-sm" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="size-3.5 text-muted-foreground" /></button>}
        </div>
        <p className="text-xs text-muted-foreground">{filtered.length}</p>
        <div className="flex items-center gap-0.5 border rounded-md p-0.5">
          <button onClick={() => setView("list")} className={`p-1 rounded ${view === "list" ? "bg-muted" : ""}`}><List className="size-3.5" /></button>
          <button onClick={() => setView("cards")} className={`p-1 rounded ${view === "cards" ? "bg-muted" : ""}`}><LayoutGrid className="size-3.5" /></button>
        </div>
        <button onClick={() => setSortBy(sortBy === "rank" ? "name" : "rank")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowUpDown className="size-3" />{sortBy === "rank" ? "Rank" : "A-Z"}
        </button>
      </div>

      {/* LIST VIEW */}
      {view === "list" && (
        <div className="space-y-1">
          {filtered.map((p, i) => {
            const rank = Number(p.category_rank) || i + 1;
            const cat = String(p.category || "other");
            const catInfo = CATEGORIES.find(c => c.key === cat) || CATEGORIES[CATEGORIES.length - 1];
            const summary = String(p.ai_summary || "");

            return (
              <div key={p.url} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
                {/* Rank */}
                <span className="text-sm font-bold tabular-nums text-muted-foreground/40 w-7 text-right shrink-0">
                  {category !== "all" ? rank : ""}
                </span>

                {/* Photo */}
                {p.photo_url ? <img src={p.photo_url} alt="" className="size-9 rounded-full object-cover shrink-0" />
                  : <div className="size-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-semibold text-muted-foreground/40">{(p.name || "?").charAt(0).toUpperCase()}</div>}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{p.name || "Unknown"}</span>
                    <Badge variant="outline" className="text-[9px] h-4 shrink-0" style={{ borderColor: catInfo.color, color: catInfo.color }}>
                      {catInfo.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{p.headline || "—"}</p>
                </div>

                {/* Summary */}
                <p className="text-[10px] text-muted-foreground/60 truncate max-w-[250px] hidden lg:block">
                  {summary ? summary.split("\n")[0].replace("ROLE: ", "") : "—"}
                </p>

                {/* Link */}
                {p.url && (
                  <a href={p.url.startsWith("http") ? p.url : `https://${p.url}`} target="_blank" rel="noopener noreferrer"
                    className="text-muted-foreground/30 hover:text-blue-500 shrink-0">
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CARD VIEW */}
      {view === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((p, i) => {
            const rank = Number(p.category_rank) || i + 1;
            const cat = String(p.category || "other");
            const catInfo = CATEGORIES.find(c => c.key === cat) || CATEGORIES[CATEGORIES.length - 1];
            const summary = String(p.ai_summary || "");
            const summaryLines = summary.split("\n").filter(Boolean);

            return (
              <Card key={p.url} className="group hover:border-border/80 transition-all">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start gap-3">
                    {/* Rank + Photo */}
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      {category !== "all" && (
                        <span className="text-lg font-bold tabular-nums text-muted-foreground/30">#{rank}</span>
                      )}
                      {p.photo_url ? <img src={p.photo_url} alt="" className="size-11 rounded-full object-cover" />
                        : <div className="size-11 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground/40">{(p.name || "?").charAt(0).toUpperCase()}</div>}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate">{p.name || "Unknown"}</span>
                        <Badge variant="outline" className="text-[9px] h-4 shrink-0" style={{ borderColor: catInfo.color, color: catInfo.color }}>
                          {catInfo.label}
                        </Badge>
                      </div>
                      {p.headline && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.headline}</p>}
                      {(p.company || p.location) && (
                        <div className="flex gap-2 mt-1 text-[10px] text-muted-foreground/60">
                          {p.company && <span className="flex items-center gap-0.5"><Building2 className="size-2.5" />{p.company}</span>}
                          {p.location && <span className="flex items-center gap-0.5"><MapPin className="size-2.5" />{p.location}</span>}
                        </div>
                      )}
                    </div>

                    {p.url && (
                      <a href={p.url.startsWith("http") ? p.url : `https://${p.url}`} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground/20 hover:text-blue-500 shrink-0 mt-1">
                        <Linkedin className="size-3.5" />
                      </a>
                    )}
                  </div>

                  {/* AI Summary */}
                  {summaryLines.length > 0 && (
                    <div className="space-y-0.5 text-[10px] text-muted-foreground/70">
                      {summaryLines.map((line, j) => (
                        <p key={j} className="leading-relaxed">
                          {line.startsWith("ROLE:") ? <><span className="font-semibold text-foreground/60">Role:</span> {line.replace("ROLE: ", "")}</> :
                           line.startsWith("BACKGROUND:") ? <><span className="font-semibold text-foreground/60">Background:</span> {line.replace("BACKGROUND: ", "")}</> :
                           line.startsWith("EVENT FIT:") ? <><span className="font-semibold text-foreground/60">Fit:</span> {line.replace("EVENT FIT: ", "")}</> :
                           line}
                        </p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No profiles match.</p>}
    </div>
  );
}
