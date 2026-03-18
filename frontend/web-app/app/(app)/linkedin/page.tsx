"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Search, X, Loader2, ExternalLink, BarChart3, ChevronDown,
  Building2, MapPin, GraduationCap, Briefcase, User, Image, FileText,
  Sparkles, Key, Eye, EyeOff,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface LinkedInProfile {
  url: string;
  name: string;
  headline: string;
  location: string;
  company: string;
  photo_url: string;
  about: string;
  experience: string;
  education: string;
  issues?: string[];
  [key: string]: unknown;
}

export default function LinkedInPage() {
  const [profiles, setProfiles] = useState<LinkedInProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
      } catch {
        toast.error("Failed to load LinkedIn database");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = search.trim()
    ? profiles.filter((p) => {
        const q = search.toLowerCase();
        return [p.name, p.headline, p.company, p.location, p.about]
          .filter(Boolean).join(" ").toLowerCase().includes(q);
      })
    : profiles;

  // Stats
  const stats = useMemo(() => {
    const total = profiles.length;
    if (!total) return null;
    const has = (field: string) => profiles.filter(p => p[field]).length;
    return {
      total,
      photo: has("photo_url"),
      headline: has("headline"),
      about: has("about"),
      experience: has("experience"),
      education: has("education"),
      company: has("company"),
      location: has("location"),
    };
  }, [profiles]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

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
                    onComplete: async () => {
                      const res = await fetch(`${API_URL}/linkedin/database`);
                      const data = await res.json();
                      setProfiles(data.items || []);
                      toast.success("Summaries generated");
                    },
                  }
                );
              } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
              finally { setSummarizing(false); setSumProgress(null); }
            }}
            className="bg-gold text-gold-foreground hover:bg-gold/90">
            {summarizing ? <Loader2 className="size-3 mr-1.5 animate-spin" /> : <Sparkles className="size-3 mr-1.5" />}
            {summarizing ? "Summarizing..." : "Generate Summaries"}
          </Button>
        </div>
      </div>

      {/* Summary progress */}
      {sumProgress && (
        <div className="space-y-1">
          <Progress value={sumProgress.total > 0 ? (sumProgress.completed / sumProgress.total) * 100 : 0} className="h-1.5" />
          <p className="text-xs text-muted-foreground">{sumProgress.completed} / {sumProgress.total}</p>
        </div>
      )}

      {/* Stats (collapsible) */}
      {stats && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <BarChart3 className="size-4" />
            <span>Database Stats</span>
            <ChevronDown className="size-3" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2">
              <CardContent className="p-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: User, label: "Total", value: stats.total, pct: 100 },
                    { icon: Image, label: "Photo", value: stats.photo, pct: Math.round(stats.photo / stats.total * 100) },
                    { icon: FileText, label: "Headline", value: stats.headline, pct: Math.round(stats.headline / stats.total * 100) },
                    { icon: Building2, label: "Company", value: stats.company, pct: Math.round(stats.company / stats.total * 100) },
                    { icon: MapPin, label: "Location", value: stats.location, pct: Math.round(stats.location / stats.total * 100) },
                    { icon: Briefcase, label: "Experience", value: stats.experience, pct: Math.round(stats.experience / stats.total * 100) },
                    { icon: GraduationCap, label: "Education", value: stats.education, pct: Math.round(stats.education / stats.total * 100) },
                    { icon: FileText, label: "About", value: stats.about, pct: Math.round(stats.about / stats.total * 100) },
                  ].map(({ icon: Icon, label, value, pct }) => (
                    <div key={label} className="flex items-center gap-2">
                      <Icon className="size-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-muted-foreground">{label}</span>
                          <span className="text-xs font-medium tabular-nums">{value}</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full mt-0.5">
                          <div className="h-full bg-gold rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{pct}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search profiles..." className="pl-9 h-9" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="size-4 text-muted-foreground" /></button>}
        </div>
        <p className="text-xs text-muted-foreground">{filtered.length} results</p>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px] sticky left-0 bg-background z-10">Profile</TableHead>
              <TableHead className="min-w-[200px]">Headline</TableHead>
              <TableHead className="min-w-[120px]">Company</TableHead>
              <TableHead className="min-w-[140px]">Location</TableHead>
              <TableHead className="min-w-[200px]">Experience</TableHead>
              <TableHead className="min-w-[160px]">Education</TableHead>
              <TableHead className="min-w-[200px]">About</TableHead>
              <TableHead className="min-w-[200px]">AI Summary</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.url}>
                <TableCell className="sticky left-0 bg-background z-10">
                  <div className="flex items-center gap-3">
                    {p.photo_url ? (
                      <img src={p.photo_url} alt="" className="size-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-medium text-muted-foreground">
                        {(p.name || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <p className="font-medium text-sm truncate max-w-[140px]">{p.name || "Unknown"}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-muted-foreground line-clamp-2">{p.headline || "—"}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-muted-foreground truncate">{p.company || "—"}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-muted-foreground truncate">{p.location || "—"}</p>
                </TableCell>
                <TableCell>
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.experience ? p.experience.split("\n")[0] : "—"}</p>
                </TableCell>
                <TableCell>
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.education ? p.education.split("\n")[0] : "—"}</p>
                </TableCell>
                <TableCell>
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.about ? p.about.slice(0, 120) : "—"}</p>
                </TableCell>
                <TableCell>
                  {(p as Record<string, unknown>).ai_summary ? (
                    <p className="text-xs text-muted-foreground line-clamp-3 flex items-start gap-1">
                      <Sparkles className="size-3 mt-0.5 shrink-0 text-gold" />
                      {String((p as Record<string, unknown>).ai_summary)}
                    </p>
                  ) : (
                    <span className="text-xs text-muted-foreground/30">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {p.url && (
                    <a href={p.url.startsWith("http") ? p.url : `https://${p.url}`} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700">
                      <ExternalLink className="size-4" />
                    </a>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
