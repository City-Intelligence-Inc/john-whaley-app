"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  Search,
  X,
  Eye,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  XCircle,
  Download,
  ExternalLink,
  Linkedin,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api";
import type { Applicant } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

const COLUMN_LABELS: Record<string, string> = {
  name: "Name",
  email: "Email",
  title: "Title",
  company: "Company",
  location: "Location",
  ai_score: "Score",
  status: "Status",
  attendee_type: "Type",
  attendee_type_detail: "Type Detail",
  linkedin_headline: "Headline",
  linkedin_about: "About",
  linkedin_url: "LinkedIn URL",
  ai_review: "AI Review",
  ai_reasoning: "AI Reasoning",
  panel_votes: "Panel Votes",
  accepting_judges: "Accepting Judges",
};

/** Columns that are never shown in the table. */
const HIDDEN_KEYS = new Set([
  "applicant_id",
  "session_id",
  "user_override_attendee_type",
  "user_override_attendee_type_detail",
  "luma_guest_id",
  "luma_status",
  "verification_flags",
  "vc_fund_name",
  "linkedin_experience",
]);

/** Columns hidden by default (e.g. Luma CSV noise). */
const DEFAULT_HIDDEN = new Set([
  "amount",
  "amount_discount",
  "tax",
  "currency",
  "created_at",
  "event_id",
  "order_id",
  "payment_id",
  "coupon_code",
  "checkout_custom_questions",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "investor_professional",
  "vc_seniority_tier",
]);

/** Columns that appear first when present. */
const PRIORITY_COLS = [
  "name",
  "email",
  "title",
  "company",
  "location",
  "ai_score",
  "status",
  "attendee_type",
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function scoreColorClass(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  if (score > 0) return "text-red-400";
  return "text-muted-foreground";
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "accepted":
      return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20";
    case "waitlisted":
      return "bg-amber-500/15 text-amber-400 border border-amber-500/20";
    case "rejected":
      return "bg-red-500/15 text-red-400 border border-red-500/20";
    default:
      return "bg-muted text-muted-foreground border border-border";
  }
}

function rowStatusBg(status: string): string {
  switch (status) {
    case "accepted":
      return "bg-emerald-500/5";
    case "rejected":
      return "bg-red-500/5";
    case "waitlisted":
      return "bg-amber-500/5";
    default:
      return "";
  }
}

function displayName(a: Applicant): string {
  return (
    a.name ||
    a.email ||
    (a.title && a.company ? `${a.title} @ ${a.company}` : null) ||
    a.company ||
    "Unknown"
  );
}

