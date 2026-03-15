"use client";

import { useState, useCallback, useMemo } from "react";
import { Upload, Linkedin, Loader2, Brain, Download, Sheet } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useEvent } from "@/components/event-provider";
import { StatsCards } from "@/components/stats-cards";
import { ApplicantTable } from "@/components/applicant-table";
import { ApplicantDetailSheet } from "@/components/applicant-detail-sheet";
import { CSVUploader } from "@/components/csv-uploader";
import { api } from "@/lib/api";
import type { Applicant } from "@/lib/api";

export default function EventWorkspacePage() {
  const router = useRouter();
  const {
    sessionId,
    session,
    applicants,
    stats,
    loading,
    error,
    refreshApplicants,
    refreshStats,
    refreshAll,
  } = useEvent();

  // UI state
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(
    null
  );
  const [showImportDialog, setShowImportDialog] = useState(false);

  // Google Sheets state
  const [sheetUrl, setSheetUrl] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("google_sheet_url") || ""
      : ""
  );
  const [sheetConnected, setSheetConnected] = useState(() =>
    typeof window !== "undefined"
      ? !!localStorage.getItem("google_sheet_url")
      : false
  );
  const [sheetSyncing, setSheetSyncing] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{
    new_count: number;
    updated_count: number;
    total_in_sheet: number;
    time: string;
  } | null>(null);

  // LinkedIn enrichment state
  const [liAtCookie, setLiAtCookie] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("li_at_cookie") || ""
      : ""
  );
  const [enriching, setEnriching] = useState(false);
  const [showLiAtPopover, setShowLiAtPopover] = useState(false);

  // Selected applicant for detail sheet
  const selectedApplicant = useMemo(
    () =>
      selectedApplicantId
        ? applicants.find((a) => a.applicant_id === selectedApplicantId) || null
        : null,
    [selectedApplicantId, applicants]
  );

  // ── Status Change Handler ──
  const handleStatusChange = useCallback(
    async (id: string, status: string) => {
      try {
        await api.updateApplicant(id, { status });
        await Promise.all([refreshApplicants(), refreshStats()]);
        toast.success(`Status updated to ${status}`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to update status"
        );
      }
    },
    [refreshApplicants, refreshStats]
  );

  // ── Import Handlers ──
  const handleUploadSuccess = useCallback(
    (_count: number, _sessionId: string) => {
      refreshAll();
      setShowImportDialog(false);
      toast.success(`Imported ${_count} applicants`);
    },
    [refreshAll]
  );

  const syncGoogleSheet = useCallback(
    async (url?: string) => {
      const targetUrl = url || sheetUrl;
      if (!targetUrl.trim()) return;
      setSheetSyncing(true);
      try {
        const result = await api.importGoogleSheet({
          sheet_url: targetUrl,
          session_id: sessionId,
        });
        const now = new Date().toLocaleTimeString("en-US", { hour12: false });
        setLastSyncResult({
          new_count: result.new_count,
          updated_count: result.updated_count,
          total_in_sheet: result.total_in_sheet,
          time: now,
        });
        setSheetConnected(true);
        localStorage.setItem("google_sheet_url", targetUrl);
        await refreshAll();
        if (result.new_count > 0) {
          toast.success(
            `Synced: ${result.new_count} new, ${result.updated_count} updated`
          );
        } else if (result.updated_count > 0) {
          toast.info(
            `Synced: ${result.updated_count} updated (no new applicants)`
          );
        } else {
          toast.info("Sheet synced -- no changes detected");
        }
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Failed to sync Google Sheet"
        );
        setSheetConnected(false);
      } finally {
        setSheetSyncing(false);
      }
    },
    [sheetUrl, sessionId, refreshAll]
  );

  // ── LinkedIn Enrichment ──
  const handleEnrichLinkedIn = useCallback(async () => {
    if (liAtCookie.trim()) {
      localStorage.setItem("li_at_cookie", liAtCookie);
    }
    setEnriching(true);
    setShowLiAtPopover(false);

    const toastId = toast.loading("Starting LinkedIn enrichment...");

    try {
      await api.enrichLinkedInStream(
        {
          session_id: sessionId,
          li_at: liAtCookie.trim() || undefined,
        },
        {
          onStart: (data) => {
            toast.loading(`Scraping ${data.total} LinkedIn profiles...`, {
              id: toastId,
            });
          },
          onProgress: (data) => {
            toast.loading(
              `[${data.completed}/${data.total}] ${data.name || "..."}`,
              { id: toastId }
            );
          },
          onError: (data) => {
            toast.loading(
              `[${data.completed}/${data.total}] Error: ${data.name || "unknown"}`,
              { id: toastId }
            );
          },
          onComplete: (data) => {
            toast.success(
              `LinkedIn enrichment done: ${data.enriched} enriched, ${data.errors} errors`,
              { id: toastId }
            );
            refreshApplicants();
          },
        }
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "LinkedIn enrichment failed",
        { id: toastId }
      );
    } finally {
      setEnriching(false);
    }
  }, [sessionId, liAtCookie, refreshApplicants]);

  // ── Export CSV ──
  const handleExportCSV = useCallback(() => {
    if (applicants.length === 0) return;
    const skipKeys = new Set(["applicant_id", "session_id"]);
    const allKeys = new Set<string>();
    for (const a of applicants) {
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
    const sessionName = session?.name?.replace(/\s+/g, "-").toLowerCase() || "event";
    link.download = `${sessionName}-results-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported!");
  }, [applicants, session]);

  // ── Loading State ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-gold" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-destructive mb-4">{error}</p>
        <Button variant="outline" onClick={() => refreshAll()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {session?.name || "Event"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {applicants.length}{" "}
            {applicants.length === 1 ? "applicant" : "applicants"}
            {session?.source && (
              <Badge
                variant="secondary"
                className="ml-2 text-[10px] uppercase tracking-wider"
              >
                {session.source}
              </Badge>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Import */}
          <Button
            onClick={() => setShowImportDialog(true)}
            className="bg-gold text-gold-foreground hover:bg-gold/90 font-medium"
          >
            <Upload className="size-4 mr-2" />
            Import
          </Button>

          {/* LinkedIn Enrich */}
          <Popover open={showLiAtPopover} onOpenChange={setShowLiAtPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={enriching || applicants.length === 0}
                className="border-border/50 hover:border-gold/30 hover:bg-gold/5"
              >
                {enriching ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <Linkedin className="size-4 mr-2" />
                )}
                Enrich LinkedIn
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-medium">
                    li_at Cookie (optional)
                  </Label>
                  <p className="text-[10px] text-muted-foreground mt-0.5 mb-1.5">
                    Paste your LinkedIn li_at cookie for better scraping results.
                    Not required but recommended.
                  </p>
                  <Input
                    type="password"
                    value={liAtCookie}
                    onChange={(e) => setLiAtCookie(e.target.value)}
                    placeholder="AQEDAQNh..."
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <Button
                  onClick={handleEnrichLinkedIn}
                  disabled={enriching}
                  className="w-full bg-gold text-gold-foreground hover:bg-gold/90"
                  size="sm"
                >
                  {enriching ? (
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Linkedin className="size-3.5 mr-1.5" />
                  )}
                  {enriching ? "Enriching..." : "Start Enrichment"}
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Run Analysis */}
          <Button
            variant="outline"
            disabled={applicants.length === 0}
            onClick={() => router.push(`/events/${sessionId}/analyze`)}
            className="border-border/50 hover:border-gold/30 hover:bg-gold/5"
          >
            <Brain className="size-4 mr-2" />
            Run Analysis
          </Button>

          {/* Export CSV */}
          <Button
            variant="outline"
            disabled={applicants.length === 0}
            onClick={handleExportCSV}
            className="border-border/50"
          >
            <Download className="size-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* ── Empty State ── */}
      {applicants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Get Started</h2>
            <p className="text-muted-foreground">
              Import your applicants to begin reviewing
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
            <button
              onClick={() => setShowImportDialog(true)}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-gold/50 hover:bg-gold/5 p-8 transition-colors"
            >
              <Upload className="size-10 text-muted-foreground" />
              <div className="text-center">
                <div className="font-semibold">Upload CSV File</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Drop a CSV or click to browse
                </div>
              </div>
            </button>
            <button
              onClick={() => setShowImportDialog(true)}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/25 hover:border-gold/50 hover:bg-gold/5 p-8 transition-colors"
            >
              <Sheet className="size-10 text-muted-foreground" />
              <div className="text-center">
                <div className="font-semibold">Google Sheet</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Paste your Sheet URL to connect
                </div>
              </div>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ── Stats Cards ── */}
          <StatsCards
            stats={stats}
            applicants={applicants}
            activeFilter={statusFilter}
            onFilterChange={setStatusFilter}
          />

          {/* ── Applicant Table ── */}
          <ApplicantTable
            applicants={applicants}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            onStatusChange={handleStatusChange}
            onSelectApplicant={setSelectedApplicantId}
          />
        </>
      )}

      {/* ── Applicant Detail Sheet ── */}
      {selectedApplicant && (
        <ApplicantDetailSheet
          applicant={selectedApplicant}
          onStatusChange={(id, status) =>
            handleStatusChange(id, status!)
          }
          onClose={() => setSelectedApplicantId(null)}
        />
      )}

      {/* ── Import Dialog ── */}
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
              <CSVUploader
                onUploadSuccess={handleUploadSuccess}
                sessionId={sessionId}
              />
            </div>

            <Separator />

            {/* Google Sheets */}
            <div>
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Sheet className="size-4" />
                Google Sheet
                {sheetConnected && (
                  <Badge
                    variant="secondary"
                    className="text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  >
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
                      {sheetSyncing && (
                        <Loader2 className="size-4 animate-spin mr-1" />
                      )}
                      {sheetSyncing ? "Connecting..." : "Connect"}
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        onClick={() => syncGoogleSheet()}
                        disabled={sheetSyncing}
                        className="h-10 px-3"
                      >
                        {sheetSyncing ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          "Sync"
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setSheetConnected(false);
                          setAutoSync(false);
                          setLastSyncResult(null);
                          localStorage.removeItem("google_sheet_url");
                          toast.info("Google Sheet disconnected");
                        }}
                        className="h-10 px-3 text-muted-foreground"
                      >
                        Disconnect
                      </Button>
                    </div>
                  )}
                </div>

                {sheetConnected && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between rounded-lg border p-2.5">
                      <div>
                        <Label className="text-sm font-medium">
                          Auto-sync (30s)
                        </Label>
                      </div>
                      <Switch
                        checked={autoSync}
                        onCheckedChange={(checked) => {
                          setAutoSync(checked);
                          if (checked)
                            toast.info("Auto-sync enabled (every 30s)");
                        }}
                      />
                    </div>

                    {lastSyncResult && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                        <span>
                          Last sync at {lastSyncResult.time}:{" "}
                          {lastSyncResult.total_in_sheet} rows
                          {lastSyncResult.new_count > 0 && (
                            <span className="text-green-600 font-medium">
                              {" "}
                              (+{lastSyncResult.new_count} new)
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Sheet must be set to &quot;Anyone with the link can
                  view&quot;. Deduplicates by email.
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
