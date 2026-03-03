"use client";

import { useState } from "react";
import { useAdminSessions } from "@/hooks/use-applicants";
import type { AdminSession } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}mo ago`;
}

function sourceBadge(source: string) {
  const label = source === "csv" ? "CSV" : source === "google_sheet" ? "Sheet" : "Manual";
  const variant = source === "csv" ? "secondary" : source === "google_sheet" ? "outline" : "default";
  return <Badge variant={variant as "secondary" | "outline" | "default"}>{label}</Badge>;
}

function modelShortName(model?: string): string {
  if (!model) return "—";
  // Show just the base name, e.g. "claude-sonnet-4-20250514" → "claude-sonnet-4"
  const parts = model.split("-");
  // Drop trailing date segment if present (8 digits)
  if (parts.length > 1 && /^\d{8}$/.test(parts[parts.length - 1])) {
    return parts.slice(0, -1).join("-");
  }
  return model;
}

function StatusBar({ session }: { session: AdminSession }) {
  const { stats } = session;
  const snapshot = session.last_analysis_results;
  const isCleared = stats.total === 0 && !!snapshot;

  // Use snapshot data if session was cleared
  const data = isCleared
    ? {
        total: snapshot.total,
        accepted: snapshot.accepted,
        waitlisted: snapshot.waitlisted,
        rejected: snapshot.rejected,
        pending: 0,
      }
    : stats;

  const { total, accepted, rejected, waitlisted, pending } = data;
  if (total === 0) return <span className="text-muted-foreground text-xs">No applicants</span>;

  const segments = [
    { count: accepted, color: "bg-green-500", label: "Accepted" },
    { count: waitlisted, color: "bg-yellow-500", label: "Waitlisted" },
    { count: rejected, color: "bg-red-500", label: "Rejected" },
    { count: pending, color: "bg-gray-300", label: "Pending" },
  ];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <div className={`flex h-2.5 w-28 overflow-hidden rounded-full bg-gray-100 ${isCleared ? "opacity-60" : ""}`}>
              {segments.map(
                (seg) =>
                  seg.count > 0 && (
                    <div
                      key={seg.label}
                      className={`${seg.color} h-full`}
                      style={{ width: `${(seg.count / total) * 100}%` }}
                    />
                  )
              )}
            </div>
            {isCleared && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-600 border-orange-300">
                Cleared
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {isCleared && <div className="mb-1 text-xs text-orange-500 font-medium">Last analysis (cleared)</div>}
          {segments.map((seg) => (
            <div key={seg.label} className="flex justify-between gap-3">
              <span>{seg.label}</span>
              <span>{seg.count}</span>
            </div>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SummaryCards({ sessions }: { sessions: AdminSession[] }) {
  const totalSessions = sessions.length;
  const totalApplicants = sessions.reduce((s, x) => {
    if (x.stats.total > 0) return s + x.stats.total;
    if (x.last_analysis_results) return s + x.last_analysis_results.total;
    return s + (x.applicant_count || 0);
  }, 0);
  const totalAccepted = sessions.reduce((s, x) => {
    if (x.stats.total > 0) return s + x.stats.accepted;
    if (x.last_analysis_results) return s + x.last_analysis_results.accepted;
    return s;
  }, 0);
  const acceptanceRate = totalApplicants > 0 ? ((totalAccepted / totalApplicants) * 100).toFixed(1) : "0";

  // Most used model
  const modelCounts: Record<string, number> = {};
  for (const s of sessions) {
    if (s.last_analysis_model) {
      const name = modelShortName(s.last_analysis_model);
      modelCounts[name] = (modelCounts[name] || 0) + 1;
    }
  }
  const topModel =
    Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

  const cards = [
    { title: "Total Sessions", value: totalSessions },
    { title: "Total Applicants", value: totalApplicants },
    { title: "Acceptance Rate", value: `${acceptanceRate}%` },
    { title: "Most Used Model", value: topModel },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.title} className="py-4">
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {c.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{c.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  vc: "VCs / Investors",
  entrepreneur: "Founders / Entrepreneurs",
  faculty: "Faculty / Researchers",
  alumni: "Alumni",
  press: "Press / Media",
  student: "Students",
  other: "Other",
};

function ExpandedDetails({ session }: { session: AdminSession }) {
  const results = session.last_analysis_results;
  const isCleared = session.stats.total === 0 && !!results;

  return (
    <div className="grid gap-4 p-4 text-sm md:grid-cols-2">
      {/* Last Analysis Results */}
      {results && (
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold">Last Analysis Results</h4>
            {isCleared && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-600 border-orange-300">
                Applicants Cleared
              </Badge>
            )}
            {session.last_analysis_at && (
              <span className="text-xs text-muted-foreground ml-auto">
                {relativeTime(session.last_analysis_at)} ({new Date(session.last_analysis_at).toLocaleString()})
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              {results.accepted} accepted
              {results.auto_accepted > 0 && ` (${results.auto_accepted} auto)`}
            </Badge>
            <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
              {results.waitlisted} waitlisted
            </Badge>
            <Badge variant="secondary" className="bg-red-100 text-red-800">
              {results.rejected} rejected
            </Badge>
            {results.errors > 0 && (
              <Badge variant="destructive">
                {results.errors} errors
              </Badge>
            )}
            <Badge variant="outline">
              {results.total} total
            </Badge>
          </div>
        </div>
      )}

      {/* AI Summary */}
      {session.last_analysis_summary && (
        <div className="md:col-span-2">
          <h4 className="mb-1 font-semibold">AI Summary</h4>
          <p className="rounded-md bg-muted p-3 text-xs leading-relaxed">
            {session.last_analysis_summary}
          </p>
        </div>
      )}

      {/* Type Distribution */}
      {session.last_analysis_type_counts && Object.keys(session.last_analysis_type_counts).length > 0 && (
        <div>
          <h4 className="mb-1 font-semibold">Applicant Types</h4>
          <div className="space-y-1">
            {Object.entries(session.last_analysis_type_counts)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => {
                const total = results?.total || Object.values(session.last_analysis_type_counts!).reduce((s, v) => s + v, 0);
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={type} className="flex items-center gap-2">
                    <span className="w-32 text-xs text-muted-foreground truncate">{TYPE_LABELS[type] || type}</span>
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs w-14 text-right">{count} ({pct}%)</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Selection Preferences */}
      {session.selection_preferences && (
        <div>
          <h4 className="mb-1 font-semibold">Selection Preferences</h4>
          <dl className="space-y-0.5">
            {session.selection_preferences.venue_capacity != null && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Venue Capacity:</dt>
                <dd>{session.selection_preferences.venue_capacity}</dd>
              </div>
            )}
            {Object.keys(session.selection_preferences.attendee_mix || {}).length > 0 && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Attendee Mix:</dt>
                <dd>
                  {Object.entries(session.selection_preferences.attendee_mix)
                    .map(([k, v]) => `${k}: ${v}%`)
                    .join(", ")}
                </dd>
              </div>
            )}
            {(session.selection_preferences.auto_accept_types?.length ?? 0) > 0 && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Auto-accept:</dt>
                <dd>
                  {session.selection_preferences.auto_accept_types.map((t) => (
                    <Badge key={t} variant="outline" className="mr-1 text-[10px] px-1.5 py-0">{t}</Badge>
                  ))}
                </dd>
              </div>
            )}
            {session.selection_preferences.relevance_filter && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Relevance Filter:</dt>
                <dd>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                    {session.selection_preferences.relevance_filter}
                  </Badge>
                </dd>
              </div>
            )}
            {session.selection_preferences.custom_priorities && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Custom Priorities:</dt>
                <dd>{session.selection_preferences.custom_priorities}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Prompt Used */}
      {session.last_analysis_prompt && (
        <div className="md:col-span-2">
          <h4 className="mb-1 font-semibold">Prompt Used</h4>
          <pre className="max-h-48 overflow-auto rounded-md bg-muted p-3 text-xs whitespace-pre-wrap">
            {session.last_analysis_prompt}
          </pre>
        </div>
      )}

      {/* Criteria */}
      {session.last_analysis_criteria && session.last_analysis_criteria.length > 0 && (
        <div>
          <h4 className="mb-1 font-semibold">Criteria</h4>
          <ul className="list-inside list-disc space-y-0.5">
            {session.last_analysis_criteria.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Panel Config */}
      {session.panel_config && session.panel_config.enabled && (
        <div>
          <h4 className="mb-1 font-semibold">Panel Config</h4>
          <dl className="space-y-0.5">
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Panel Size:</dt>
              <dd>{session.panel_config.panel_size}</dd>
            </div>
            {session.panel_config.judge_ids.length > 0 && (
              <div className="flex gap-2">
                <dt className="text-muted-foreground">Judges:</dt>
                <dd>{session.panel_config.judge_ids.join(", ")}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-muted-foreground">Adjudication:</dt>
              <dd>{session.panel_config.adjudication_mode}</dd>
            </div>
          </dl>
        </div>
      )}

      {/* Source Detail */}
      {session.source_detail && (
        <div>
          <h4 className="mb-1 font-semibold">Source Detail</h4>
          <p className="text-muted-foreground break-all">{session.source_detail}</p>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const { sessions, loading, error } = useAdminSessions();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading sessions...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <SummaryCards sessions={sessions} />

      <Card>
        <CardHeader>
          <CardTitle>All Sessions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Session</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Applicants</TableHead>
                <TableHead>Status Breakdown</TableHead>
                <TableHead>AI Model</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Panel</TableHead>
                <TableHead className="pr-6" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((s) => (
                <Collapsible
                  key={s.session_id}
                  open={expandedIds.has(s.session_id)}
                  onOpenChange={() => toggle(s.session_id)}
                  asChild
                >
                  <>
                    <TableRow className="group">
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{s.name}</span>
                          {sourceBadge(s.source)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger className="cursor-default">
                              {relativeTime(s.created_at)}
                            </TooltipTrigger>
                            <TooltipContent>
                              {new Date(s.created_at).toLocaleString()}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right">
                        {s.stats.total > 0
                          ? s.stats.total
                          : s.last_analysis_results
                            ? <span className="text-muted-foreground">{s.last_analysis_results.total}</span>
                            : s.applicant_count}
                      </TableCell>
                      <TableCell>
                        <StatusBar session={s} />
                      </TableCell>
                      <TableCell>
                        {s.last_analysis_model ? (
                          <Badge variant="secondary">
                            {modelShortName(s.last_analysis_model)}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {s.last_analysis_provider ? (
                          <Badge variant="outline" className="capitalize">
                            {s.last_analysis_provider}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {s.panel_config?.enabled ? (
                          <Badge variant="default">
                            Yes ({s.panel_config.panel_size})
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell className="pr-6">
                        <CollapsibleTrigger asChild>
                          <button className="rounded p-1 hover:bg-muted" aria-label="Toggle details">
                            <svg
                              className={`h-4 w-4 transition-transform ${
                                expandedIds.has(s.session_id) ? "rotate-180" : ""
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </CollapsibleTrigger>
                      </TableCell>
                    </TableRow>
                    <CollapsibleContent asChild>
                      <tr>
                        <td colSpan={8} className="border-b bg-muted/30 p-0">
                          <ExpandedDetails session={s} />
                        </td>
                      </tr>
                    </CollapsibleContent>
                  </>
                </Collapsible>
              ))}
              {sessions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No sessions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