function escapeCSV(val: unknown): string {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

export interface ApplicantTableProps {
  applicants: Applicant[];
  onStatusChange: (id: string, status: string) => void;
  /** Called when a row is clicked to view the detail sheet. Alias: onSelectApplicant */
  onSelect?: (id: string) => void;
  /** Alias for onSelect -- use either one. */
  onSelectApplicant?: (id: string | null) => void;
  sessionId?: string;
  /** Controlled status filter -- if provided, the table uses this instead of internal state. */
  statusFilter?: string;
  /** Called when the status filter tabs change (controlled mode). */
  onStatusFilterChange?: (filter: string) => void;
  /** Optional set of whitelisted emails (lowercased). */
  whitelistedEmails?: Set<string>;
  /** Optional set of blacklisted emails (lowercased). */
  blacklistedEmails?: Set<string>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function ApplicantTable({
  applicants,
  onStatusChange,
  onSelect,
  onSelectApplicant,
  sessionId,
  statusFilter: controlledStatusFilter,
  onStatusFilterChange,
  whitelistedEmails,
  blacklistedEmails,
}: ApplicantTableProps) {
  // Resolve the select handler -- support both prop names
  const handleSelect = useCallback(
    (id: string) => {
      onSelect?.(id);
      onSelectApplicant?.(id);
    },
    [onSelect, onSelectApplicant],
  );

  // ── UI state ──
  const [internalStatusFilter, setInternalStatusFilter] = useState("all");

  // Support controlled + uncontrolled status filter
  const statusFilter = controlledStatusFilter ?? internalStatusFilter;
  const setStatusFilter = useCallback(
    (filter: string) => {
      if (onStatusFilterChange) {
        onStatusFilterChange(filter);
      } else {
        setInternalStatusFilter(filter);
      }
    },
    [onStatusFilterChange],
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<string>("ai_score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [userToggledColumns, setUserToggledColumns] = useState<
    Record<string, boolean>
  >({});

  // ── Derived columns ──
  const { allColumns, tableColumns } = useMemo(() => {
    const seen = new Set<string>();
    const allEmpty = new Set<string>();

    for (const a of applicants) {
      for (const key of Object.keys(a)) {
        if (!HIDDEN_KEYS.has(key)) seen.add(key);
      }
    }

    for (const key of seen) {
      const isEmpty = applicants.every((a) => {
        const v = a[key];
        return v === undefined || v === null || v === "" || v === "0" || v === 0;
      });
      if (isEmpty) allEmpty.add(key);
    }

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

  // ── Filtered + sorted ──
  const filteredApplicants = useMemo(() => {
    let list = applicants;

    if (statusFilter !== "all") {
      list = list.filter((a) => a.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((a) =>
        Object.values(a).some(
          (v) => v != null && String(v).toLowerCase().includes(q),
        ),
      );
    }

    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "ai_score") {
        cmp =
          (parseInt(String(a.ai_score || "0")) || 0) -
          (parseInt(String(b.ai_score || "0")) || 0);
      } else {
        const va = String(a[sortField] ?? "");
        const vb = String(b[sortField] ?? "");
        cmp = va.localeCompare(vb);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [applicants, statusFilter, searchQuery, sortField, sortDir]);

  // ── Selection helpers ──
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredApplicants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(
        new Set(filteredApplicants.map((a) => a.applicant_id)),
      );
    }
  }, [selectedIds.size, filteredApplicants]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Bulk status ──
  const handleBulkStatusChange = useCallback(
    async (status: string) => {
      if (selectedIds.size === 0) return;
      try {
        await api.batchUpdateStatus([...selectedIds], status);
        toast.success(`Moved ${selectedIds.size} applicants to ${status}`);
        setSelectedIds(new Set());
        // parent should refresh via onStatusChange side effect or polling
        for (const id of selectedIds) {
          onStatusChange(id, status);
        }
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Failed to update",
        );
      }
    },
    [selectedIds, onStatusChange],
  );

  // ── Expand helpers ──
  const toggleExpandAll = useCallback(() => {
    if (expandedRows.size > 0) {
      setExpandedRows(new Set());
    } else {
      setExpandedRows(
        new Set(filteredApplicants.map((a) => a.applicant_id)),
      );
    }
  }, [expandedRows.size, filteredApplicants]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // ── Sort handler ──
  const handleSort = useCallback(
    (key: string) => {
      if (sortField === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(key);
        setSortDir(key === "ai_score" ? "desc" : "asc");
      }
    },
    [sortField],
  );

  // ── CSV export ──
  const handleExportCSV = useCallback(() => {
    if (filteredApplicants.length === 0) return;
    const skipKeys = new Set(["applicant_id", "session_id"]);
    const allKeys = new Set<string>();
    for (const a of filteredApplicants) {
      for (const key of Object.keys(a)) {
        if (!skipKeys.has(key)) allKeys.add(key);
      }
    }
    const priorityOrder = [
      "name",
      "email",
      "status",
      "ai_score",
      "ai_reasoning",
      "company",
      "title",
      "location",
      "linkedin_url",
    ];
    const headers = [
      ...priorityOrder.filter((k) => allKeys.has(k)),
      ...[...allKeys].filter((k) => !priorityOrder.includes(k)).sort(),
    ];

    const rows = [headers.join(",")];
    const sorted = [...filteredApplicants].sort((a, b) => {
      const sa = a.ai_score ? parseInt(a.ai_score) : 0;
      const sb = b.ai_score ? parseInt(b.ai_score) : 0;
      return sb - sa;
    });
    for (const a of sorted) {
      rows.push(headers.map((h) => escapeCSV(a[h])).join(","));
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `applicants${sessionId ? `-${sessionId}` : ""}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }, [filteredApplicants, sessionId]);

  // ── Whitelist / blacklist badge ──
  const listBadge = useCallback(
    (a: Applicant) => {
      const email = a.email?.toLowerCase();
      if (email && whitelistedEmails?.has(email)) {
        return (
          <span title="Whitelisted">
            <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" />
          </span>
        );
      }
      if (email && blacklistedEmails?.has(email)) {
        return (
          <span title="Blacklisted">
            <ShieldAlert className="size-3.5 text-red-500 shrink-0" />
          </span>
        );
      }
      return null;
    },
    [whitelistedEmails, blacklistedEmails],
  );

  // ── Render ──
  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
        {/* Status tabs */}
        <Tabs
          value={statusFilter}
          onValueChange={setStatusFilter}
          className="w-auto overflow-x-auto"
        >
          <TabsList className="flex-nowrap">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="accepted">Accepted</TabsTrigger>
            <TabsTrigger value="waitlisted">Waitlisted</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-0 sm:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, email, company..."
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

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Column visibility */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Eye className="size-4 mr-1.5" />
                Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-56 max-h-72 overflow-y-auto"
              align="end"
            >
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Toggle columns
                </p>
                {allColumns.map((col) => (
                  <label
                    key={col}
                    className="flex items-center gap-2 py-0.5 cursor-pointer text-sm"
                  >
                    <Checkbox
                      checked={tableColumns.includes(col)}
                      onCheckedChange={(checked) =>
                        setUserToggledColumns((prev) => ({
                          ...prev,
                          [col]: !!checked,
                        }))
                      }
                    />
                    <span className="truncate">
                      {COLUMN_LABELS[col] ||
                        col
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  </label>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Expand / collapse all */}
          {applicants.some((a) => a.ai_reasoning) && (
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={toggleExpandAll}
            >
              {expandedRows.size > 0 ? (
                <ChevronUp className="size-4 mr-1.5" />
              ) : (
                <ChevronDown className="size-4 mr-1.5" />
              )}
              {expandedRows.size > 0 ? "Collapse" : "Expand"}
            </Button>
          )}

          {/* Bulk actions */}
          {selectedIds.size > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9">
                  <ArrowRightLeft className="size-4 mr-1.5" />
                  Move {selectedIds.size}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleBulkStatusChange("accepted")}
                >
                  <CheckCircle2 className="size-4 mr-2 text-green-500" />
                  Accept
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleBulkStatusChange("waitlisted")}
                >
                  <Clock className="size-4 mr-2 text-yellow-500" />
                  Waitlist
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleBulkStatusChange("rejected")}
                >
                  <XCircle className="size-4 mr-2 text-red-500" />
                  Reject
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Export CSV */}
          <Button
            variant="outline"
            onClick={handleExportCSV}
            size="sm"
            className="h-9"
          >
            <Download className="size-4 mr-1.5" />
            Export
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-auto max-h-[calc(100vh-280px)]">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-secondary border-b-2 border-border">
              {/* Checkbox column */}
              <th className="sticky left-0 z-20 bg-secondary w-10 px-3 py-2 border-r border-border">
                <Checkbox
                  checked={
                    filteredApplicants.length > 0 &&
                    selectedIds.size === filteredApplicants.length
                  }
                  onCheckedChange={toggleSelectAll}
                />
              </th>

              {/* Row number / expand */}
              <th className="w-10 px-2 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r border-border">
                #
              </th>

              {/* Data columns */}
              {tableColumns.map((key) => (
                <th
                  key={key}
                  className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-r border-border cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap ${
                    key === "ai_score" ? "text-center" : ""
                  }`}
                  onClick={() => handleSort(key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {COLUMN_LABELS[key] ||
                      key
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())}
                    {sortField === key ? (
                      sortDir === "asc" ? (
                        <ChevronUp className="size-3" />
                      ) : (
                        <ChevronDown className="size-3" />
                      )
                    ) : null}
                  </span>
                </th>
              ))}

              {/* Actions column */}
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {/* Empty state */}
            {filteredApplicants.length === 0 && (
              <tr>
                <td
                  colSpan={tableColumns.length + 3}
                  className="text-center py-12 text-muted-foreground"
                >
                  {applicants.length === 0
                    ? "No applicants yet. Import applicants to get started."
                    : `No ${statusFilter !== "all" ? statusFilter : ""} applicants match your search.`.trim()}
                </td>
              </tr>
            )}

            {/* Data rows */}
            {filteredApplicants.map((a, i) => {
              const score = a.ai_score ? parseInt(a.ai_score) : 0;
              const scc = scoreColorClass(score);
              const rBg = rowStatusBg(a.status);
              const isSelected = selectedIds.has(a.applicant_id);
              const isExpanded = expandedRows.has(a.applicant_id);
              const name = displayName(a);
              const photoUrl = (a.image || a.photo_url) as
                | string
                | undefined;
              const initials = name
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <React.Fragment key={a.applicant_id}>
                  <tr
                    className={`border-b border-border/50 cursor-pointer hover:bg-gold/5 transition-colors ${rBg} ${isSelected ? "bg-gold/10" : ""}`}
                    onClick={() => handleSelect(a.applicant_id)}
                  >
                    {/* Checkbox */}
                    <td
                      className="sticky left-0 z-[5] px-3 py-1.5 border-r border-border bg-inherit"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() =>
                          toggleSelect(a.applicant_id)
                        }
                      />
                    </td>

                    {/* Row number + expand toggle */}
                    <td
                      className="px-2 py-1.5 text-muted-foreground font-mono text-xs border-r border-border"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        className="hover:text-foreground transition-colors"
                        onClick={() => toggleExpand(a.applicant_id)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="size-3 inline mr-0.5" />
                        ) : (
                          <ChevronDown className="size-3 inline mr-0.5" />
                        )}
                        {i + 1}
                      </button>
                    </td>

                    {/* Data cells */}
                    {tableColumns.map((key) => {
                      const val = a[key];

                      // ── Score ──
                      if (key === "ai_score") {
                        return (
                          <td
                            key={key}
                            className="px-3 py-1.5 text-center border-r border-border/50"
                          >
                            {score > 0 ? (
                              <span
                                className={`font-bold tabular-nums ${scc}`}
                              >
                                {score}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">
                                --
                              </span>
                            )}
                          </td>
                        );
                      }

                      // ── Status ──
                      if (key === "status") {
                        const st = String(val || "pending");
                        return (
                          <td
                            key={key}
                            className="px-3 py-1.5 border-r border-border/50"
                          >
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(st)}`}
                            >
                              {st.charAt(0).toUpperCase() + st.slice(1)}
                            </span>
                          </td>
                        );
                      }

                      // ── Attendee type ──
                      if (key === "attendee_type") {
                        return (
                          <td
                            key={key}
                            className="px-3 py-1.5 border-r border-border/50"
                          >
                            {val ? (
                              <Badge
                                variant="outline"
                                className="text-xs font-normal"
                              >
                                {String(
                                  a.attendee_type_detail || val,
                                )}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">
                                --
                              </span>
                            )}
                          </td>
                        );
                      }

                      // ── Name ──
                      if (key === "name") {
                        return (
                          <td
                            key={key}
                            className="px-3 py-1.5 font-medium max-w-[240px] border-r border-border/50"
                          >
                            <div className="flex items-center gap-2">
                              {photoUrl ? (
                                <img
                                  src={photoUrl}
                                  alt=""
                                  className="size-6 rounded-full object-cover shrink-0"
                                />
                              ) : (
                                <div className="size-6 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium text-muted-foreground shrink-0">
                                  {initials}
                                </div>
                              )}
                              <span className="truncate">{name}</span>
                              {listBadge(a)}
                            </div>
                          </td>
                        );
                      }

                      // ── LinkedIn URL ──
                      if (key === "linkedin_url" && val) {
                        return (
                          <td
                            key={key}
                            className="px-3 py-1.5 border-r border-border/50"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a
                              href={String(val)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-xs"
                            >
                              <Linkedin className="size-3.5" />
                              Profile
                              <ExternalLink className="size-3" />
                            </a>
                          </td>
                        );
                      }

                      // ── Default ──
                      return (
                        <td
                          key={key}
                          className="px-3 py-1.5 max-w-[200px] truncate text-muted-foreground border-r border-border/50"
                        >
                          {val != null && val !== ""
                            ? String(val)
                            : "--"}
                        </td>
                      );
                    })}

                    {/* Actions cell */}
                    <td
                      className="px-3 py-1.5 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2"
                          >
                            <ArrowRightLeft className="size-3.5 mr-1" />
                            Move
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              onStatusChange(
                                a.applicant_id,
                                "accepted",
                              )
                            }
                          >
                            <CheckCircle2 className="size-4 mr-2 text-green-500" />
                            Accept
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              onStatusChange(
                                a.applicant_id,
                                "waitlisted",
                              )
                            }
                          >
                            <Clock className="size-4 mr-2 text-yellow-500" />
                            Waitlist
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              onStatusChange(
                                a.applicant_id,
                                "rejected",
                              )
                            }
                          >
                            <XCircle className="size-4 mr-2 text-red-500" />
                            Reject
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>

                  {/* Expanded reasoning row */}
                  {isExpanded && (
                    <tr className="bg-muted/30">
                      <td
                        colSpan={tableColumns.length + 3}
                        className="py-3 px-6"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          {a.ai_reasoning && (
                            <div>
                              <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                                AI Reasoning
                              </span>
                              <p className="mt-1 text-foreground whitespace-pre-wrap">
                                {String(a.ai_reasoning)}
                              </p>
                            </div>
                          )}
                          {a.attendee_type && (
                            <div className="space-y-2">
                              <div>
                                <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                                  Classification
                                </span>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  <Badge variant="outline">
                                    {String(a.attendee_type)}
                                  </Badge>
                                  {a.attendee_type_detail &&
                                    a.attendee_type_detail !==
                                      a.attendee_type && (
                                      <Badge variant="secondary">
                                        {String(
                                          a.attendee_type_detail,
                                        )}
                                      </Badge>
                                    )}
                                  {a.investor_level && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      Investor:{" "}
                                      {String(a.investor_level)}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {a.panel_votes && (
                                <div>
                                  <span className="font-medium text-xs text-muted-foreground uppercase tracking-wide">
                                    Panel Votes
                                  </span>
                                  <p className="mt-1">
                                    {String(a.panel_votes)}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer count */}
      <div className="text-xs text-muted-foreground text-right">
        {filteredApplicants.length} of {applicants.length} applicants
        {selectedIds.size > 0 && ` | ${selectedIds.size} selected`}
      </div>
    </div>
  );
}
