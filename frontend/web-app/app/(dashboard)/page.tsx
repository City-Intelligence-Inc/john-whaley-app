"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";
import {
  Key,
  Brain,
  Plus,
  X,
  Loader2,
  GripVertical,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  ExternalLink,
  Mail,
  Building2,
  MapPin,
  Sparkles,
  Users,
  User,
  Terminal,
  Linkedin,
  Eye,
  EyeOff,
  Upload,
  Settings2,
  Search,
  Download,
  Sheet,
  RefreshCw,
  Unplug,
  Link,
  ChevronLeft,
  ChevronRight,
  Layers,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet as SheetPanel,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { api, type Applicant, type SelectionPreferences, type PanelConfig, DEFAULT_SELECTION_PREFERENCES, DEFAULT_PANEL_CONFIG } from "@/lib/api";
import { useApplicants, useStats, useSessions } from "@/hooks/use-applicants";
import { CSVUploader } from "@/components/csv-uploader";
import { RoundtableSelector } from "@/components/roundtable-selector";

const ANTHROPIC_MODELS = [
  { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { value: "claude-haiku-4-20250514", label: "Claude Haiku 4" },
];

const OPENAI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o Mini" },
];

/* ── Attendee Type Charts ── */

const ATTENDEE_TYPES: { key: string; label: string; color: string }[] = [
  { key: "vc", label: "VCs / Investors", color: "#6366f1" },
  { key: "entrepreneur", label: "Founders / Entrepreneurs", color: "#f59e0b" },
  { key: "faculty", label: "Faculty / Researchers", color: "#10b981" },
  { key: "alumni", label: "Alumni", color: "#3b82f6" },
  { key: "press", label: "Press / Media", color: "#ec4899" },
  { key: "student", label: "Students", color: "#8b5cf6" },
  { key: "other", label: "Other", color: "#6b7280" },
];

// Palette for "other" sub-types so each gets a distinct color
const OTHER_COLORS = ["#6b7280", "#9ca3af", "#4b5563", "#78716c", "#a1a1aa", "#737373", "#94a3b8", "#64748b"];

function AttendeeTypeCharts({ applicants }: { applicants: Applicant[] }) {
  const hasData = applicants.length > 0;
  const hasTypes = applicants.some((a) => a.attendee_type);
  const hasScores = applicants.some((a) => Number(a.ai_score) > 0);

  // Type distribution — always show all types (0 if empty)
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of applicants) {
      const t = (a.attendee_type as string) || "other";
      counts[t] = (counts[t] || 0) + 1;
    }
    return ATTENDEE_TYPES.map((t) => ({ ...t, count: counts[t.key] || 0 }));
  }, [applicants]);

  const typeCountsNonZero = typeCounts.filter((t) => t.count > 0);

  // Detailed breakdown — splits "other" into specific sub-types using attendee_type_detail
  const detailedBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    const colorMap: Record<string, string> = {};
    for (const t of ATTENDEE_TYPES) {
      if (t.key !== "other") colorMap[t.label] = t.color;
    }
    for (const a of applicants) {
      const t = (a.attendee_type as string) || "other";
      if (t === "other" && a.attendee_type_detail) {
        const detail = a.attendee_type_detail as string;
        counts[detail] = (counts[detail] || 0) + 1;
      } else {
        const typeInfo = ATTENDEE_TYPES.find((at) => at.key === t);
        const label = typeInfo?.label || "Other";
        counts[label] = (counts[label] || 0) + 1;
      }
    }
    // Assign colors to "other" sub-types
    let otherIdx = 0;
    return Object.entries(counts)
      .map(([label, count]) => ({
        key: label,
        label,
        count,
        color: colorMap[label] || OTHER_COLORS[otherIdx++ % OTHER_COLORS.length],
      }))
      .sort((a, b) => b.count - a.count);
  }, [applicants]);

  const detailedNonZero = detailedBreakdown.filter((t) => t.count > 0);

  // Decisions by type — always all types
  const typeStatusData = useMemo(() => {
    const data: Record<string, { accepted: number; waitlisted: number; rejected: number; pending: number }> = {};
    for (const a of applicants) {
      const t = (a.attendee_type as string) || "other";
      if (!data[t]) data[t] = { accepted: 0, waitlisted: 0, rejected: 0, pending: 0 };
      const status = a.status as "accepted" | "waitlisted" | "rejected" | "pending";
      if (data[t][status] !== undefined) data[t][status]++;
    }
    return ATTENDEE_TYPES.map((t) => ({
      name: t.label,
      accepted: data[t.key]?.accepted || 0,
      waitlisted: data[t.key]?.waitlisted || 0,
      rejected: data[t.key]?.rejected || 0,
      pending: data[t.key]?.pending || 0,
    }));
  }, [applicants]);

  // Avg AI score by type
  const avgScoreByType = useMemo(() => {
    const sums: Record<string, { total: number; count: number }> = {};
    for (const a of applicants) {
      const t = (a.attendee_type as string) || "other";
      const score = Number(a.ai_score) || 0;
      if (score === 0) continue;
      if (!sums[t]) sums[t] = { total: 0, count: 0 };
      sums[t].total += score;
      sums[t].count++;
    }
    return ATTENDEE_TYPES.map((t) => ({
      name: t.label,
      avg: sums[t.key] ? Math.round(sums[t.key].total / sums[t.key].count) : 0,
      color: t.color,
    }));
  }, [applicants]);

  // Acceptance rate by type
  const acceptRateByType = useMemo(() => {
    const data: Record<string, { accepted: number; total: number }> = {};
    for (const a of applicants) {
      const t = (a.attendee_type as string) || "other";
      if (!data[t]) data[t] = { accepted: 0, total: 0 };
      data[t].total++;
      if (a.status === "accepted") data[t].accepted++;
    }
    return ATTENDEE_TYPES.map((t) => ({
      name: t.label,
      rate: data[t.key] && data[t.key].total > 0 ? Math.round((data[t.key].accepted / data[t.key].total) * 100) : 0,
      accepted: data[t.key]?.accepted || 0,
      total: data[t.key]?.total || 0,
      color: t.color,
    }));
  }, [applicants]);

  // Score distribution histogram (buckets of 10)
  const scoreDistribution = useMemo(() => {
    const buckets = Array.from({ length: 10 }, (_, i) => ({
      range: `${i * 10 + 1}-${(i + 1) * 10}`,
      count: 0,
    }));
    for (const a of applicants) {
      const score = Number(a.ai_score) || 0;
      if (score <= 0) continue;
      const idx = Math.min(Math.floor((score - 1) / 10), 9);
      buckets[idx].count++;
    }
    return buckets;
  }, [applicants]);

  // Don't render anything if no analysis has been done yet
  if (!hasTypes && !hasScores) return null;

  return (
    <div className="space-y-4">
      {/* Type summary badges */}
      <div className="flex flex-wrap gap-2">
        {typeCounts.filter((t) => t.count > 0).map((t) => (
          <div
            key={t.key}
            className="flex items-center gap-2 rounded-lg border px-3 py-2"
          >
            <div className="size-3 rounded-full" style={{ backgroundColor: t.color }} />
            <span className="text-sm font-medium">{t.label}</span>
            <span className="text-lg font-bold tabular-nums">{t.count}</span>
            <span className="text-xs text-muted-foreground">
              ({Math.round((t.count / applicants.length) * 100)}%)
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* 1. Attendee Types Pie */}
        {typeCountsNonZero.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Attendee Types</CardTitle>
              <CardDescription className="text-xs">Distribution by main category</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={typeCountsNonZero}
                    dataKey="count"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={85}
                    paddingAngle={2}
                    label={({ label, percent }: { label: string; percent: number }) => `${label} ${(percent * 100).toFixed(0)}%`}
                    labelLine={true}
                  >
                    {typeCountsNonZero.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [value, "Applicants"]} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* 2. Top Roles */}
        {detailedNonZero.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top Roles</CardTitle>
              <CardDescription className="text-xs">Most common specific roles</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={detailedNonZero.slice(0, 8)} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => [value, "Applicants"]} />
                  <Bar dataKey="count" name="Applicants" radius={[0, 4, 4, 0]}>
                    {detailedNonZero.slice(0, 8).map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* 3. Score Distribution */}
        {hasScores && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Score Distribution</CardTitle>
              <CardDescription className="text-xs">AI scores across all applicants</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={scoreDistribution} margin={{ left: -10 }}>
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={50} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="Applicants" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* 4. Avg Score by Type */}
        {hasScores && avgScoreByType.some((t) => t.avg > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Avg Score by Type</CardTitle>
              <CardDescription className="text-xs">Mean AI score per attendee group</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={avgScoreByType.filter((t) => t.avg > 0)} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => [`${value}/100`, "Avg Score"]} />
                  <Bar dataKey="avg" name="Avg Score" radius={[0, 4, 4, 0]}>
                    {avgScoreByType.filter((t) => t.avg > 0).map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* 5. Decisions by Type */}
        {hasTypes && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Decisions by Type</CardTitle>
              <CardDescription className="text-xs">Accept / waitlist / reject per group</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={typeStatusData.filter((t) => (t.accepted + t.waitlisted + t.rejected + t.pending) > 0)} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="accepted" stackId="a" fill="#22c55e" name="Accepted" />
                  <Bar dataKey="waitlisted" stackId="a" fill="#eab308" name="Waitlisted" />
                  <Bar dataKey="rejected" stackId="a" fill="#ef4444" name="Rejected" />
                  <Bar dataKey="pending" stackId="a" fill="#d1d5db" name="Pending" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* 6. Acceptance Rate */}
        {hasTypes && acceptRateByType.some((t) => t.accepted > 0) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Acceptance Rate</CardTitle>
              <CardDescription className="text-xs">% accepted per attendee group</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={acceptRateByType.filter((t) => t.total > 0)} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => [`${value}%`, "Accept Rate"]} />
                  <Bar dataKey="rate" name="Accept Rate" radius={[0, 4, 4, 0]}>
                    {acceptRateByType.filter((t) => t.total > 0).map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

/* ── Swipeable Card Scanner ── */

function ApplicantCardScanner({
  applicants,
  onStatusChange,
  onClose,
}: {
  applicants: Applicant[];
  onStatusChange: (id: string, status: string) => void;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const sorted = useMemo(
    () =>
      [...applicants].sort((a, b) => {
        const sa = a.ai_score ? parseInt(a.ai_score) : 0;
        const sb = b.ai_score ? parseInt(b.ai_score) : 0;
        return sb - sa;
      }),
    [applicants]
  );

  const current = sorted[currentIndex];

  const goPrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const goNext = () => setCurrentIndex((i) => Math.min(sorted.length - 1, i + 1));

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "Escape") onClose();
      else if (e.key === "1" || e.key === "2" || e.key === "3") {
        const s = sorted[currentIndex];
        if (!s) return;
        const statusMap: Record<string, string> = { "1": "accepted", "2": "waitlisted", "3": "rejected" };
        onStatusChange(s.applicant_id, statusMap[e.key]);
        if (currentIndex < sorted.length - 1) setCurrentIndex((i) => i + 1);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  if (!current) return null;

  const score = current.ai_score ? parseInt(current.ai_score) : 0;
  const scoreColor =
    score >= 70
      ? "text-green-600 dark:text-green-400"
      : score >= 40
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";
  const scoreBg =
    score >= 70
      ? "bg-green-100 dark:bg-green-950 border-green-300 dark:border-green-700"
      : score >= 40
        ? "bg-yellow-100 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-700"
        : "bg-red-100 dark:bg-red-950 border-red-300 dark:border-red-700";

  const displayName =
    current.name ||
    current.email ||
    (current.title && current.company ? `${current.title} @ ${current.company}` : null) ||
    current.company ||
    "Unknown";

  const statusBadge = current.status === "accepted"
    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
    : current.status === "waitlisted"
      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      : current.status === "rejected"
        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
        : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";

  const handleAction = (status: string) => {
    onStatusChange(current.applicant_id, status);
    if (currentIndex < sorted.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="size-5 text-primary" />
          <span className="text-lg font-semibold">Card Scanner</span>
          <Badge variant="secondary" className="text-sm">
            {currentIndex + 1} / {sorted.length}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-base">
          <X className="size-4 mr-1" />
          Close
        </Button>
      </div>

      <Card className="border-2">
        <CardContent className="pt-6 pb-4 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold">{displayName}</h3>
              {current.title && current.company && (
                <p className="text-lg text-muted-foreground mt-0.5">
                  {current.title} @ {current.company}
                </p>
              )}
            </div>
            {score > 0 && (
              <div className={`flex flex-col items-center rounded-lg border px-4 py-2 ${scoreBg}`}>
                <span className={`text-3xl font-bold tabular-nums ${scoreColor}`}>{score}</span>
                <span className="text-xs text-muted-foreground">score</span>
              </div>
            )}
          </div>

          <div>
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${statusBadge}`}>
              {current.status.charAt(0).toUpperCase() + current.status.slice(1)}
            </span>
          </div>

          <div className="grid gap-2 text-base">
            {current.email && (
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${current.email}`} className="hover:underline truncate">
                  {current.email}
                </a>
              </div>
            )}
            {current.linkedin_url && (
              <div className="flex items-center gap-2">
                <Linkedin className="size-4 text-muted-foreground shrink-0" />
                <a
                  href={current.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center gap-1 text-blue-600 dark:text-blue-400"
                >
                  LinkedIn Profile
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            )}
            {current.location && (
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground shrink-0" />
                <span>{current.location}</span>
              </div>
            )}
          </div>

          {current.ai_reasoning && (
            <div className="rounded-lg bg-muted/50 p-4">
              <div className="flex items-start gap-2">
                <Sparkles className="size-4 text-primary mt-0.5 shrink-0" />
                <p className="text-base leading-relaxed">{current.ai_reasoning}</p>
              </div>
            </div>
          )}

          {Object.entries(current)
            .filter(([k]) => !["applicant_id", "session_id", "name", "email", "status", "ai_score", "ai_reasoning", "ai_review", "company", "title", "location", "linkedin_url", "attendee_type", "attendee_type_detail"].includes(k))
            .filter(([, v]) => v && String(v).trim())
            .length > 0 && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-sm text-muted-foreground gap-1 px-0">
                  Show all fields
                  <ChevronDown className="size-3.5" />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="grid gap-1.5 text-sm">
                  {Object.entries(current)
                    .filter(([k]) => !["applicant_id", "session_id", "name", "email", "status", "ai_score", "ai_reasoning", "ai_review", "company", "title", "location", "linkedin_url", "attendee_type", "attendee_type_detail"].includes(k))
                    .filter(([, v]) => v && String(v).trim())
                    .map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-muted-foreground font-medium min-w-[120px]">{k.replace(/_/g, " ")}:</span>
                        <span className="break-words">{String(v)}</span>
                      </div>
                    ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="h-12 px-4 text-base"
        >
          <ChevronLeft className="size-5 mr-1" />
          Prev
        </Button>

        <div className="flex gap-2 flex-1 justify-center">
          <Button
            onClick={() => handleAction("accepted")}
            className="flex-1 h-12 text-base bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle2 className="size-5 mr-1.5" />
            Accept
          </Button>
          <Button
            onClick={() => handleAction("waitlisted")}
            className="flex-1 h-12 text-base bg-yellow-500 hover:bg-yellow-600 text-white"
          >
            <Clock className="size-5 mr-1.5" />
            Waitlist
          </Button>
          <Button
            onClick={() => handleAction("rejected")}
            className="flex-1 h-12 text-base bg-red-600 hover:bg-red-700 text-white"
          >
            <XCircle className="size-5 mr-1.5" />
            Reject
          </Button>
        </div>

        <Button
          variant="outline"
          onClick={goNext}
          disabled={currentIndex >= sorted.length - 1}
          className="h-12 px-4 text-base"
        >
          Next
          <ChevronRight className="size-5 ml-1" />
        </Button>
      </div>

      <p className="text-sm text-muted-foreground text-center">
        Keyboard: Arrow keys to navigate, 1 = Accept, 2 = Waitlist, 3 = Reject, Esc = Close
      </p>
    </div>
  );
}

/* ── Console Log Panel ── */

function ConsoleLog({
  logs,
  logRef,
}: {
  logs: { time: string; message: string; color?: string }[];
  logRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={logRef}
      className="bg-zinc-950 text-green-400 font-mono text-[11px] sm:text-sm rounded-lg border border-zinc-800 p-2 sm:p-4 h-52 sm:h-72 overflow-y-auto overflow-x-hidden"
    >
      {logs.length === 0 && (
        <span className="text-zinc-600">Waiting for activity...</span>
      )}
      {logs.map((log, i) => (
        <div key={i} className="leading-relaxed break-words" style={log.color ? { color: log.color } : undefined}>
          <span className="text-zinc-500 hidden sm:inline">[{log.time}]</span> {log.message}
        </div>
      ))}
    </div>
  );
}

/* ── Applicant Detail Panel (Sheet slide-out) ── */

function ApplicantDetailPanel({
  applicant,
  onStatusChange,
  onClose,
}: {
  applicant: Applicant | null;
  onStatusChange: (id: string, status: string) => void;
  onClose: () => void;
}) {
  if (!applicant) return null;

  const score = applicant.ai_score ? parseInt(applicant.ai_score) : 0;
  const scoreColor =
    score >= 70 ? "text-green-600" : score >= 40 ? "text-yellow-600" : "text-red-600";

  const displayName =
    applicant.name ||
    applicant.email ||
    (applicant.title && applicant.company ? `${applicant.title} @ ${applicant.company}` : null) ||
    applicant.company ||
    "Unknown";

  const skipKeys = new Set([
    "applicant_id", "session_id", "name", "email", "status", "ai_score",
    "ai_reasoning", "ai_review", "company", "title", "location", "linkedin_url",
    "attendee_type", "attendee_type_detail", "panel_votes", "accepting_judges",
  ]);

  return (
    <SheetPanel open={!!applicant} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">{displayName}</SheetTitle>
          {applicant.title && applicant.company && (
            <SheetDescription className="text-base">
              {applicant.title} @ {applicant.company}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          {/* Score + Status */}
          <div className="flex items-center gap-3">
            {score > 0 && (
              <span className={`text-3xl font-bold tabular-nums ${scoreColor}`}>{score}</span>
            )}
            <Badge
              variant={
                applicant.status === "accepted" ? "default" :
                applicant.status === "rejected" ? "destructive" : "secondary"
              }
              className="text-sm"
            >
              {applicant.status.charAt(0).toUpperCase() + applicant.status.slice(1)}
            </Badge>
            {applicant.attendee_type && (
              <Badge variant="outline" className="text-sm">
                {applicant.attendee_type_detail || applicant.attendee_type}
              </Badge>
            )}
          </div>

          {/* Move actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={applicant.status === "accepted" ? "default" : "outline"}
              onClick={() => onStatusChange(applicant.applicant_id, "accepted")}
              className="text-sm"
            >
              <CheckCircle2 className="size-4 mr-1 text-green-500" />
              Accept
            </Button>
            <Button
              size="sm"
              variant={applicant.status === "waitlisted" ? "default" : "outline"}
              onClick={() => onStatusChange(applicant.applicant_id, "waitlisted")}
              className="text-sm"
            >
              <Clock className="size-4 mr-1 text-yellow-500" />
              Waitlist
            </Button>
            <Button
              size="sm"
              variant={applicant.status === "rejected" ? "default" : "outline"}
              onClick={() => onStatusChange(applicant.applicant_id, "rejected")}
              className="text-sm"
            >
              <XCircle className="size-4 mr-1 text-red-500" />
              Reject
            </Button>
          </div>

          <Separator />

          {/* Contact Info */}
          <div className="grid gap-2.5 text-base">
            {applicant.email && (
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" />
                <a href={`mailto:${applicant.email}`} className="hover:underline">
                  {applicant.email}
                </a>
              </div>
            )}
            {applicant.linkedin_url && (
              <div className="flex items-center gap-2">
                <Linkedin className="size-4 text-muted-foreground" />
                <a
                  href={applicant.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center gap-1 text-blue-600 dark:text-blue-400"
                >
                  LinkedIn Profile
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            )}
            {applicant.company && (
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground" />
                <span>
                  {applicant.title ? `${applicant.title} @ ${applicant.company}` : applicant.company}
                </span>
              </div>
            )}
            {applicant.location && (
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground" />
                <span>{applicant.location}</span>
              </div>
            )}
          </div>

          {/* Panel Votes */}
          {applicant.panel_votes && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Panel Decision</h4>
                <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-primary shrink-0" />
                    <span className="text-sm font-medium">
                      {String(applicant.panel_votes)} judges accepted
                    </span>
                  </div>
                  {applicant.accepting_judges && (
                    <p className="text-xs text-muted-foreground pl-6">
                      {String(applicant.accepting_judges)}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* AI Reasoning */}
          {applicant.ai_reasoning && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">AI Assessment</h4>
                <div className="rounded-lg bg-muted/50 p-4">
                  <div className="flex items-start gap-2">
                    <Sparkles className="size-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-base leading-relaxed">{applicant.ai_reasoning}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Extra fields */}
          {Object.entries(applicant)
            .filter(([k]) => !skipKeys.has(k))
            .filter(([, v]) => v && String(v).trim())
            .length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">All Fields</h4>
                <div className="grid gap-1.5 text-sm">
                  {Object.entries(applicant)
                    .filter(([k]) => !skipKeys.has(k))
                    .filter(([, v]) => v && String(v).trim())
                    .map(([k, v]) => (
                      <div key={k} className="flex gap-2">
                        <span className="text-muted-foreground font-medium min-w-[120px]">
                          {k.replace(/_/g, " ")}:
                        </span>
                        <span className="break-words">{String(v)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </SheetPanel>
  );
}


const SETTINGS_ATTENDEE_TYPES = [
  { key: "vc", label: "VCs / Investors" },
  { key: "entrepreneur", label: "Founders" },
  { key: "faculty", label: "Faculty" },
  { key: "alumni", label: "Alumni" },
  { key: "press", label: "Press" },
  { key: "student", label: "Students" },
  { key: "other", label: "Other" },
];

const PANEL_SIZES = [3, 6, 9, 12] as const;

/* ── Main Page ── */

export default function Page() {
  // Session state
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(undefined);
  const { sessions, refresh: refreshSessions } = useSessions();

  // Data hooks (session-aware)
  const { stats, refresh: refreshStats } = useStats(activeSessionId);
  const { applicants, loading: loadingApplicants, refresh: refreshApplicants } = useApplicants(activeSessionId);

  // UI state
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<string>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [showCardScanner, setShowCardScanner] = useState(false);
  const [showChartsOpen, setShowChartsOpen] = useState(false);

  // Dialog state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);

  // Pre-analysis wizard state
  const [showWizard, setShowWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);

  // Selection preferences state
  const [selectionPreferences, setSelectionPreferences] = useState<SelectionPreferences>(DEFAULT_SELECTION_PREFERENCES);
  const [panelConfig, setPanelConfig] = useState<PanelConfig>(DEFAULT_PANEL_CONFIG);
  const [personaEdits, setPersonaEdits] = useState<Record<string, string>>({});
  // AI config state
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("claude-sonnet-4-20250514");

  // Google Sheets state
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetConnected, setSheetConnected] = useState(false);
  const [sheetSyncing, setSheetSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<{ new_count: number; updated_count: number; total_in_sheet: number } | null>(null);
  const autoSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Criteria state
  const [prompt, setPrompt] = useState(
    "Evaluate each applicant based on their background and relevance to the event."
  );
  const [criteria, setCriteria] = useState<string[]>([
    "Relevant experience and expertise",
    "Industry or academic standing",
    "Potential to contribute value as an attendee",
  ]);
  const [newCriterion, setNewCriterion] = useState("");

  // Analysis progress state
  const [analysisProgress, setAnalysisProgress] = useState<{
    completed: number;
    total: number;
    errors: number;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // LinkedIn enrichment state
  const [enriching, setEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState<{ completed: number; total: number; errors: number } | null>(null);
  const [showEnrichDialog, setShowEnrichDialog] = useState(false);
  const [enrichLogs, setEnrichLogs] = useState<{ time: string; message: string; color?: string }[]>([]);
  const enrichLogRef = useRef<HTMLDivElement>(null);
  const [liAtCookie, setLiAtCookie] = useState("");
  const [showLiAtInput, setShowLiAtInput] = useState(false);
  const enrichJobIdRef = useRef<string | null>(null);

  // Console log state
  const [logs, setLogs] = useState<{ time: string; message: string; color?: string }[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  // Load persisted state from localStorage
  useEffect(() => {
    const savedSessionId = localStorage.getItem("active_session_id");
    const savedKey = localStorage.getItem("ai_api_key") || "";
    const savedProvider = localStorage.getItem("ai_provider") || "anthropic";
    const savedModel = localStorage.getItem("ai_model") || "claude-sonnet-4-20250514";
    const savedSheetUrl = localStorage.getItem("google_sheet_url") || "";
    if (savedSessionId) setActiveSessionId(savedSessionId);
    setApiKey(savedKey);
    setProvider(savedProvider);
    setModel(savedModel);
    setLiAtCookie(localStorage.getItem("li_at_cookie") || "");
    if (savedSheetUrl) {
      setSheetUrl(savedSheetUrl);
      setSheetConnected(true);
    }
    // Panel config from localStorage
    try {
      const savedPanel = localStorage.getItem("panel_config");
      if (savedPanel) setPanelConfig(JSON.parse(savedPanel));
    } catch {}
    // Persona edits from localStorage
    try {
      const savedEdits = localStorage.getItem("persona_edits");
      if (savedEdits) setPersonaEdits(JSON.parse(savedEdits));
    } catch {}
  }, []);

  // Load saved prompt settings + selection preferences from backend
  useEffect(() => {
    api.getPromptSettings()
      .then((s) => {
        if (s.default_prompt) setPrompt(s.default_prompt);
        if (s.criteria?.length) setCriteria(s.criteria);
      })
      .catch(() => {});
    api.getSelectionPreferences()
      .then((prefs) => {
        if (prefs) setSelectionPreferences(prefs);
      })
      .catch(() => {});
  }, []);

  // Persist session + AI config
  useEffect(() => {
    if (activeSessionId) localStorage.setItem("active_session_id", activeSessionId);
    else localStorage.removeItem("active_session_id");
  }, [activeSessionId]);

  useEffect(() => {
    if (apiKey) localStorage.setItem("ai_api_key", apiKey);
    localStorage.setItem("ai_provider", provider);
    localStorage.setItem("ai_model", model);
  }, [apiKey, provider, model]);

  // Persist panel config + persona edits
  useEffect(() => {
    localStorage.setItem("panel_config", JSON.stringify(panelConfig));
  }, [panelConfig]);
  useEffect(() => {
    localStorage.setItem("persona_edits", JSON.stringify(personaEdits));
  }, [personaEdits]);

  // Persona edit handlers for roundtable
  const handleToggleJudge = useCallback((judgeId: string) => {
    setPanelConfig((p) => {
      const has = p.judge_ids.includes(judgeId);
      if (has) return { ...p, judge_ids: p.judge_ids.filter((id) => id !== judgeId) };
      if (p.judge_ids.length >= p.panel_size) return p;
      return { ...p, judge_ids: [...p.judge_ids, judgeId] };
    });
  }, []);

  const handleUpdatePersonaEdit = useCallback((judgeId: string, text: string) => {
    setPersonaEdits((prev) => ({ ...prev, [judgeId]: text }));
  }, []);

  const handleResetPersonaEdit = useCallback((judgeId: string) => {
    setPersonaEdits((prev) => {
      const next = { ...prev };
      delete next[judgeId];
      return next;
    });
  }, []);

  // Auto-scroll console logs
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);
  useEffect(() => {
    if (enrichLogRef.current) {
      enrichLogRef.current.scrollTop = enrichLogRef.current.scrollHeight;
    }
  }, [enrichLogs]);

  // Google Sheets sync
  const syncGoogleSheet = useCallback(async (url?: string) => {
    const targetUrl = url || sheetUrl;
    if (!targetUrl.trim()) return;
    setSheetSyncing(true);
    try {
      const result = await api.importGoogleSheet({
        sheet_url: targetUrl,
        session_id: activeSessionId,
      });
      const now = new Date().toLocaleTimeString("en-US", { hour12: false });
      setLastSyncTime(now);
      setLastSyncResult({ new_count: result.new_count, updated_count: result.updated_count, total_in_sheet: result.total_in_sheet });
      setSheetConnected(true);
      localStorage.setItem("google_sheet_url", targetUrl);
      // If a new session was created, switch to it
      if (!activeSessionId && result.session_id) {
        setActiveSessionId(result.session_id);
        refreshSessions();
        // Don't call refreshStats/refreshApplicants — hooks auto-refresh when activeSessionId changes
      } else {
        refreshStats();
        refreshApplicants();
      }
      if (result.new_count > 0) {
        toast.success(`Synced: ${result.new_count} new, ${result.updated_count} updated`);
      } else if (result.updated_count > 0) {
        toast.info(`Synced: ${result.updated_count} updated (no new applicants)`);
      } else {
        toast.info("Sheet synced — no changes detected");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to sync Google Sheet");
      setSheetConnected(false);
    } finally {
      setSheetSyncing(false);
    }
  }, [sheetUrl, activeSessionId, refreshStats, refreshApplicants, refreshSessions]);

  // Auto-sync interval
  useEffect(() => {
    if (autoSync && sheetConnected && sheetUrl) {
      autoSyncRef.current = setInterval(() => {
        syncGoogleSheet();
      }, 30000);
    }
    return () => {
      if (autoSyncRef.current) {
        clearInterval(autoSyncRef.current);
        autoSyncRef.current = null;
      }
    };
  }, [autoSync, sheetConnected, sheetUrl, syncGoogleSheet]);

  // Models for current provider
  const models = provider === "anthropic" ? ANTHROPIC_MODELS : OPENAI_MODELS;

  const handleProviderChange = (p: string) => {
    setProvider(p);
    setModel(p === "anthropic" ? "claude-sonnet-4-20250514" : "gpt-4o");
  };

  // Criteria helpers
  const addCriterion = () => {
    const value = newCriterion.trim();
    if (value && !criteria.includes(value)) {
      setCriteria([...criteria, value]);
      setNewCriterion("");
    }
  };

  const removeCriterion = (c: string) => {
    setCriteria(criteria.filter((x) => x !== c));
  };

  // Import handler
  const handleUploadSuccess = (_count: number, sessionId: string) => {
    refreshSessions();
    if (!activeSessionId) {
      // Setting activeSessionId triggers hooks to auto-refresh via useEffect
      setActiveSessionId(sessionId);
    } else {
      // Session didn't change — manually refresh with current (correct) sessionId
      refreshStats();
      refreshApplicants();
    }
    setShowImportDialog(false);
  };

  // LinkedIn enrichment
  const handleEnrichLinkedIn = async () => {
    if (!activeSessionId) return;

    // Persist cookie if provided
    if (liAtCookie.trim()) {
      localStorage.setItem("li_at_cookie", liAtCookie);
    }

    setEnriching(true);
    setEnrichProgress(null);
    setEnrichLogs([]);
    setShowEnrichDialog(true);
    setShowLiAtInput(false);
    enrichJobIdRef.current = null;

    const elog = (msg: string, color?: string) => {
      const time = new Date().toLocaleTimeString("en-US", { hour12: false });
      setEnrichLogs((prev) => [...prev, { time, message: msg, color }]);
    };

    elog("Starting LinkedIn enrichment (native scraper, no API key needed)...");

    try {
      await api.enrichLinkedInStream(
        {
          session_id: activeSessionId,
          li_at: liAtCookie.trim() || undefined,
        },
        {
          onStart: (data) => {
            if (data.job_id) enrichJobIdRef.current = data.job_id;
            setEnrichProgress({ completed: 0, total: data.total, errors: 0 });
            elog(`Scraping ${data.total} LinkedIn profiles (auto-retry on rate limits)...`);
            elog("═".repeat(50), "#6366f1");
          },
          onProgress: (data) => {
            setEnrichProgress({ completed: data.completed, total: data.total, errors: 0 });
            elog(`[${data.completed}/${data.total}] ${data.name}  ·  ${data.linkedin_headline || data.headline || "no headline"}`, "#22c55e");
          },
          onError: (data) => {
            setEnrichProgress((prev) => ({
              completed: data.completed,
              total: data.total,
              errors: (prev?.errors || 0) + 1,
            }));
            elog(`[${data.completed}/${data.total}] ${data.name || "unknown"}  ·  ${data.error}`, "#ef4444");
          },
          onComplete: (data) => {
            setEnrichProgress({ completed: data.completed, total: data.total, errors: data.errors });
            elog("═".repeat(50), "#6366f1");
            elog(`Done: ${data.enriched} enriched, ${data.errors} errors`, data.errors > 0 ? "#eab308" : "#22c55e");
            refreshApplicants();
          },
        },
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      elog(`Fatal error: ${msg}`, "#ef4444");
    } finally {
      setEnriching(false);
    }
  };

  // Analyze
  const handleAnalyze = async (overridePrefs?: SelectionPreferences, overridePanelConfig?: PanelConfig) => {
    const prefs = overridePrefs || selectionPreferences;
    const pc = overridePanelConfig !== undefined ? overridePanelConfig : panelConfig;
    const isPanelMode = pc?.enabled && (pc.judge_ids?.length ?? 0) > 0;
    setShowAnalysisDialog(true);
    setLogs([]);
    setAnalysisProgress(null);
    setAnalyzing(true);

    const modelLabel = models.find((m) => m.value === model)?.label || model;

    const log = (msg: string, color?: string) => {
      const now = new Date();
      const time = now.toLocaleTimeString("en-US", { hour12: false });
      setLogs((prev) => [...prev, { time, message: msg, color }]);
    };

    log(isPanelMode ? `Starting Judge Panel analysis (${pc!.judge_ids.length} judges, ${pc!.adjudication_mode} mode)...` : `Starting 2-pass analysis...`);
    log(`Provider: ${provider === "anthropic" ? "Anthropic" : "OpenAI"} | Model: ${modelLabel}`);
    log(`Prompt: "${prompt.substring(0, 80)}${prompt.length > 80 ? "..." : ""}"`);
    log(`Criteria: ${criteria.join(", ")}`);
    if (prefs.venue_capacity) {
      log(`Venue capacity: ${prefs.venue_capacity}`);
    }
    if (prefs.auto_accept_types.length > 0) {
      log(`Auto-accept: ${prefs.auto_accept_types.join(", ")}`);
    }
    log(`Relevance filter: ${prefs.relevance_filter}`);

    let acceptedCount = 0;
    let autoAcceptedCount = 0;
    let waitlistedCount = 0;
    let rejectedCount = 0;
    const typeTally: Record<string, number> = {};
    const typeNames: Record<string, string[]> = {};
    let numJudges = isPanelMode ? pc!.judge_ids.length : 0;

    try {
      await api.updatePromptSettings({ default_prompt: prompt, criteria });
      log("Saved prompt settings.");

      await api.analyzeAllStream(
        {
          api_key: apiKey, model, provider, prompt, criteria,
          session_id: activeSessionId, selection_preferences: prefs,
          panel_config: isPanelMode ? pc : undefined,
        },
        {
          onStart: (data) => {
            // Progress total = total applicant-level events we'll receive
            // Single: classify events + score events
            // Panel: classify events + (judges * applicants) + adjudication events
            const progressTotal = isPanelMode
              ? data.total + (data.total * numJudges) + data.total
              : data.total + data.total;
            setAnalysisProgress({ completed: 0, total: progressTotal, errors: 0 });
            log(`${data.total} applicants to analyze${isPanelMode ? ` with ${numJudges} judges` : ""}`);
          },
          onPhase: (data) => {
            log("");
            log("═".repeat(60), "#6366f1");
            log(data.message, "#6366f1");
            log("═".repeat(60), "#6366f1");

            // Show pool summary after classification
            if (data.phase === "pool_summary" && data.type_counts) {
              const total = data.total || 0;
              for (const t of ATTENDEE_TYPES) {
                const count = data.type_counts[t.key] || 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const bar = "█".repeat(Math.max(1, Math.round(pct / 3))) + (count === 0 ? "░" : "");
                const names = typeNames[t.key]?.slice(0, 4).join(", ") || "—";
                const moreCount = (typeNames[t.key]?.length || 0) - 4;
                log(`  ${t.label.padEnd(24)} ${String(count).padStart(3)} (${String(pct).padStart(2)}%) ${bar}`, t.color);
                if (count > 0) {
                  log(`     └─ ${names}${moreCount > 0 ? `, +${moreCount} more` : ""}`, "#9ca3af");
                }
              }

              // Balance warnings
              const alerts: string[] = [];
              for (const t of ATTENDEE_TYPES) {
                const count = data.type_counts[t.key] || 0;
                if (t.key === "other") continue;
                if (count === 0) alerts.push(`⚠ No ${t.label} — consider sourcing more`);
                else if (count < Math.ceil(total * 0.03)) alerts.push(`⚠ Only ${count} ${t.label} — underrepresented`);
              }
              const otherCount = data.type_counts["other"] || 0;
              if (otherCount > total * 0.4) {
                alerts.push(`⚠ ${otherCount} "Other" (${Math.round((otherCount / total) * 100)}%) — large uncategorized group`);
              }
              if (alerts.length > 0) {
                log("");
                for (const a of alerts) log(`  ${a}`, "#eab308");
              }
            }
          },
          onClassify: (data) => {
            setAnalysisProgress((prev) => ({
              completed: (prev?.completed || 0) + 1,
              total: prev?.total || data.total * 2,
              errors: prev?.errors || 0,
            }));

            const type = data.attendee_type || "other";
            const typeLabel = ATTENDEE_TYPES.find((t) => t.key === type)?.label || type;
            const detail = data.attendee_type_detail || typeLabel;
            typeTally[type] = (typeTally[type] || 0) + 1;
            if (!typeNames[type]) typeNames[type] = [];
            typeNames[type].push(data.name);

            const typeColor = ATTENDEE_TYPES.find((t) => t.key === type)?.color;
            log(`[${data.completed}/${data.total}] ${data.name}  →  ${typeLabel}  ·  ${detail}`, typeColor);
            if (data.summary) {
              log(`   └─ ${data.summary}`, "#9ca3af");
            }
          },
          onClassifyError: (data) => {
            setAnalysisProgress((prev) => ({
              completed: (prev?.completed || 0) + 1,
              total: prev?.total || data.total * 2,
              errors: (prev?.errors || 0) + 1,
            }));
            let errMsg = data.error || "Unknown error";
            if (errMsg.includes("authentication_error")) errMsg = "API key is invalid or expired";
            else if (errMsg.includes("rate_limit")) errMsg = "Rate limit exceeded — too many requests";
            else if (errMsg.includes("insufficient_quota") || errMsg.includes("billing")) errMsg = "API quota exceeded — add credits";
            log(`[${data.completed}/${data.total}] ${data.name} — ERROR: ${errMsg}`, "#ef4444");
          },
          onAutoAccept: (data) => {
            autoAcceptedCount++;
            acceptedCount++;
            const detail = data.attendee_type_detail || data.attendee_type;
            log(`[AUTO] ${data.name}  ·  ${detail}  ·  Score: 100  ·  ACCEPTED`, "#22c55e");
          },
          onProgress: (data) => {
            setAnalysisProgress((prev) => ({
              completed: (prev?.completed || 0) + 1,
              total: prev?.total || data.total * 2,
              errors: prev?.errors || 0,
            }));

            const detail = data.attendee_type_detail || data.attendee_type || "";
            const statusColor = data.status === "accepted" ? "#22c55e" : data.status === "rejected" ? "#ef4444" : data.status === "waitlisted" ? "#eab308" : undefined;
            const statusLabel = data.status.toUpperCase();

            log(`[${data.completed}/${data.total}] ${data.name}  ·  ${detail}  ·  Score: ${data.score}  ·  ${statusLabel}`, statusColor);
            if (data.reasoning) {
              log(`   └─ ${data.reasoning}`, "#9ca3af");
            }

            if (data.status === "accepted") acceptedCount++;
            else if (data.status === "waitlisted") waitlistedCount++;
            else if (data.status === "rejected") rejectedCount++;
          },
          onError: (data) => {
            setAnalysisProgress((prev) => ({
              completed: (prev?.completed || 0) + 1,
              total: prev?.total || data.total * 2,
              errors: (prev?.errors || 0) + 1,
            }));
            // Parse error to be human-readable
            let errMsg = data.error || "Unknown error";
            if (errMsg.includes("authentication_error")) errMsg = "API key is invalid or expired";
            else if (errMsg.includes("rate_limit")) errMsg = "Rate limit exceeded — too many requests";
            else if (errMsg.includes("insufficient_quota") || errMsg.includes("billing")) errMsg = "API quota exceeded — add credits";
            log(`[${data.completed}/${data.total}] ${data.name} — ERROR: ${errMsg}`, "#ef4444");
          },
          onComplete: (data) => {
            setAnalysisProgress((prev) => ({
              completed: prev?.total || data.total * 2,
              total: prev?.total || data.total * 2,
              errors: data.errors,
            }));
            log("");
            const allFailed = data.errors >= data.completed;
            const color = allFailed ? "#ef4444" : data.errors > 0 ? "#eab308" : "#22c55e";
            log("═".repeat(60), color);
            if (allFailed) {
              log(`FAILED: All ${data.errors} applicants had errors. Check your API key in Settings.`, "#ef4444");
            } else {
              const autoNote = autoAcceptedCount > 0 ? ` (${autoAcceptedCount} auto-accepted)` : "";
              log(`DONE: ${acceptedCount} accepted${autoNote}, ${waitlistedCount} waitlisted, ${rejectedCount} rejected` +
                (data.errors > 0 ? ` (${data.errors} errors)` : ""), color);
            }
            log("═".repeat(60), color);
            // Capacity warning
            if (prefs.venue_capacity && acceptedCount > prefs.venue_capacity) {
              log("");
              log(`⚠ WARNING: ${acceptedCount} accepted exceeds venue capacity of ${prefs.venue_capacity}!`, "#eab308");
            }
            log("");
            log("Generating overall summary...", "#9ca3af");
          },
          onSummary: (data) => {
            log("");
            log("═".repeat(60), "#6366f1");
            log("OVERALL ANALYSIS SUMMARY", "#6366f1");
            log("═".repeat(60), "#6366f1");
            log(data.summary, "#e2e8f0");
            log("═".repeat(60), "#6366f1");
          },
          onJudgeSeats: (data) => {
            log(`  ${data.judge_emoji} ${data.judge_name}: ${data.seats_allocated} seats (${data.specialty})`, "#a78bfa");
          },
          onJudgeStart: (data) => {
            log("");
            log("─".repeat(60), "#8b5cf6");
            log(`${data.judge_emoji} ${data.judge_name} reviewing (judge ${data.judge_index + 1}/${data.total_judges}, ${data.seats_remaining} seats)...`, "#8b5cf6");
            log("─".repeat(60), "#8b5cf6");
          },
          onJudgeProgress: (data) => {
            setAnalysisProgress((prev) => ({
              completed: (prev?.completed || 0) + 1,
              total: prev?.total || 1,
              errors: prev?.errors || 0,
            }));
            const decisionColor = data.decision === "accept" ? "#22c55e" : "#6b7280";
            const decisionLabel = data.decision === "accept" ? "ACCEPT" : "pass";
            log(`  [${data.completed}/${data.total}] ${data.name}  ·  Score: ${data.score}  ·  ${decisionLabel}`, decisionColor);
          },
          onJudgeComplete: (data) => {
            const names = data.accepted_names.slice(0, 5).join(", ");
            const moreCount = data.accepted_names.length - 5;
            log(`  ${data.judge_emoji} Done: ${data.seats_filled}/${data.seats_allocated} seats filled`, "#a78bfa");
            if (data.accepted_names.length > 0) {
              log(`  └─ Top picks: ${names}${moreCount > 0 ? `, +${moreCount} more` : ""}`, "#9ca3af");
            }
          },
          onAdjudication: (data) => {
            setAnalysisProgress((prev) => ({
              completed: (prev?.completed || 0) + 1,
              total: prev?.total || 1,
              errors: prev?.errors || 0,
            }));
            const statusColor = data.final_status === "accepted" ? "#22c55e" : "#eab308";
            const judges = data.accepting_judges.join(", ") || "none";
            log(`  ${data.name}  ·  ${data.votes_accept}/${data.votes_total} votes  ·  ${data.final_status.toUpperCase()}  ·  Score: ${data.avg_score}`, statusColor);
            if (data.votes_accept > 0) {
              log(`     └─ Accepted by: ${judges}`, "#9ca3af");
            }
            if (data.final_status === "accepted") acceptedCount++;
            else if (data.final_status === "waitlisted") waitlistedCount++;
          },
        }
      );

      const allErrored = acceptedCount + waitlistedCount + rejectedCount === 0;
      if (allErrored) {
        toast.error("Analysis failed — check your API key in Settings");
      } else {
        toast.success(
          `Analysis complete: ${acceptedCount} accepted, ${waitlistedCount} waitlisted, ${rejectedCount} rejected`
        );
      }

      await refreshApplicants();
      await refreshStats();
      setAnalyzing(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      log(`ERROR: ${msg}`, "red");
      toast.error(msg);
      setAnalyzing(false);
    }
  };

  // Results data
  const accepted = useMemo(() => applicants.filter((a) => a.status === "accepted"), [applicants]);
  const waitlisted = useMemo(() => applicants.filter((a) => a.status === "waitlisted"), [applicants]);
  const rejected = useMemo(() => applicants.filter((a) => a.status === "rejected"), [applicants]);
  const pending = useMemo(() => applicants.filter((a) => a.status === "pending"), [applicants]);

  // Filtered + searched applicants for the table
  const filteredApplicants = useMemo(() => {
    let list = applicants;
    if (statusFilter !== "all") {
      list = list.filter((a) => a.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) =>
        Object.values(a).some((v) => v != null && String(v).toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "ai_score") {
        cmp = (parseInt(String(a.ai_score || "0")) || 0) - (parseInt(String(b.ai_score || "0")) || 0);
      } else {
        const va = String(a[sortBy] ?? "");
        const vb = String(b[sortBy] ?? "");
        cmp = va.localeCompare(vb);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [applicants, statusFilter, searchQuery, sortBy, sortDir]);

  // Dynamic table columns — derived from actual applicant data
  const HIDDEN_KEYS = new Set([
    "applicant_id", "session_id",
    "user_override_attendee_type", "user_override_attendee_type_detail",
    "luma_guest_id", "luma_status",
  ]);
  // Low-value columns hidden by default (common in Luma CSVs)
  const DEFAULT_HIDDEN = new Set([
    "amount", "amount_discount", "tax", "currency", "created_at",
    "event_id", "order_id", "payment_id", "coupon_code",
    "checkout_custom_questions", "utm_source", "utm_medium", "utm_campaign",
    "investor_professional",
  ]);
  // Priority columns shown first (if they exist in data)
  const PRIORITY_COLS = ["name", "email", "title", "company", "location", "ai_score", "status", "attendee_type"];

  const [userToggledColumns, setUserToggledColumns] = useState<Record<string, boolean>>({});

  const { allColumns, tableColumns } = useMemo(() => {
    const seen = new Set<string>();
    const allEmpty = new Set<string>();
    // Gather all non-hidden keys
    for (const a of applicants) {
      for (const key of Object.keys(a)) {
        if (!HIDDEN_KEYS.has(key)) seen.add(key);
      }
    }
    // Detect columns that are empty/zero across all rows
    for (const key of seen) {
      const isEmpty = applicants.every((a) => {
        const v = a[key];
        return v === undefined || v === null || v === "" || v === "0" || v === 0;
      });
      if (isEmpty) allEmpty.add(key);
    }
    // Filter: auto-hide empty + default-hidden, but respect user toggles
    const visible = [...seen].filter((key) => {
      if (key in userToggledColumns) return userToggledColumns[key];
      if (allEmpty.has(key)) return false;
      if (DEFAULT_HIDDEN.has(key)) return false;
      return true;
    });
    const ordered = [
      ...PRIORITY_COLS.filter((k) => visible.includes(k)),
      ...visible.filter((k) => !PRIORITY_COLS.includes(k)).sort(),
    ];
    return { allColumns: [...seen].sort(), tableColumns: ordered };
  }, [applicants, userToggledColumns]);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [scoreCutoff, setScoreCutoff] = useState(50);

  const COLUMN_LABELS: Record<string, string> = {
    name: "Name", email: "Email", title: "Title", company: "Company",
    location: "Location", ai_score: "Score", status: "Status",
    attendee_type: "Type", attendee_type_detail: "Type Detail",
    linkedin_headline: "Headline", linkedin_about: "About",
    linkedin_experience: "Experience", linkedin_url: "LinkedIn URL",
    education: "Education", ai_review: "AI Review",
    ai_reasoning: "AI Reasoning", panel_votes: "Panel Votes",
    accepting_judges: "Accepting Judges",
  };

  const handleExportCSV = useCallback(() => {
    if (applicants.length === 0) return;
    const skipKeys = new Set(["applicant_id", "session_id"]);
    const allKeys = new Set<string>();
    for (const a of applicants) {
      for (const key of Object.keys(a)) {
        if (!skipKeys.has(key)) allKeys.add(key);
      }
    }
    const priorityOrder = ["name", "email", "status", "ai_score", "ai_reasoning", "company", "title", "location", "linkedin_url"];
    const headers = [
      ...priorityOrder.filter((k) => allKeys.has(k)),
      ...[...allKeys].filter((k) => !priorityOrder.includes(k)).sort(),
    ];

    const escapeCSV = (val: unknown) => {
      const s = String(val ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const rows = [headers.join(",")];
    const sorted = [...applicants].sort((a, b) => {
      const sa = a.ai_score ? parseInt(a.ai_score as string) : 0;
      const sb = b.ai_score ? parseInt(b.ai_score as string) : 0;
      return sb - sa;
    });
    for (const a of sorted) {
      rows.push(headers.map((h) => escapeCSV(a[h])).join(","));
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `demo-day-results-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported!");
  }, [applicants]);

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.updateApplicant(id, { status });
      toast.success(`Moved to ${status}`);
      refreshApplicants();
      refreshStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  };

  const handleBulkStatusChange = async (status: string) => {
    if (selectedIds.size === 0) return;
    try {
      await api.batchUpdateStatus([...selectedIds], status);
      toast.success(`Moved ${selectedIds.size} applicants to ${status}`);
      setSelectedIds(new Set());
      refreshApplicants();
      refreshStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await api.deleteSession(sessionId);
      toast.success("Applicant data cleared. Session preserved.");
      refreshSessions();
      refreshApplicants();
      refreshStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete session");
    }
  };

  const selectedApplicant = selectedApplicantId
    ? applicants.find((a) => a.applicant_id === selectedApplicantId) || null
    : null;

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredApplicants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredApplicants.map((a) => a.applicant_id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "accepted": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "waitlisted": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "rejected": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Session Picker */}
          <Select
            value={activeSessionId || "all"}
            onValueChange={(v) => {
              setActiveSessionId(v === "all" ? undefined : v);
              setSelectedIds(new Set());
            }}
          >
            <SelectTrigger className="h-10 w-full sm:w-[220px]">
              <FolderOpen className="size-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Sessions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sessions</SelectItem>
              {sessions.map((s) => (
                <SelectItem key={s.session_id} value={s.session_id}>
                  {s.name} ({s.applicant_count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeSessionId && (
            <Button
              variant="ghost"
              size="icon"
              className="size-10 text-muted-foreground hover:text-destructive"
              onClick={() => {
                if (confirm("Clear all applicant data for this session? The session and its settings will be preserved.")) {
                  handleDeleteSession(activeSessionId);
                }
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowImportDialog(true)} className="h-10">
            <Upload className="size-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" onClick={() => setShowSettingsDialog(true)} className="h-10">
            <Settings2 className="size-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Empty-State Onboarding */}
      {applicants.length === 0 && !loadingApplicants ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Get Started</h2>
            <p className="text-muted-foreground">Import your applicants to begin reviewing</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
            <button
              onClick={() => setShowImportDialog(true)}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50 p-8 transition-colors"
            >
              <Upload className="size-10 text-muted-foreground" />
              <div className="text-center">
                <div className="font-semibold">Upload CSV File</div>
                <div className="text-sm text-muted-foreground mt-1">Drop a CSV or click to browse</div>
              </div>
            </button>
            <button
              onClick={() => {
                setShowImportDialog(true);
              }}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50 p-8 transition-colors"
            >
              <Sheet className="size-10 text-muted-foreground" />
              <div className="text-center">
                <div className="font-semibold">Google Sheet</div>
                <div className="text-sm text-muted-foreground mt-1">Paste your Sheet URL to connect</div>
              </div>
            </button>
          </div>
        </div>
      ) : (
      <>
      {/* Stats Cards */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
        {[
          { label: "Total", value: stats?.total ?? 0, filter: "all", color: "text-foreground" },
          { label: "Accepted", value: accepted.length, filter: "accepted", color: "text-green-600 dark:text-green-400" },
          { label: "Waitlisted", value: waitlisted.length, filter: "waitlisted", color: "text-yellow-600 dark:text-yellow-400" },
          { label: "Rejected", value: rejected.length, filter: "rejected", color: "text-red-600 dark:text-red-400" },
          { label: "Pending", value: pending.length, filter: "pending", color: "text-muted-foreground" },
        ].map(({ label, value, filter, color }) => (
          <Card
            key={filter}
            className={`cursor-pointer transition-colors hover:bg-muted/50 ${statusFilter === filter ? "ring-2 ring-primary" : ""}`}
            onClick={() => setStatusFilter(filter)}
          >
            <CardContent className="py-4 text-center">
              <div className={`text-3xl font-bold tabular-nums ${color}`}>
                {value}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts (collapsible) — only show when there's analysis data */}
      {applicants.some((a) => a.attendee_type || Number(a.ai_score) > 0) && (
        <Collapsible open={showChartsOpen} onOpenChange={setShowChartsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-sm text-muted-foreground gap-1.5">
              {showChartsOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              {showChartsOpen ? "Hide" : "Show"} Charts
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <AttendeeTypeCharts applicants={applicants} />
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Toolbar: Tabs + Search + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-auto overflow-x-auto">
          <TabsList className="flex-nowrap">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="accepted">Accepted</TabsTrigger>
            <TabsTrigger value="waitlisted">Waitlisted</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 flex-1 min-w-0 sm:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="pl-9 h-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Column visibility dropdown (T8) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Eye className="size-4 mr-1.5" />
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 max-h-72 overflow-y-auto" align="end">
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground mb-2">Toggle columns</p>
                {allColumns.map((col) => (
                  <label key={col} className="flex items-center gap-2 py-0.5 cursor-pointer text-sm">
                    <Checkbox
                      checked={tableColumns.includes(col)}
                      onCheckedChange={(checked) =>
                        setUserToggledColumns((prev) => ({ ...prev, [col]: !!checked }))
                      }
                    />
                    <span className="truncate">
                      {COLUMN_LABELS[col] || col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Expand/collapse all (T7) */}
          {applicants.some((a) => a.ai_reasoning) && (
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => {
                if (expandedRows.size > 0) {
                  setExpandedRows(new Set());
                } else {
                  setExpandedRows(new Set(filteredApplicants.map((a) => a.applicant_id)));
                }
              }}
            >
              {expandedRows.size > 0 ? <ChevronUp className="size-4 mr-1.5" /> : <ChevronDown className="size-4 mr-1.5" />}
              {expandedRows.size > 0 ? "Collapse" : "Expand"}
            </Button>
          )}

          {selectedIds.size > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <ArrowRightLeft className="size-4 mr-1.5" />
                  Move {selectedIds.size}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleBulkStatusChange("accepted")}>
                  <CheckCircle2 className="size-4 mr-2 text-green-500" />Accept
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkStatusChange("waitlisted")}>
                  <Clock className="size-4 mr-2 text-yellow-500" />Waitlist
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleBulkStatusChange("rejected")}>
                  <XCircle className="size-4 mr-2 text-red-500" />Reject
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Popover open={showLiAtInput} onOpenChange={setShowLiAtInput}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                onClick={() => {
                  if ((stats?.total ?? 0) === 0) {
                    toast.error("No applicants to enrich", { description: "Import applicants first." });
                    return;
                  }
                  handleEnrichLinkedIn();
                }}
                size="sm"
                className="h-9"
                disabled={enriching}
              >
                {enriching ? (
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                ) : (
                  <Linkedin className="size-4 mr-1.5" />
                )}
                {enriching
                  ? `Enriching${enrichProgress ? ` ${enrichProgress.completed}/${enrichProgress.total}` : "..."}`
                  : "Enrich LinkedIn"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">LinkedIn Session Cookie (optional)</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Paste your <code className="font-mono">li_at</code> cookie for better results on private profiles.
                    Leave blank to scrape public profiles.
                  </p>
                </div>
                <Input
                  type="password"
                  placeholder="AQEDAVpt7is..."
                  value={liAtCookie}
                  onChange={(e) => setLiAtCookie(e.target.value)}
                  className="h-9 font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  DevTools → Application → Cookies → linkedin.com → <code>li_at</code>
                </p>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleEnrichLinkedIn}
                >
                  <Linkedin className="size-4 mr-1.5" />
                  Start Enrichment
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            onClick={() => {
              if ((stats?.total ?? 0) === 0) {
                toast.error("No applicants to analyze", { description: "Import a CSV or connect a Google Sheet first." });
                return;
              }
              setWizardStep(0);
              setShowWizard(true);
            }}
            size="sm"
            className="h-9"
          >
            <Brain className="size-4 mr-1.5" />
            Run Analysis
          </Button>
          <Button
            variant={showCardScanner ? "default" : "outline"}
            onClick={() => setShowCardScanner(!showCardScanner)}
            size="sm"
            className="h-9"
          >
            <Layers className="size-4 mr-1.5" />
            {showCardScanner ? "Table" : "Cards"}
          </Button>
          <Button variant="outline" onClick={handleExportCSV} size="sm" className="h-9">
            <Download className="size-4 mr-1.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Post-analysis score threshold (T6) */}
      {applicants.some((a) => Number(a.ai_score) > 0) && (
        <Card className="border-dashed">
          <CardContent className="py-3 px-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Sparkles className="size-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium whitespace-nowrap">Score Cutoff</span>
                <Slider
                  value={[scoreCutoff]}
                  onValueChange={([v]) => setScoreCutoff(v)}
                  min={0}
                  max={100}
                  step={5}
                  className="w-48"
                />
                <span className="text-sm font-bold tabular-nums w-8">{scoreCutoff}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="text-green-600 font-medium">
                  {applicants.filter((a) => Number(a.ai_score) >= scoreCutoff && Number(a.ai_score) > 0).length} accept
                </span>
                <span>/</span>
                <span className="text-red-600 font-medium">
                  {applicants.filter((a) => Number(a.ai_score) > 0 && Number(a.ai_score) < scoreCutoff).length} reject
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={async () => {
                  const toAccept = applicants.filter((a) => Number(a.ai_score) >= scoreCutoff && Number(a.ai_score) > 0);
                  const toReject = applicants.filter((a) => Number(a.ai_score) > 0 && Number(a.ai_score) < scoreCutoff);
                  if (toAccept.length + toReject.length === 0) return;
                  try {
                    if (toAccept.length > 0) await api.batchUpdateStatus(toAccept.map((a) => a.applicant_id), "accepted");
                    if (toReject.length > 0) await api.batchUpdateStatus(toReject.map((a) => a.applicant_id), "rejected");
                    toast.success(`Applied cutoff: ${toAccept.length} accepted, ${toReject.length} rejected`);
                    refreshApplicants();
                    refreshStats();
                  } catch {
                    toast.error("Failed to apply cutoff");
                  }
                }}
              >
                Apply Cutoff
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Card Scanner Mode */}
      {showCardScanner ? (
        <ApplicantCardScanner
          applicants={filteredApplicants}
          onStatusChange={handleStatusChange}
          onClose={() => setShowCardScanner(false)}
        />
      ) : (
        /* Main Table */
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={filteredApplicants.length > 0 && selectedIds.size === filteredApplicants.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-10">#</TableHead>
                {tableColumns.map((key) => (
                  <TableHead
                    key={key}
                    className={`${key === "ai_score" ? "w-20 text-center" : key === "status" ? "w-28" : ""} cursor-pointer select-none hover:text-foreground transition-colors`}
                    onClick={() => {
                      if (sortBy === key) {
                        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                      } else {
                        setSortBy(key);
                        setSortDir(key === "ai_score" ? "desc" : "asc");
                      }
                    }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {COLUMN_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                      {sortBy === key ? (
                        sortDir === "asc" ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5 opacity-0 group-hover:opacity-30" />
                      )}
                    </span>
                  </TableHead>
                ))}
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingApplicants && (
                <TableRow>
                  <TableCell colSpan={tableColumns.length + 3} className="text-center py-12">
                    <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )}
              {!loadingApplicants && filteredApplicants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={tableColumns.length + 3} className="text-center py-12 text-muted-foreground">
                    {applicants.length === 0
                      ? "No applicants yet. Click Import above to upload a CSV."
                      : `No ${statusFilter !== "all" ? statusFilter : ""} applicants match your search.`.trim()}
                  </TableCell>
                </TableRow>
              )}
              {!loadingApplicants && filteredApplicants.map((a, i) => {
                const score = a.ai_score ? parseInt(a.ai_score) : 0;
                const scoreColorClass =
                  score >= 70 ? "text-green-600 dark:text-green-400"
                  : score >= 40 ? "text-yellow-600 dark:text-yellow-400"
                  : score > 0 ? "text-red-600 dark:text-red-400"
                  : "text-muted-foreground";

                return (
                  <React.Fragment key={a.applicant_id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setSelectedApplicantId(a.applicant_id)}
                    data-state={selectedIds.has(a.applicant_id) ? "selected" : undefined}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(a.applicant_id)}
                        onCheckedChange={() => toggleSelect(a.applicant_id)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm" onClick={(e) => e.stopPropagation()}>
                      <button
                        className="hover:text-foreground transition-colors"
                        onClick={() => {
                          setExpandedRows((prev) => {
                            const next = new Set(prev);
                            if (next.has(a.applicant_id)) next.delete(a.applicant_id);
                            else next.add(a.applicant_id);
                            return next;
                          });
                        }}
                      >
                        {expandedRows.has(a.applicant_id)
                          ? <ChevronUp className="size-3.5 inline mr-0.5" />
                          : <ChevronDown className="size-3.5 inline mr-0.5" />}
                        {i + 1}
                      </button>
                    </TableCell>
                    {tableColumns.map((key) => {
                      const val = a[key];
                      // Special rendering for known column types
                      if (key === "ai_score") {
                        return (
                          <TableCell key={key} className="text-center">
                            {score > 0 ? (
                              <span className={`font-bold tabular-nums ${scoreColorClass}`}>{score}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        );
                      }
                      if (key === "status") {
                        return (
                          <TableCell key={key}>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(String(val || "pending"))}`}>
                              {String(val || "pending").charAt(0).toUpperCase() + String(val || "pending").slice(1)}
                            </span>
                          </TableCell>
                        );
                      }
                      if (key === "attendee_type") {
                        return (
                          <TableCell key={key}>
                            {val ? (
                              <Badge variant="outline" className="text-xs font-normal">
                                {String(a.attendee_type_detail || val)}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                        );
                      }
                      if (key === "name") {
                        const displayName =
                          a.name ||
                          a.email ||
                          (a.title && a.company ? `${a.title} @ ${a.company}` : null) ||
                          a.company ||
                          "Unknown";
                        return (
                          <TableCell key={key} className="font-medium max-w-[200px] truncate">
                            {displayName}
                          </TableCell>
                        );
                      }
                      // Generic text cell
                      return (
                        <TableCell key={key} className="max-w-[200px] truncate text-muted-foreground">
                          {val != null && val !== "" ? String(val) : "—"}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8 text-xs">
                            <ArrowRightLeft className="size-3.5 mr-1" />
                            Move
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleStatusChange(a.applicant_id, "accepted")}>
                            <CheckCircle2 className="size-4 mr-2 text-green-500" />Accept
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(a.applicant_id, "waitlisted")}>
                            <Clock className="size-4 mr-2 text-yellow-500" />Waitlist
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleStatusChange(a.applicant_id, "rejected")}>
                            <XCircle className="size-4 mr-2 text-red-500" />Reject
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                  {expandedRows.has(a.applicant_id) && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={tableColumns.length + 3} className="py-3 px-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {a.ai_reasoning && (
                            <div>
                              <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">AI Reasoning</span>
                              <p className="mt-1 text-foreground whitespace-pre-wrap">{String(a.ai_reasoning)}</p>
                            </div>
                          )}
                          {a.attendee_type && (
                            <div className="space-y-2">
                              <div>
                                <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Classification</span>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  <Badge variant="outline">{String(a.attendee_type)}</Badge>
                                  {a.attendee_type_detail && a.attendee_type_detail !== a.attendee_type && (
                                    <Badge variant="secondary">{String(a.attendee_type_detail)}</Badge>
                                  )}
                                  {a.investor_level && (
                                    <Badge variant="secondary" className="text-xs">Investor: {String(a.investor_level)}</Badge>
                                  )}
                                </div>
                              </div>
                              {a.panel_votes && (
                                <div>
                                  <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">Panel Votes</span>
                                  <p className="mt-1">{String(a.panel_votes)}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Detail Panel (slide-out) */}
      <ApplicantDetailPanel
        applicant={selectedApplicant}
        onStatusChange={(id, status) => {
          handleStatusChange(id, status);
          // Refresh the selected applicant data
          refreshApplicants();
        }}
        onClose={() => setSelectedApplicantId(null)}
      />

      </>
      )}

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Import Applicants</DialogTitle>
            <DialogDescription>
              Upload a CSV file or connect a Google Sheet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 overflow-y-auto min-h-0">
            {/* CSV Upload */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Upload className="size-4" />
                CSV Upload
              </h4>
              <CSVUploader onUploadSuccess={handleUploadSuccess} sessionId={activeSessionId} />
            </div>

            <Separator />

            {/* Google Sheets */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Sheet className="size-4" />
                Google Sheet
                {sheetConnected && (
                  <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                    Connected
                  </Badge>
                )}
              </h4>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    className="h-10 text-sm"
                    disabled={sheetSyncing}
                  />
                  {!sheetConnected ? (
                    <Button
                      onClick={() => syncGoogleSheet()}
                      disabled={!sheetUrl.trim() || sheetSyncing}
                      className="h-10 px-4"
                    >
                      {sheetSyncing ? <Loader2 className="size-4 animate-spin mr-1" /> : <Link className="size-4 mr-1" />}
                      {sheetSyncing ? "Connecting..." : "Connect"}
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button variant="outline" onClick={() => syncGoogleSheet()} disabled={sheetSyncing} className="h-10 px-3">
                        {sheetSyncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSheetConnected(false);
                          setAutoSync(false);
                          setLastSyncTime(null);
                          setLastSyncResult(null);
                          localStorage.removeItem("google_sheet_url");
                          toast.info("Google Sheet disconnected");
                        }}
                        className="h-10 px-3 text-muted-foreground"
                      >
                        <Unplug className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {sheetConnected && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-lg border p-2.5">
                      <div>
                        <Label className="text-sm font-medium">Auto-sync (30s)</Label>
                      </div>
                      <Switch
                        checked={autoSync}
                        onCheckedChange={(checked) => {
                          setAutoSync(checked);
                          if (checked) toast.info("Auto-sync enabled (every 30s)");
                        }}
                      />
                    </div>

                    {lastSyncTime && lastSyncResult && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                        <RefreshCw className="size-3 shrink-0" />
                        <span>
                          Last sync at {lastSyncTime}: {lastSyncResult.total_in_sheet} rows
                          {lastSyncResult.new_count > 0 && (
                            <span className="text-green-600 font-medium"> (+{lastSyncResult.new_count} new)</span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Sheet must be set to &quot;Anyone with the link can view&quot;. Deduplicates by email.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog — unified settings page */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-[95vw] sm:max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Everything in one place. Configure once, run analysis anytime.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 flex-1 overflow-y-auto pr-1 min-h-0">

            {/* ── AI Provider ── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">AI Provider</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Provider</Label>
                  <Select value={provider} onValueChange={handleProviderChange}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Model</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {models.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">API Key</Label>
                  <a
                    href={provider === "openai" ? "https://platform.openai.com/api-keys" : "https://console.anthropic.com/settings/keys"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-500 hover:underline"
                  >
                    Get your {provider === "openai" ? "OpenAI" : "Anthropic"} key ↗
                  </a>
                </div>
                <div className="relative">
                  <Input
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Paste your API key here..."
                    className="pr-10 h-9 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Review Mode ── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Review Mode</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPanelConfig((p) => ({ ...p, enabled: false }))}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-colors ${
                    !panelConfig.enabled ? "border-primary bg-primary/5" : "border-muted hover:bg-muted/50"
                  }`}
                >
                  <User className="size-6 text-muted-foreground" />
                  <span className="text-xs font-medium">Single Reviewer</span>
                </button>
                <button
                  onClick={() => setPanelConfig((p) => ({ ...p, enabled: true }))}
                  className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-colors ${
                    panelConfig.enabled ? "border-primary bg-primary/5" : "border-muted hover:bg-muted/50"
                  }`}
                >
                  <Users className="size-6 text-muted-foreground" />
                  <span className="text-xs font-medium">Judge Panel</span>
                </button>
              </div>

              {panelConfig.enabled && (
                <div className="space-y-3 rounded-lg border p-3">
                  {/* Panel Size */}
                  <div className="flex items-center gap-3">
                    <Label className="text-xs whitespace-nowrap">Panel size</Label>
                    <div className="flex gap-1.5">
                      {PANEL_SIZES.map((size) => (
                        <button
                          key={size}
                          onClick={() => setPanelConfig((p) => ({
                            ...p,
                            panel_size: size,
                            judge_ids: p.judge_ids.slice(0, size),
                          }))}
                          className={`size-8 rounded text-xs font-medium transition-colors ${
                            panelConfig.panel_size === size ? "bg-primary text-primary-foreground" : "border hover:bg-muted/50"
                          }`}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {panelConfig.judge_ids.length}/{panelConfig.panel_size} picked
                    </span>
                  </div>

                  {/* Adjudication */}
                  <div className="flex items-center gap-3">
                    <Label className="text-xs whitespace-nowrap">Accept if</Label>
                    <RadioGroup
                      value={panelConfig.adjudication_mode}
                      onValueChange={(v) => setPanelConfig((p) => ({ ...p, adjudication_mode: v as "union" | "majority" }))}
                      className="flex gap-3"
                    >
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <RadioGroupItem value="union" />
                        <span className="text-xs">Any judge</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <RadioGroupItem value="majority" />
                        <span className="text-xs">Majority</span>
                      </label>
                    </RadioGroup>
                  </div>

                  {/* Roundtable */}
                  <RoundtableSelector
                    panelSize={panelConfig.panel_size}
                    judgeIds={panelConfig.judge_ids}
                    personaEdits={personaEdits}
                    onToggleJudge={handleToggleJudge}
                    onUpdatePersonaEdit={handleUpdatePersonaEdit}
                    onResetPersonaEdit={handleResetPersonaEdit}
                  />
                </div>
              )}
            </div>

            <Separator />

            {/* ── Selection Rules ── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Selection Rules</h3>

              {/* Venue Capacity */}
              <div className="flex items-center gap-3">
                <Label className="text-xs whitespace-nowrap w-24">Venue capacity</Label>
                {selectionPreferences.venue_capacity === null ? (
                  <button
                    onClick={() => setSelectionPreferences((p) => ({ ...p, venue_capacity: 200 }))}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    No limit (click to set)
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      value={selectionPreferences.venue_capacity ?? ""}
                      onChange={(e) => setSelectionPreferences((p) => ({ ...p, venue_capacity: e.target.value ? parseInt(e.target.value) : null }))}
                      className="h-8 w-24 text-sm"
                    />
                    <button
                      onClick={() => setSelectionPreferences((p) => ({ ...p, venue_capacity: null }))}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      Remove limit
                    </button>
                  </div>
                )}
              </div>

              {/* Relevance Filter */}
              <div className="flex items-center gap-3">
                <Label className="text-xs whitespace-nowrap w-24">Relevance</Label>
                <Select
                  value={selectionPreferences.relevance_filter}
                  onValueChange={(v) => setSelectionPreferences((p) => ({ ...p, relevance_filter: v }))}
                >
                  <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strict">Strict</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="loose">Loose</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Auto-Accept */}
              <div className="space-y-1.5">
                <Label className="text-xs">Auto-accept these types (skip AI scoring)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {SETTINGS_ATTENDEE_TYPES.map((t) => {
                    const checked = selectionPreferences.auto_accept_types.includes(t.key);
                    return (
                      <button
                        key={t.key}
                        onClick={() => setSelectionPreferences((p) => ({
                          ...p,
                          auto_accept_types: checked
                            ? p.auto_accept_types.filter((x) => x !== t.key)
                            : [...p.auto_accept_types, t.key],
                        }))}
                        className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                          checked ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/50"
                        }`}
                      >
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Attendee Mix */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                    <ChevronRight className="size-3" />
                    Target attendee mix (optional)
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 space-y-2">
                  {SETTINGS_ATTENDEE_TYPES.map((t) => {
                    const value = selectionPreferences.attendee_mix[t.key] ?? 0;
                    return (
                      <div key={t.key} className="flex items-center gap-2">
                        <span className="text-xs w-20 truncate">{t.label}</span>
                        <Slider
                          value={[value]}
                          min={0}
                          max={50}
                          step={5}
                          onValueChange={([v]) => setSelectionPreferences((p) => ({
                            ...p,
                            attendee_mix: { ...p.attendee_mix, [t.key]: v },
                          }))}
                          className="flex-1"
                        />
                        <span className="text-xs font-mono w-8 text-right">{value}%</span>
                      </div>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            </div>

            <Separator />

            {/* ── AI Prompt ── */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">AI Prompt</h3>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="Describe your event and ideal attendees..."
                className="resize-none text-sm"
              />

              {/* Criteria */}
              <div className="space-y-1.5">
                <Label className="text-xs">Evaluation criteria</Label>
                <div className="flex gap-2">
                  <Input
                    value={newCriterion}
                    onChange={(e) => setNewCriterion(e.target.value)}
                    placeholder="Add a criterion..."
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addCriterion(); }
                    }}
                  />
                  <Button variant="outline" size="icon" onClick={addCriterion} className="h-8 w-8">
                    <Plus className="size-3.5" />
                  </Button>
                </div>
                {criteria.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {criteria.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-2.5 py-1 text-xs">
                        {c}
                        <button onClick={() => removeCriterion(c)} className="text-muted-foreground hover:text-destructive">
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Custom Priorities */}
              <div className="space-y-1.5">
                <Label className="text-xs">Extra instructions (optional)</Label>
                <Textarea
                  value={selectionPreferences.custom_priorities}
                  onChange={(e) => setSelectionPreferences((p) => ({ ...p, custom_priorities: e.target.value }))}
                  rows={2}
                  placeholder="e.g. Prioritize people who have built AI products..."
                  className="resize-none text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                api.updatePromptSettings({ default_prompt: prompt, criteria }).catch(() => {});
                api.updateSelectionPreferences(selectionPreferences).catch(() => {});
                toast.success("Settings saved");
                setShowSettingsDialog(false);
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pre-Analysis Wizard */}
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="size-5 text-primary" />
              Run Analysis
            </DialogTitle>
            <DialogDescription>
              Review your settings before starting the analysis.
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 py-1">
            {["AI Provider", "Review Mode", "Selection Rules", "Prompt & Go"].map((label, i) => (
              <button
                key={i}
                onClick={() => setWizardStep(i)}
                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full transition-colors ${
                  i === wizardStep
                    ? "bg-primary text-primary-foreground"
                    : i < wizardStep
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                <span className="font-medium">{i + 1}</span>
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4">
            {/* Step 1: AI Provider */}
            {wizardStep === 0 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-1">AI Provider</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose your AI provider and enter your API key.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Provider</Label>
                    <Select value={provider} onValueChange={handleProviderChange}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Model</Label>
                    <Select value={model} onValueChange={setModel}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {models.map((m) => (
                          <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">API Key</Label>
                  <div className="relative">
                    <Input
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Paste your API key here..."
                      className="pr-10 h-9 text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Review Mode */}
            {wizardStep === 1 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Review Mode</h3>
                  <p className="text-sm text-muted-foreground">
                    Choose single reviewer or judge panel mode.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPanelConfig((p) => ({ ...p, enabled: false }))}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-colors ${
                      !panelConfig.enabled ? "border-primary bg-primary/5" : "border-muted hover:bg-muted/50"
                    }`}
                  >
                    <User className="size-6 text-muted-foreground" />
                    <span className="text-xs font-medium">Single Reviewer</span>
                    <span className="text-[10px] text-muted-foreground text-center">One AI reviews all applicants</span>
                  </button>
                  <button
                    onClick={() => setPanelConfig((p) => ({ ...p, enabled: true }))}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border-2 p-3 transition-colors ${
                      panelConfig.enabled ? "border-primary bg-primary/5" : "border-muted hover:bg-muted/50"
                    }`}
                  >
                    <Users className="size-6 text-muted-foreground" />
                    <span className="text-xs font-medium">Judge Panel</span>
                    <span className="text-[10px] text-muted-foreground text-center">Multiple AI judges with unique biases</span>
                  </button>
                </div>

                {panelConfig.enabled && (
                  <div className="space-y-3 rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <Label className="text-xs whitespace-nowrap">Panel size</Label>
                      <div className="flex gap-1.5">
                        {PANEL_SIZES.map((size) => (
                          <button
                            key={size}
                            onClick={() => setPanelConfig((p) => ({
                              ...p,
                              panel_size: size,
                              judge_ids: p.judge_ids.slice(0, size),
                            }))}
                            className={`size-8 rounded text-xs font-medium transition-colors ${
                              panelConfig.panel_size === size ? "bg-primary text-primary-foreground" : "border hover:bg-muted/50"
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {panelConfig.judge_ids.length}/{panelConfig.panel_size} picked
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <Label className="text-xs whitespace-nowrap">Accept if</Label>
                      <RadioGroup
                        value={panelConfig.adjudication_mode}
                        onValueChange={(v) => setPanelConfig((p) => ({ ...p, adjudication_mode: v as "union" | "majority" }))}
                        className="flex gap-3"
                      >
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <RadioGroupItem value="union" />
                          <span className="text-xs">Any judge</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <RadioGroupItem value="majority" />
                          <span className="text-xs">Majority</span>
                        </label>
                      </RadioGroup>
                    </div>

                    <RoundtableSelector
                      panelSize={panelConfig.panel_size}
                      judgeIds={panelConfig.judge_ids}
                      personaEdits={personaEdits}
                      onToggleJudge={handleToggleJudge}
                      onUpdatePersonaEdit={handleUpdatePersonaEdit}
                      onResetPersonaEdit={handleResetPersonaEdit}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Selection Rules */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Selection Rules</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure venue capacity, relevance filter, and auto-accept rules.
                  </p>
                </div>

                {/* Venue Capacity */}
                <div className="flex items-center gap-3">
                  <Label className="text-xs whitespace-nowrap w-24">Venue capacity</Label>
                  {selectionPreferences.venue_capacity === null ? (
                    <button
                      onClick={() => setSelectionPreferences((p) => ({ ...p, venue_capacity: 200 }))}
                      className="text-xs text-muted-foreground hover:text-foreground underline"
                    >
                      No limit (click to set)
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        value={selectionPreferences.venue_capacity ?? ""}
                        onChange={(e) => setSelectionPreferences((p) => ({ ...p, venue_capacity: e.target.value ? parseInt(e.target.value) : null }))}
                        className="h-8 w-24 text-sm"
                      />
                      <button
                        onClick={() => setSelectionPreferences((p) => ({ ...p, venue_capacity: null }))}
                        className="text-xs text-muted-foreground hover:text-foreground underline"
                      >
                        Remove limit
                      </button>
                    </div>
                  )}
                </div>

                {/* Relevance Filter */}
                <div className="flex items-center gap-3">
                  <Label className="text-xs whitespace-nowrap w-24">Relevance</Label>
                  <Select
                    value={selectionPreferences.relevance_filter}
                    onValueChange={(v) => setSelectionPreferences((p) => ({ ...p, relevance_filter: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="strict">Strict</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="loose">Loose</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Auto-Accept */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Auto-accept these types</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {SETTINGS_ATTENDEE_TYPES.map((t) => {
                      const checked = selectionPreferences.auto_accept_types.includes(t.key);
                      return (
                        <button
                          key={t.key}
                          onClick={() => setSelectionPreferences((p) => ({
                            ...p,
                            auto_accept_types: checked
                              ? p.auto_accept_types.filter((x) => x !== t.key)
                              : [...p.auto_accept_types, t.key],
                          }))}
                          className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            checked ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted/50"
                          }`}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Attendee Mix */}
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                      <ChevronRight className="size-3" />
                      Target attendee mix (optional)
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    {SETTINGS_ATTENDEE_TYPES.map((t) => {
                      const value = selectionPreferences.attendee_mix[t.key] ?? 0;
                      return (
                        <div key={t.key} className="flex items-center gap-2">
                          <span className="text-xs w-20 truncate">{t.label}</span>
                          <Slider
                            value={[value]}
                            min={0}
                            max={50}
                            step={5}
                            onValueChange={([v]) => setSelectionPreferences((p) => ({
                              ...p,
                              attendee_mix: { ...p.attendee_mix, [t.key]: v },
                            }))}
                            className="flex-1"
                          />
                          <span className="text-xs font-mono w-8 text-right">{value}%</span>
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            {/* Step 4: Prompt & Go */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold mb-1">Prompt & Criteria</h3>
                  <p className="text-sm text-muted-foreground">
                    Describe your event and how applicants should be evaluated.
                  </p>
                </div>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={3}
                  placeholder="Describe your event and ideal attendees..."
                  className="resize-none text-sm"
                />
                <div className="space-y-1.5">
                  <Label className="text-xs">Evaluation criteria</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newCriterion}
                      onChange={(e) => setNewCriterion(e.target.value)}
                      placeholder="Add a criterion..."
                      className="h-8 text-xs"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); addCriterion(); }
                      }}
                    />
                    <Button variant="outline" size="icon" onClick={addCriterion} className="h-8 w-8">
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  {criteria.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {criteria.map((c) => (
                        <span key={c} className="inline-flex items-center gap-1 rounded-full border bg-muted/30 px-2.5 py-1 text-xs">
                          {c}
                          <button onClick={() => removeCriterion(c)} className="text-muted-foreground hover:text-destructive">
                            <X className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Extra instructions (optional)</Label>
                  <Textarea
                    value={selectionPreferences.custom_priorities}
                    onChange={(e) => setSelectionPreferences((p) => ({ ...p, custom_priorities: e.target.value }))}
                    rows={2}
                    placeholder="e.g. Prioritize people who have built AI products..."
                    className="resize-none text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => setWizardStep((s) => s - 1)}
              disabled={wizardStep === 0}
              size="sm"
            >
              <ChevronLeft className="size-4 mr-1" />
              Back
            </Button>
            <div className="flex gap-2">
              {wizardStep < 3 ? (
                <Button
                  onClick={() => setWizardStep((s) => s + 1)}
                  size="sm"
                  disabled={wizardStep === 0 && !apiKey.trim()}
                >
                  Next
                  <ChevronRight className="size-4 ml-1" />
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    // Save settings to backend
                    api.updatePromptSettings({ default_prompt: prompt, criteria }).catch(() => {});
                    api.updateSelectionPreferences(selectionPreferences).catch(() => {});
                    // Close wizard and run analysis
                    setShowWizard(false);
                    handleAnalyze();
                  }}
                  size="sm"
                  disabled={!apiKey.trim()}
                >
                  <Sparkles className="size-4 mr-1.5" />
                  Run Analysis
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Analysis Dialog */}
      {/* Enrichment Progress Dialog */}
      <Dialog open={showEnrichDialog} onOpenChange={(open) => { if (!enriching) setShowEnrichDialog(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto" showCloseButton={!enriching}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {enriching ? (
                <Loader2 className="size-5 animate-spin text-primary" />
              ) : (
                <CheckCircle2 className="size-5 text-green-500" />
              )}
              {enriching ? "Scraping LinkedIn Profiles..." : "LinkedIn Enrichment Complete"}
            </DialogTitle>
            <DialogDescription>
              {enriching
                ? "Scraping public LinkedIn profiles via Scrapfly. Rate-limited requests auto-retry."
                : "All profiles have been processed."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {enrichProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {enrichProgress.completed} of {enrichProgress.total} profiles
                  </span>
                  <span className="font-mono">
                    {enrichProgress.total > 0 ? Math.round((enrichProgress.completed / enrichProgress.total) * 100) : 0}%
                    {enrichProgress.errors > 0 && (
                      <span className="text-red-500 ml-2">
                        ({enrichProgress.errors} {enrichProgress.errors === 1 ? "error" : "errors"})
                      </span>
                    )}
                  </span>
                </div>
                <Progress value={(enrichProgress.completed / enrichProgress.total) * 100} className="h-2.5" />
              </div>
            )}

            <ConsoleLog logs={enrichLogs} logRef={enrichLogRef} />
          </div>

          <DialogFooter>
            {enriching ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  if (enrichJobIdRef.current) {
                    try {
                      await api.cancelLinkedInJob(enrichJobIdRef.current);
                      toast.info("Cancellation requested");
                    } catch {
                      toast.error("Failed to cancel");
                    }
                  }
                }}
              >
                <X className="size-4 mr-1.5" />
                Cancel
              </Button>
            ) : (
              <Button onClick={() => setShowEnrichDialog(false)}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAnalysisDialog} onOpenChange={(open) => { if (!analyzing) setShowAnalysisDialog(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto" showCloseButton={!analyzing}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {analyzing ? (
                <Loader2 className="size-5 animate-spin text-primary" />
              ) : (
                <CheckCircle2 className="size-5 text-green-500" />
              )}
              {analyzing ? "Analyzing Applicants..." : "Analysis Complete"}
            </DialogTitle>
            <DialogDescription>
              {analyzing
                ? "The AI is reviewing each applicant individually."
                : "All applicants have been reviewed."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {analysisProgress && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {analysisProgress.completed} of {analysisProgress.total} steps
                  </span>
                  <span className="font-mono">
                    {analysisProgress.total > 0 ? Math.round((analysisProgress.completed / analysisProgress.total) * 100) : 0}%
                    {analysisProgress.errors > 0 && (
                      <span className="text-red-500 ml-2">
                        ({analysisProgress.errors} {analysisProgress.errors === 1 ? "error" : "errors"})
                      </span>
                    )}
                  </span>
                </div>
                <Progress value={(analysisProgress.completed / analysisProgress.total) * 100} className="h-2.5" />
              </div>
            )}

            <Collapsible defaultOpen>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1.5 w-full justify-start">
                  <Terminal className="size-3.5" />
                  Console Log
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <ConsoleLog logs={logs} logRef={logRef} />
              </CollapsibleContent>
            </Collapsible>
          </div>

          {!analyzing && (
            <DialogFooter>
              <Button onClick={() => setShowAnalysisDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
