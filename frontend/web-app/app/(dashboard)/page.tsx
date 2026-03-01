"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
import { api, type Applicant } from "@/lib/api";
import { useApplicants, useStats, useSessions } from "@/hooks/use-applicants";
import { CSVUploader } from "@/components/csv-uploader";

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
  { key: "alumni", label: "Stanford Alumni", color: "#3b82f6" },
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

  const emptyOverlay = (msg: string) => (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="text-sm text-muted-foreground">{msg}</span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Type summary badges */}
      <div className="flex flex-wrap gap-2">
        {ATTENDEE_TYPES.map((t) => {
          const c = typeCounts.find((tc) => tc.key === t.key);
          const count = c?.count || 0;
          return (
            <div
              key={t.key}
              className="flex items-center gap-2 rounded-lg border px-3 py-2"
              style={{ opacity: count > 0 ? 1 : 0.45 }}
            >
              <div className="size-3 rounded-full" style={{ backgroundColor: t.color }} />
              <span className="text-sm font-medium">{t.label}</span>
              <span className="text-lg font-bold tabular-nums">{count}</span>
              {hasData && count > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({Math.round((count / applicants.length) * 100)}%)
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* 1. Detailed Attendee Breakdown Pie — splits "other" into specific roles */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Attendee Breakdown</CardTitle>
            <CardDescription className="text-xs">Distribution by role (Others shown by specific role)</CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={detailedNonZero.length > 0 ? detailedNonZero : [{ label: "No data", count: 1, color: "#e5e7eb", key: "empty" }]}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  label={detailedNonZero.length > 0 ? ({ label, count }: { label: string; count: number }) => `${label} (${count})` : false}
                  labelLine={detailedNonZero.length > 0}
                >
                  {(detailedNonZero.length > 0 ? detailedNonZero : [{ key: "empty", color: "#e5e7eb" }]).map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            {!hasTypes && emptyOverlay("Run AI analysis to see breakdown")}
          </CardContent>
        </Card>

        {/* 2. Score Distribution Histogram */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Score Distribution</CardTitle>
            <CardDescription className="text-xs">AI scores across all applicants</CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={scoreDistribution} margin={{ left: -10 }}>
                <XAxis dataKey="range" tick={{ fontSize: 11 }} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Applicants" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {!hasScores && emptyOverlay("Run AI analysis to see scores")}
          </CardContent>
        </Card>

        {/* 3. Avg AI Score by Type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Avg Score by Type</CardTitle>
            <CardDescription className="text-xs">Mean AI score per attendee group</CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={avgScoreByType} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => [`${value}/100`, "Avg Score"]} />
                <Bar dataKey="avg" name="Avg Score" radius={[0, 4, 4, 0]}>
                  {avgScoreByType.map((entry, i) => (
                    <Cell key={i} fill={entry.avg > 0 ? entry.color : "#e5e7eb"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {!hasScores && emptyOverlay("Run AI analysis to see scores")}
          </CardContent>
        </Card>

        {/* 4. Decisions by Type (stacked) */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Decisions by Type</CardTitle>
            <CardDescription className="text-xs">Accept / waitlist / reject per group</CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={typeStatusData} layout="vertical" margin={{ left: 10 }}>
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
            {!hasTypes && emptyOverlay("Run AI analysis to see decisions")}
          </CardContent>
        </Card>

        {/* 5. Acceptance Rate by Type */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Acceptance Rate</CardTitle>
            <CardDescription className="text-xs">% accepted per attendee group</CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={acceptRateByType} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value: number) => [`${value}%`, "Accept Rate"]} />
                <Bar dataKey="rate" name="Accept Rate" radius={[0, 4, 4, 0]}>
                  {acceptRateByType.map((entry, i) => (
                    <Cell key={i} fill={entry.rate > 0 ? entry.color : "#e5e7eb"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {!hasTypes && emptyOverlay("Run AI analysis to see rates")}
          </CardContent>
        </Card>

        {/* 6. Group Size Comparison */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Group Sizes</CardTitle>
            <CardDescription className="text-xs">Applicant count per type</CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={typeCounts} margin={{ left: -10 }}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-35} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" name="Applicants" radius={[4, 4, 0, 0]}>
                  {typeCounts.map((entry) => (
                    <Cell key={entry.key} fill={entry.count > 0 ? entry.color : "#e5e7eb"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {!hasTypes && emptyOverlay("Import applicants to see groups")}
          </CardContent>
        </Card>
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

  const goPrev = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const goNext = () => setCurrentIndex((i) => Math.min(sorted.length - 1, i + 1));

  const handleAction = (status: string) => {
    onStatusChange(current.applicant_id, status);
    if (currentIndex < sorted.length - 1) {
      setCurrentIndex((i) => i + 1);
    }
  };

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
      else if (e.key === "1") handleAction("accepted");
      else if (e.key === "2") handleAction("waitlisted");
      else if (e.key === "3") handleAction("rejected");
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

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
      className="bg-zinc-950 text-green-400 font-mono text-sm rounded-lg border border-zinc-800 p-4 h-72 overflow-y-auto"
    >
      {logs.length === 0 && (
        <span className="text-zinc-600">Waiting for activity...</span>
      )}
      {logs.map((log, i) => (
        <div key={i} className="leading-relaxed" style={log.color ? { color: log.color } : undefined}>
          <span className="text-zinc-500">[{log.time}]</span> {log.message}
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
    "ai_reasoning", "ai_review", "company", "title", "location", "linkedin_url", "attendee_type", "attendee_type_detail",
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
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [showCardScanner, setShowCardScanner] = useState(false);
  const [showChartsOpen, setShowChartsOpen] = useState(false);

  // Dialog state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showAnalysisDialog, setShowAnalysisDialog] = useState(false);

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
    "You are evaluating Demo Day applicants for CS 224G (Building & Scaling LLM Applications) at Stanford, Winter 2026. This is a project-based course where student teams build production-ready AI applications over 10 weeks. Evaluate each applicant based on their background and potential to contribute as an attendee/judge at Demo Day on March 19, 2026."
  );
  const [criteria, setCriteria] = useState<string[]>([
    "Relevant AI/ML or LLM experience",
    "Industry or academic standing",
    "Potential to provide valuable feedback to student teams",
    "Alignment with course themes (agents, RAG, reasoning models)",
  ]);
  const [newCriterion, setNewCriterion] = useState("");

  // Analysis progress state
  const [analysisProgress, setAnalysisProgress] = useState<{
    completed: number;
    total: number;
    errors: number;
  } | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

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
    if (savedSheetUrl) {
      setSheetUrl(savedSheetUrl);
      setSheetConnected(true);
    }
  }, []);

  // Load saved prompt settings
  useEffect(() => {
    api.getPromptSettings()
      .then((s) => {
        if (s.default_prompt) setPrompt(s.default_prompt);
        if (s.criteria?.length) setCriteria(s.criteria);
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

  // Auto-scroll console log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

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

  // Analyze
  const handleAnalyze = async () => {
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

    log(`Starting per-applicant analysis...`);
    log(`Provider: ${provider === "anthropic" ? "Anthropic" : "OpenAI"} | Model: ${modelLabel}`);
    log(`Prompt: "${prompt.substring(0, 80)}${prompt.length > 80 ? "..." : ""}"`);
    log(`Criteria: ${criteria.join(", ")}`);

    let acceptedCount = 0;
    let waitlistedCount = 0;
    let rejectedCount = 0;
    const typeTally: Record<string, number> = {};
    const typeNames: Record<string, string[]> = {};

    try {
      await api.updatePromptSettings({ default_prompt: prompt, criteria });
      log("Saved prompt settings.");
      log("Streaming analysis — each applicant analyzed individually...");
      log("─".repeat(60));

      await api.analyzeAllStream(
        { api_key: apiKey, model, provider, prompt, criteria, session_id: activeSessionId },
        {
          onStart: (data) => {
            setAnalysisProgress({ completed: 0, total: data.total, errors: 0 });
            log(`Analyzing ${data.total} applicants (concurrency: 10)...`);
          },
          onProgress: (data) => {
            setAnalysisProgress({ completed: data.completed, total: data.total, errors: data.errors });

            // Track type counts
            const type = data.attendee_type || "other";
            const typeLabel = ATTENDEE_TYPES.find((t) => t.key === type)?.label || type;
            const detail = data.attendee_type_detail || typeLabel;
            typeTally[type] = (typeTally[type] || 0) + 1;
            if (!typeNames[type]) typeNames[type] = [];
            typeNames[type].push(data.name);

            // Status color
            const statusColor = data.status === "accepted" ? "#22c55e" : data.status === "rejected" ? "#ef4444" : data.status === "waitlisted" ? "#eab308" : undefined;
            const statusLabel = data.status.toUpperCase();

            // Rich log line
            log(`[${data.completed}/${data.total}] ${data.name}  ·  ${detail}  ·  Score: ${data.score}  ·  ${statusLabel}`, statusColor);
            if (data.reasoning) {
              log(`   └─ ${data.reasoning}`, "#9ca3af");
            }

            if (data.status === "accepted") acceptedCount++;
            else if (data.status === "waitlisted") waitlistedCount++;
            else if (data.status === "rejected") rejectedCount++;
          },
          onError: (data) => {
            setAnalysisProgress({ completed: data.completed, total: data.total, errors: data.errors });
            log(`[${data.completed}/${data.total}] ${data.name} — ERROR: ${data.error}`, "#ef4444");
          },
          onComplete: (data) => {
            setAnalysisProgress({ completed: data.completed, total: data.total, errors: data.errors });
            log("─".repeat(60));
            log(`Analysis complete: ${acceptedCount} accepted, ${waitlistedCount} waitlisted, ${rejectedCount} rejected` +
              (data.errors > 0 ? ` (${data.errors} errors)` : ""));

            // Category summary
            log("");
            log("CATEGORY BREAKDOWN:", "#6366f1");
            for (const t of ATTENDEE_TYPES) {
              const count = typeTally[t.key] || 0;
              const pct = data.completed > 0 ? Math.round((count / data.completed) * 100) : 0;
              const bar = "█".repeat(Math.max(1, Math.round(pct / 3))) + (count === 0 ? "░" : "");
              const names = typeNames[t.key]?.slice(0, 3).join(", ") || "—";
              const moreCount = (typeNames[t.key]?.length || 0) - 3;
              log(`  ${t.label.padEnd(24)} ${String(count).padStart(3)} (${String(pct).padStart(2)}%) ${bar}`, t.color);
              if (count > 0) {
                log(`     └─ ${names}${moreCount > 0 ? `, +${moreCount} more` : ""}`, "#9ca3af");
              }
            }

            // Balance check
            log("");
            log("BALANCE CHECK:", "#6366f1");
            const total = data.completed;
            const alerts: string[] = [];
            for (const t of ATTENDEE_TYPES) {
              const count = typeTally[t.key] || 0;
              if (t.key === "other") continue;
              if (count === 0) {
                alerts.push(`⚠ No ${t.label} found — consider sourcing more`);
              } else if (count < Math.ceil(total * 0.03)) {
                alerts.push(`⚠ Only ${count} ${t.label} (${Math.round((count / total) * 100)}%) — may want more representation`);
              }
            }
            const otherCount = typeTally["other"] || 0;
            if (otherCount > total * 0.4) {
              alerts.push(`⚠ ${otherCount} "Other" (${Math.round((otherCount / total) * 100)}%) — high proportion of uncategorized attendees`);
            }
            if (alerts.length === 0) {
              log("  ✓ Good mix across all categories", "#22c55e");
            } else {
              for (const a of alerts) {
                log(`  ${a}`, "#eab308");
              }
            }
          },
        }
      );

      toast.success(
        `Analysis complete: ${acceptedCount} accepted, ${waitlistedCount} waitlisted, ${rejectedCount} rejected`
      );

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
      list = list.filter((a) => {
        const name = (a.name || "").toLowerCase();
        const email = (a.email || "").toLowerCase();
        const company = (a.company || "").toLowerCase();
        const title = (a.title || "").toLowerCase();
        return name.includes(q) || email.includes(q) || company.includes(q) || title.includes(q);
      });
    }
    return [...list].sort((a, b) => {
      const sa = a.ai_score ? parseInt(a.ai_score) : 0;
      const sb = b.ai_score ? parseInt(b.ai_score) : 0;
      return sb - sa;
    });
  }, [applicants, statusFilter, searchQuery]);

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
      toast.success("Session deleted");
      if (activeSessionId === sessionId) {
        setActiveSessionId(undefined);
      }
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
            <SelectTrigger className="h-10 w-[220px]">
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
                if (confirm("Delete this session and all its applicants?")) {
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

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-3">
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

      {/* Charts (collapsible) */}
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

      {/* Toolbar: Tabs + Search + Actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-auto">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="accepted">Accepted</TabsTrigger>
            <TabsTrigger value="waitlisted">Waitlisted</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 flex-1 min-w-0 max-w-md">
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

        <div className="flex items-center gap-2">
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

          <Button
            onClick={handleAnalyze}
            disabled={!apiKey.trim() || (stats?.total ?? 0) === 0}
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
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="w-20 text-center">Score</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingApplicants && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )}
              {!loadingApplicants && filteredApplicants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    {applicants.length === 0
                      ? "No applicants yet. Import a CSV or connect a Google Sheet."
                      : "No applicants match your filter."}
                  </TableCell>
                </TableRow>
              )}
              {!loadingApplicants && filteredApplicants.map((a, i) => {
                const score = a.ai_score ? parseInt(a.ai_score) : 0;
                const scoreColor =
                  score >= 70 ? "text-green-600 dark:text-green-400"
                  : score >= 40 ? "text-yellow-600 dark:text-yellow-400"
                  : score > 0 ? "text-red-600 dark:text-red-400"
                  : "text-muted-foreground";
                const displayName =
                  a.name ||
                  a.email ||
                  (a.title && a.company ? `${a.title} @ ${a.company}` : null) ||
                  a.company ||
                  "Unknown";

                return (
                  <TableRow
                    key={a.applicant_id}
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
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      {displayName}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[150px] truncate">
                      {a.company || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {score > 0 ? (
                        <span className={`font-bold tabular-nums ${scoreColor}`}>{score}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(a.status)}`}>
                        {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {a.attendee_type ? (
                        <Badge variant="outline" className="text-xs font-normal">
                          {a.attendee_type_detail || a.attendee_type}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
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

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
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

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Configure AI provider, prompt, and evaluation criteria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            {/* API Key */}
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Key className="size-4" />
                API Key
              </Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste your API key here..."
                  className="pr-10 h-10"
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

            {/* Provider + Model */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">Provider</Label>
                <Select value={provider} onValueChange={handleProviderChange}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Prompt */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">AI Instructions</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="Describe your event and ideal attendees..."
                className="resize-none text-sm"
              />
            </div>

            {/* Criteria */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Evaluation Criteria</Label>
              <div className="flex gap-2">
                <Input
                  value={newCriterion}
                  onChange={(e) => setNewCriterion(e.target.value)}
                  placeholder="Add a criterion..."
                  className="h-9 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCriterion();
                    }
                  }}
                />
                <Button variant="outline" size="icon" onClick={addCriterion} className="h-9 w-9">
                  <Plus className="size-4" />
                </Button>
              </div>
              {criteria.length > 0 && (
                <div className="space-y-1.5">
                  {criteria.map((c, i) => (
                    <div key={c} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                      <GripVertical className="size-3.5 text-muted-foreground" />
                      <span className="text-muted-foreground font-mono text-xs w-5">{i + 1}.</span>
                      <span className="flex-1">{c}</span>
                      <button onClick={() => removeCriterion(c)} className="text-muted-foreground hover:text-destructive p-0.5">
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                api.updatePromptSettings({ default_prompt: prompt, criteria })
                  .then(() => toast.success("Settings saved"))
                  .catch(() => toast.error("Failed to save settings"));
                setShowSettingsDialog(false);
              }}
            >
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Analysis Dialog */}
      <Dialog open={showAnalysisDialog} onOpenChange={(open) => { if (!analyzing) setShowAnalysisDialog(open); }}>
        <DialogContent className="sm:max-w-2xl" showCloseButton={!analyzing}>
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
                    {analysisProgress.completed} of {analysisProgress.total} reviewed
                  </span>
                  <span className="font-mono">
                    {Math.round((analysisProgress.completed / analysisProgress.total) * 100)}%
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

            <ConsoleLog logs={logs} logRef={logRef} />
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
