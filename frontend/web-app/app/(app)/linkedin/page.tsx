"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Search, X, Loader2, ExternalLink, BarChart3, ChevronDown,
  Building2, MapPin, GraduationCap, Briefcase, User, Image, FileText,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Applicant Pool</h1>
        <p className="text-sm text-muted-foreground mt-1">{profiles.length} profiles</p>
      </div>

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
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[250px]">Profile</TableHead>
              <TableHead>Headline</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="w-[60px]">Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((p) => (
              <TableRow key={p.url}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    {p.photo_url ? (
                      <img src={p.photo_url} alt="" className="size-8 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="size-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-medium text-muted-foreground">
                        {(p.name || "?").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{p.name || "Unknown"}</p>
                      {p.company && <p className="text-xs text-muted-foreground truncate">{p.company}</p>}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-muted-foreground truncate max-w-xs">{p.headline || "—"}</p>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-muted-foreground">{p.location || "—"}</p>
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
