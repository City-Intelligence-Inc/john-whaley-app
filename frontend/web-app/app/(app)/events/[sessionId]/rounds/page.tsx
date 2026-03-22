"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useEvent } from "@/components/event-provider";
import { api, type Applicant } from "@/lib/api";
import { CSVUploader } from "@/components/csv-uploader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ATTENDEE_TYPES } from "@/lib/constants";
import { toast } from "sonner";
import {
  Upload, Download, Loader2, Check, ChevronDown, ChevronUp,
  Play, RotateCcw, X as XIcon,
} from "lucide-react";

const STRONG = 55, WEAK = 30;

function getName(a: Applicant) {
  return (a.name as string) || (a.email as string)?.split("@")[0] || "Unknown";
}
function getTypeColor(t: string) {
  return ATTENDEE_TYPES.find((x) => x.key === t)?.color || "#6b7280";
}

export default function RoundsPage() {
  const router = useRouter();
  const { sessionId, session, applicants, refreshAll, loading } = useEvent();
  const [ranking, setRanking] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("claude-sonnet-4-20250514");
  const [runningJudges, setRunningJudges] = useState(false);
  const [judgesDone, setJudgesDone] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [topN, setTopN] = useState(20);

  useEffect(() => {
    const k = localStorage.getItem("selecta_api_key");
    if (k) setApiKey(k);
  }, []);

  const sorted = useMemo(
    () => [...applicants].sort((a, b) => (Number(b.rank_score) || 0) - (Number(a.rank_score) || 0)),
    [applicants],
  );

  const strong = useMemo(() => sorted.filter((a) => (Number(a.rank_score) || 0) >= STRONG), [sorted]);
  const review = useMemo(() => sorted.filter((a) => { const s = Number(a.rank_score) || 0; return s >= WEAK && s < STRONG; }), [sorted]);
  const weak = useMemo(() => sorted.filter((a) => (Number(a.rank_score) || 0) < WEAK), [sorted]);

  const counts = useMemo(() => {
    const c = { accepted: 0, rejected: 0, waitlisted: 0, pending: 0 };
    for (const a of applicants) { const s = (a.status as string) || "pending"; if (s in c) c[s as keyof typeof c]++; }
    return c;
  }, [applicants]);

  // ── Actions ──

  const handleUploaded = useCallback(async () => {
    setRanking(true);
    try {
      await api.rankSession(sessionId);
      await refreshAll();
      toast.success("Ranked");
    } catch (e) { toast.error(String(e)); }
    finally { setRanking(false); }
  }, [sessionId, refreshAll]);

  const bulk = useCallback(async (ids: string[], status: string) => {
    await api.batchUpdateStatus(ids, status);
    await refreshAll();
    toast.success(`${ids.length} → ${status}`);
  }, [refreshAll]);

  const runJudges = useCallback(async () => {
    if (!apiKey) { toast.error("Enter API key"); return; }
    localStorage.setItem("selecta_api_key", apiKey);
    setRunningJudges(true);
    const done = new Set<string>();
    for (const id of ["closer_rank", "hunter_rank", "overall_rank"]) {
      try {
        await api.rankApplicants(id, sessionId, { api_key: apiKey, model, provider });
        done.add(id);
        setJudgesDone(new Set(done));
      } catch (e) { toast.error(`${id}: ${e}`); }
    }
    await refreshAll();
    setRunningJudges(false);
    toast.success("Judges done");
  }, [apiKey, model, provider, sessionId, refreshAll]);

  const exportCSV = useCallback(() => {
    const hdr = ["name", "email", "status", "attendee_type", "attendee_type_detail", "rank_score", "linkedin_url"];
    const rows = [hdr.join(","), ...sorted.map((a) =>
      hdr.map((h) => { const v = String((a as Record<string, unknown>)[h] || ""); return v.includes(",") ? `"${v}"` : v; }).join(",")
    )];
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    link.download = `${session?.name || "results"}.csv`;
    link.click();
  }, [sorted, session]);

  // ── Candidate row ──

  const row = (a: Applicant) => {
    const score = Number(a.rank_score) || 0;
    const status = (a.status as string) || "pending";
    const rec = a as Record<string, unknown>;
    return (
      <div key={a.applicant_id} className="flex items-center gap-3 px-3 py-1.5 hover:bg-muted/30 rounded group">
        <span className="text-xs font-mono w-7 text-right text-muted-foreground">{score}</span>
        <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: getTypeColor((a.attendee_type as string) || "other") }} />
        <div className="flex-1 min-w-0">
          <span className="text-sm truncate block">{getName(a)}</span>
          <span className="text-[10px] text-muted-foreground truncate block">{(a.attendee_type_detail as string) || ""}</span>
        </div>
        {rec.rank_overall_rank ? (
          <span className="text-[10px] text-muted-foreground hidden sm:block">
            C#{String(rec.rank_closer_rank)} H#{String(rec.rank_hunter_rank)} O#{String(rec.rank_overall_rank)}
          </span>
        ) : null}
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100">
          {status !== "accepted" && <button onClick={() => bulk([a.applicant_id], "accepted")} className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400"><Check className="size-3" /></button>}
          {status !== "rejected" && <button onClick={() => bulk([a.applicant_id], "rejected")} className="p-1 rounded hover:bg-red-500/20 text-red-400"><XIcon className="size-3" /></button>}
        </div>
        <Badge variant="outline" className={`text-[10px] ${status === "accepted" ? "text-emerald-400 border-emerald-500/30" : status === "rejected" ? "text-red-400 border-red-500/30" : "text-muted-foreground"}`}>
          {status}
        </Badge>
      </div>
    );
  };

  // ── Tier card ──

  const tier = (id: string, label: string, items: Applicant[], color: string, action?: string) => {
    const pending = items.filter((a) => a.status === "pending").map((a) => a.applicant_id);
    const open = expanded === id;
    return (
      <Card key={id} className="border-border/50">
        <div className="flex items-center justify-between px-4 py-2.5 cursor-pointer" onClick={() => setExpanded(open ? null : id)}>
          <div className="flex items-center gap-2">
            <Badge className={`${color} text-xs`}>{label}</Badge>
            <span className="text-sm">{items.length}</span>
          </div>
          <div className="flex items-center gap-2">
            {pending.length > 0 && action && (
              <Button size="sm" variant="ghost" className={`h-6 text-xs ${action === "accepted" ? "text-emerald-400" : "text-red-400"}`}
                onClick={(e) => { e.stopPropagation(); bulk(pending, action); }}>
                {action === "accepted" ? "Accept" : "Reject"} All ({pending.length})
              </Button>
            )}
            {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
          </div>
        </div>
        {open && <div className="border-t border-border/30 max-h-72 overflow-y-auto">{items.map(row)}</div>}
      </Card>
    );
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">{session?.name || "Selection"}</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push(`/events/${sessionId}`)}>Full Workspace</Button>
          {applicants.length > 0 && <Button size="sm" onClick={exportCSV}><Download className="size-3.5 mr-1.5" />Export</Button>}
        </div>
      </div>

      {/* Upload — only show if no candidates */}
      {applicants.length === 0 && (
        <Card>
          <CardContent className="pt-5">
            <CSVUploader sessionId={sessionId} onUploadSuccess={handleUploaded} />
            {ranking && (
              <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Ranking...
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Everything below only shows after upload */}
      {applicants.length > 0 && (
        <>
          {/* Status bar */}
          <div className="flex items-center gap-4 text-xs px-1">
            <span>{applicants.length} total</span>
            <span className="text-emerald-400">{counts.accepted} accepted</span>
            <span className="text-red-400">{counts.rejected} rejected</span>
            <span className="text-muted-foreground">{counts.pending} pending</span>
            <div className="flex-1" />
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={async () => { setRanking(true); await api.rankSession(sessionId); await refreshAll(); setRanking(false); }} disabled={ranking}>
              {ranking ? <Loader2 className="size-3 mr-1 animate-spin" /> : <RotateCcw className="size-3 mr-1" />} Re-rank
            </Button>
          </div>

          {/* ── ROUND 1: Tiers ── */}
          <div className="space-y-2">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Round 1 — Auto-Ranked Tiers</h2>
            {tier("strong", "Strong", strong, "bg-emerald-500/20 text-emerald-400", "accepted")}
            {tier("review", "Review", review, "bg-amber-500/20 text-amber-400")}
            {tier("weak", "Weak", weak, "bg-red-500/20 text-red-400", "rejected")}
          </div>

          {/* ── ROUND 2: AI Judges ── */}
          <div className="space-y-2">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Round 2 — AI Judges</h2>
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Input type="password" placeholder="API key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="h-8 text-sm flex-1" />
                  <select value={provider} onChange={(e) => { setProvider(e.target.value); setModel(e.target.value === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o"); }}
                    className="h-8 rounded-md border border-border bg-background px-2 text-sm w-28">
                    <option value="anthropic">Anthropic</option>
                    <option value="openai">OpenAI</option>
                  </select>
                  <Button size="sm" className="h-8" onClick={runJudges} disabled={runningJudges || !apiKey}>
                    {runningJudges ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Play className="size-3.5 mr-1.5" />}
                    Run Judges
                  </Button>
                </div>
                <div className="flex gap-2">
                  {[
                    { id: "closer_rank", icon: "🎯", name: "Closer" },
                    { id: "hunter_rank", icon: "🏹", name: "Hunter" },
                    { id: "overall_rank", icon: "🏆", name: "Overall" },
                  ].map((j) => (
                    <div key={j.id} className={`flex-1 text-center py-2 rounded-lg border text-xs ${judgesDone.has(j.id) ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/50"}`}>
                      <span className="text-lg">{j.icon}</span>
                      <p className="mt-0.5">{j.name}</p>
                      {judgesDone.has(j.id) && <Check className="size-3 mx-auto text-emerald-400 mt-0.5" />}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── ROUND 3: Final picks ── */}
          <div className="space-y-2">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Round 3 — Final Picks</h2>
            <Card>
              <CardContent className="pt-4 space-y-3">
                {counts.pending > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{counts.pending} pending — accept top</span>
                    <Input type="number" value={topN} onChange={(e) => setTopN(Number(e.target.value) || 0)} className="w-16 h-7 text-xs text-center" />
                    <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700" onClick={() => {
                      const pending = sorted.filter((a) => a.status === "pending");
                      const accept = pending.slice(0, topN).map((a) => a.applicant_id);
                      const wait = pending.slice(topN).map((a) => a.applicant_id);
                      if (accept.length) bulk(accept, "accepted");
                      if (wait.length) bulk(wait, "waitlisted");
                    }}>
                      Apply
                    </Button>
                  </div>
                )}
                {counts.accepted > 0 && (
                  <div>
                    <p className="text-xs text-emerald-400 mb-1">Accepted ({counts.accepted})</p>
                    <div className="max-h-48 overflow-y-auto">{sorted.filter((a) => a.status === "accepted").map(row)}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
