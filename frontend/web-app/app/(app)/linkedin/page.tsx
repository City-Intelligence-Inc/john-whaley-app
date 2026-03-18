"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Linkedin,
  Search,
  X,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
        return [p.name, p.headline, p.company, p.location]
          .filter(Boolean).join(" ").toLowerCase().includes(q);
      })
    : profiles;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Applicant Pool</h1>
          <p className="text-sm text-muted-foreground mt-1">{profiles.length} profiles scraped</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search profiles..." className="pl-9 h-9" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="size-4 text-muted-foreground" /></button>}
        </div>
        <p className="text-xs text-muted-foreground">{filtered.length} results</p>
      </div>

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
                    <a href={p.url} target="_blank" rel="noopener noreferrer"
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
