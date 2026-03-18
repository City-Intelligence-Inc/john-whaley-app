"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Upload,
  Download,
  Brain,
  Search,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  ClipboardCopy,
  Check,
  Sparkles,
  Linkedin,
  ExternalLink,
  ArrowUpDown,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { useEvent } from "@/components/event-provider";
import { CSVUploader } from "@/components/csv-uploader";
import { api } from "@/lib/api";
import type { Applicant } from "@/lib/api";
import { ATTENDEE_TYPES } from "@/lib/constants";

function getName(a: Applicant): string {
  return a.name || (a.linkedin_name as string) || a.email || "No name";
}

function getHeadline(a: Applicant): string {
  return (a.linkedin_headline as string) || a.title || "";
}

function getPhoto(a: Applicant): string {
  return (a.linkedin_image as string) || (a.photo_url as string) || "";
}

function getSummary(a: Applicant): string {
  return (a.ai_summary as string) || (a.linkedin_summary as string) || "";
}

function getTypeColor(key: string): string {
  return ATTENDEE_TYPES.find((t) => t.key === key)?.color || "#6b7280";
}

function getTypeLabel(key: string): string {
  return ATTENDEE_TYPES.find((t) => t.key === key)?.label || key;
}

export default function EventWorkspacePage() {
  const router = useRouter();
  const {
    sessionId, session, applicants, loading, error,
    refreshApplicants, refreshStats, refreshAll,
  } = useEvent();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showImport, setShowImport] = useState(false);
  const [sortField, setSortField] = useState<"name" | "status" | "type" | "score">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [copiedEmails, setCopiedEmails] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  /* ── Counts ── */
  const accepted = applicants.filter((a) => a.status === "accepted").length;
  const pending = applicants.filter((a) => a.status === "pending").length;
  const rejected = applicants.filter((a) => a.status === "rejected").length;
  const waitlisted = applicants.filter((a) => a.status === "waitlisted").length;
  const total = applicants.length;
  const analyzed = applicants.filter((a) => a.ai_reasoning).length;

  /* ── Sort & filter ── */
  const filtered = useMemo(() => {
    let list = applicants;
    if (statusFilter !== "all") list = list.filter((a) => a.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((a) => {
        const s = [a.name, a.email, a.company, a.title, a.linkedin_headline as string]
          .filter(Boolean).join(" ").toLowerCase();
        return s.includes(q);
      });
    }
    return [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = getName(a).localeCompare(getName(b));
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      else if (sortField === "type") cmp = (a.attendee_type || "zzz").localeCompare(b.attendee_type || "zzz");
      else if (sortField === "score") cmp = Number(b.ai_score || 0) - Number(a.ai_score || 0);
      return sortDir === "desc" ? -cmp : cmp;
    });
  }, [applicants, statusFilter, search, sortField, sortDir]);

  /* ── Handlers ── */
  const handleStatusChange = useCallback(async (id: string, status: string) => {
    try {
      await api.updateApplicant(id, { status });
      await Promise.all([refreshApplicants(), refreshStats()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }, [refreshApplicants, refreshStats]);

  const handleDelete = useCallback(async () => {
    if (!confirm("Delete this event and all its applicants? This cannot be undone.")) return;
    try {
      await api.deleteSession(sessionId);
      toast.success("Event deleted");
      router.push("/events");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  }, [sessionId, router]);

  const handleClearAll = useCallback(async () => {
    if (!confirm(`Reset all ${total} guests to pending?`)) return;
    setClearing(true);
    try {
      const ids = applicants.map((a) => a.applicant_id);
      await api.batchUpdateStatus(ids, "pending");
      toast.success("All statuses cleared to pending");
      await refreshAll();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear");
    } finally {
      setClearing(false);
    }
  }, [applicants, total, refreshAll]);

  const handleExportAll = useCallback(() => {
    if (!applicants.length) return;
    const skip = new Set(["applicant_id", "session_id"]);
    const keys = new Set<string>();
    for (const a of applicants) for (const k of Object.keys(a)) if (!skip.has(k)) keys.add(k);
    const pri = ["name", "email", "status", "attendee_type", "attendee_type_detail", "ai_score", "ai_reasoning", "company", "title", "location", "linkedin_url"];
    const headers = [...pri.filter((k) => keys.has(k)), ...[...keys].filter((k) => !pri.includes(k)).sort()];
    const esc = (v: unknown) => { const s = String(v ?? ""); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [headers.join(","), ...applicants.map((a) => headers.map((h) => esc(a[h])).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(session?.name || "event").replace(/\s+/g, "-").toLowerCase()}-all-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [applicants, session]);

  const handleExportAccepted = useCallback(() => {
    const acc = applicants.filter((a) => a.status === "accepted");
    if (!acc.length) { toast.error("No accepted guests"); return; }
    const headers = ["name", "email", "company", "title", "attendee_type", "attendee_type_detail", "linkedin_url"];
    const esc = (v: unknown) => { const s = String(v ?? ""); return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s; };
    const rows = [headers.join(","), ...acc.map((a) => headers.map((h) => esc(a[h])).join(","))];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(session?.name || "event").replace(/\s+/g, "-").toLowerCase()}-accepted-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${acc.length} accepted guests`);
  }, [applicants, session]);

  const handleCopyEmails = useCallback(() => {
    const emails = applicants.filter((a) => a.status === "accepted").map((a) => a.email).filter(Boolean);
    if (!emails.length) { toast.error("No accepted emails"); return; }
    navigator.clipboard.writeText(emails.join("\n"));
    setCopiedEmails(true);
    toast.success(`Copied ${emails.length} emails — paste into Luma`);
    setTimeout(() => setCopiedEmails(false), 2000);
  }, [applicants]);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const selectedApplicant = selectedId ? applicants.find((a) => a.applicant_id === selectedId) : null;

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center py-20"><p className="text-sm text-destructive mb-4">{error}</p><Button variant="outline" onClick={() => refreshAll()}>Retry</Button></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{session?.name || "Event"}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{total} guests</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push(`/events/${sessionId}/analyze`)}>
            <Brain className="size-4 mr-2" />
            {analyzed > 0 ? "Re-Analyze" : "Run Analysis"}
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={handleDelete}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* Status bar */}
      {total > 0 && (
        <div className="space-y-3">
          {/* Proportional status bar */}
          <div className="h-3 rounded-full overflow-hidden flex bg-muted">
            {accepted > 0 && (
              <button onClick={() => setStatusFilter(statusFilter === "accepted" ? "all" : "accepted")}
                className="bg-emerald-500 transition-all hover:brightness-110" style={{ width: `${(accepted / total) * 100}%` }} title={`${accepted} accepted`} />
            )}
            {waitlisted > 0 && (
              <button onClick={() => setStatusFilter(statusFilter === "waitlisted" ? "all" : "waitlisted")}
                className="bg-amber-500 transition-all hover:brightness-110" style={{ width: `${(waitlisted / total) * 100}%` }} title={`${waitlisted} waitlisted`} />
            )}
            {pending > 0 && (
              <button onClick={() => setStatusFilter(statusFilter === "pending" ? "all" : "pending")}
                className="bg-blue-400 transition-all hover:brightness-110" style={{ width: `${(pending / total) * 100}%` }} title={`${pending} pending`} />
            )}
            {rejected > 0 && (
              <button onClick={() => setStatusFilter(statusFilter === "rejected" ? "all" : "rejected")}
                className="bg-red-500 transition-all hover:brightness-110" style={{ width: `${(rejected / total) * 100}%` }} title={`${rejected} rejected`} />
            )}
          </div>

          {/* Legend + clear */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              {[
                { label: "Accepted", value: accepted, color: "bg-emerald-500", filter: "accepted" },
                { label: "Waitlisted", value: waitlisted, color: "bg-amber-500", filter: "waitlisted" },
                { label: "Pending", value: pending, color: "bg-blue-400", filter: "pending" },
                { label: "Rejected", value: rejected, color: "bg-red-500", filter: "rejected" },
              ].filter((s) => s.value > 0).map((s) => (
                <button
                  key={s.label}
                  onClick={() => setStatusFilter(statusFilter === s.filter ? "all" : s.filter)}
                  className={`flex items-center gap-1.5 transition-colors ${
                    statusFilter === s.filter ? "font-semibold" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className={`size-2.5 rounded-full ${s.color}`} />
                  <span className="tabular-nums">{s.value}</span> {s.label}
                </button>
              ))}
            </div>
            {(accepted + rejected + waitlisted > 0) && (
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground h-7"
                onClick={handleClearAll} disabled={clearing}>
                {clearing ? <Loader2 className="size-3 mr-1.5 animate-spin" /> : <X className="size-3 mr-1.5" />}
                Clear All Statuses
              </Button>
            )}
          </div>
        </div>
      )}

      <Tabs defaultValue="guests">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="guests">Guests</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => setShowImport(true)}>
              <Upload className="size-4 mr-2" />Import
            </Button>
          </div>
        </div>

        {/* ── Guests Tab ── */}
        <TabsContent value="guests" className="mt-4 space-y-4">
          {/* Search */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guests..." className="pl-9 h-9" />
              {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2"><X className="size-4 text-muted-foreground" /></button>}
            </div>
            <p className="text-xs text-muted-foreground">{filtered.length} results</p>
          </div>

          {/* Table */}
          {total === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Users className="size-12 text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium mb-1">No guests yet</p>
                <p className="text-sm text-muted-foreground mb-4">Import a CSV or add guests from Luma</p>
                <Button onClick={() => setShowImport(true)}>
                  <Upload className="size-4 mr-2" />Import Guests
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[280px]">
                      <button onClick={() => toggleSort("name")} className="flex items-center gap-1 hover:text-foreground">
                        Guest <ArrowUpDown className="size-3" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button onClick={() => toggleSort("type")} className="flex items-center gap-1 hover:text-foreground">
                        Category <ArrowUpDown className="size-3" />
                      </button>
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">AI Summary</TableHead>
                    <TableHead>
                      <button onClick={() => toggleSort("status")} className="flex items-center gap-1 hover:text-foreground">
                        Status <ArrowUpDown className="size-3" />
                      </button>
                    </TableHead>
                    <TableHead className="w-[140px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((a) => {
                    const photo = getPhoto(a);
                    const headline = getHeadline(a);
                    const summary = getSummary(a);
                    return (
                      <TableRow
                        key={a.applicant_id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedId(a.applicant_id)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {photo ? (
                              <img src={photo} alt="" className="size-9 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="size-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-medium text-muted-foreground">
                                {getName(a).charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{getName(a)}</p>
                              {headline && <p className="text-xs text-muted-foreground truncate max-w-[220px]">{headline}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {a.attendee_type && (
                            <Badge
                              variant="outline"
                              className="text-[11px] font-medium"
                              style={{
                                borderColor: getTypeColor(a.attendee_type) + "40",
                                color: getTypeColor(a.attendee_type),
                                backgroundColor: getTypeColor(a.attendee_type) + "10",
                              }}
                            >
                              {a.attendee_type_detail || getTypeLabel(a.attendee_type)}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {summary ? (
                            <p className="text-xs text-muted-foreground line-clamp-2 max-w-xs">{summary}</p>
                          ) : a.ai_reasoning ? (
                            <p className="text-xs text-muted-foreground line-clamp-2 max-w-xs">
                              {a.ai_reasoning.includes(" | ")
                                ? a.ai_reasoning.split(" | ")[0]?.replace(/^.*?\]:\s*/, "")
                                : a.ai_reasoning}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              a.status === "accepted" ? "default" :
                              a.status === "rejected" ? "destructive" :
                              "secondary"
                            }
                            className="text-[11px]"
                          >
                            {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleStatusChange(a.applicant_id, a.status === "accepted" ? "pending" : "accepted")}
                              className={`size-7 rounded-md flex items-center justify-center transition-colors ${
                                a.status === "accepted"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50"
                              }`}
                              title={a.status === "accepted" ? "Undo accept" : "Accept"}
                            >
                              <CheckCircle2 className="size-4" />
                            </button>
                            <button
                              onClick={() => handleStatusChange(a.applicant_id, a.status === "waitlisted" ? "pending" : "waitlisted")}
                              className={`size-7 rounded-md flex items-center justify-center transition-colors ${
                                a.status === "waitlisted"
                                  ? "bg-amber-100 text-amber-700"
                                  : "text-muted-foreground hover:text-amber-600 hover:bg-amber-50"
                              }`}
                              title={a.status === "waitlisted" ? "Undo waitlist" : "Waitlist"}
                            >
                              <Clock className="size-4" />
                            </button>
                            <button
                              onClick={() => handleStatusChange(a.applicant_id, a.status === "rejected" ? "pending" : "rejected")}
                              className={`size-7 rounded-md flex items-center justify-center transition-colors ${
                                a.status === "rejected"
                                  ? "bg-red-100 text-red-700"
                                  : "text-muted-foreground hover:text-red-600 hover:bg-red-50"
                              }`}
                              title={a.status === "rejected" ? "Undo reject" : "Reject"}
                            >
                              <XCircle className="size-4" />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ── Export Tab ── */}
        <TabsContent value="export" className="mt-4 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workflow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${analyzed > 0 ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                  {analyzed > 0 ? <Check className="size-4" /> : "1"}
                </div>
                <div>
                  <p className={`text-sm font-medium ${analyzed > 0 ? "line-through text-muted-foreground" : ""}`}>Run AI Analysis</p>
                  <p className="text-xs text-muted-foreground">Classify and score all guests</p>
                </div>
                {analyzed === 0 && (
                  <Button size="sm" variant="outline" className="ml-auto" onClick={() => router.push(`/events/${sessionId}/analyze`)}>
                    <Brain className="size-4 mr-2" />Analyze
                  </Button>
                )}
              </div>
              <Separator />
              <div className="flex items-center gap-4">
                <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${accepted > 0 ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                  {accepted > 0 ? <Check className="size-4" /> : "2"}
                </div>
                <div>
                  <p className={`text-sm font-medium ${accepted > 0 ? "line-through text-muted-foreground" : ""}`}>Accept top guests</p>
                  <p className="text-xs text-muted-foreground">
                    {accepted > 0 ? `${accepted} accepted out of ${total}` : "Review and accept/reject guests"}
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-4">
                <div className="size-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-muted text-muted-foreground">3</div>
                <div>
                  <p className="text-sm font-medium">Export & paste into Luma</p>
                  <p className="text-xs text-muted-foreground">Download CSV or copy emails to clipboard</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                    <ClipboardCopy className="size-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Copy Accepted Emails</p>
                    <p className="text-xs text-muted-foreground">Paste directly into Luma&apos;s guest list</p>
                  </div>
                </div>
                <Button
                  onClick={handleCopyEmails}
                  disabled={accepted === 0}
                  className="w-full"
                  variant={copiedEmails ? "outline" : "default"}
                >
                  {copiedEmails ? <Check className="size-4 mr-2" /> : <ClipboardCopy className="size-4 mr-2" />}
                  {copiedEmails ? "Copied!" : `Copy ${accepted} Emails`}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Download className="size-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">Download CSV</p>
                    <p className="text-xs text-muted-foreground">Full export with all fields</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleExportAccepted} disabled={accepted === 0} variant="outline" className="flex-1" size="sm">
                    Accepted Only ({accepted})
                  </Button>
                  <Button onClick={handleExportAll} disabled={total === 0} variant="outline" className="flex-1" size="sm">
                    All Guests ({total})
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Detail sheet */}
      {selectedApplicant && (
        <DetailSheet
          applicant={selectedApplicant}
          onStatusChange={handleStatusChange}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* Import dialog */}
      <Dialog open={showImport} onOpenChange={setShowImport}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import Guests</DialogTitle>
            <DialogDescription>Upload a CSV export from Luma or any spreadsheet.</DialogDescription>
          </DialogHeader>
          <CSVUploader
            onUploadSuccess={async (count) => {
              toast.success(`Imported ${count} guests`);
              await refreshAll();
              setShowImport(false);
            }}
            sessionId={sessionId}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Detail Sheet ── */

function DetailSheet({
  applicant,
  onStatusChange,
  onClose,
}: {
  applicant: Applicant;
  onStatusChange: (id: string, status: string) => void;
  onClose: () => void;
}) {
  const photo = getPhoto(applicant);
  const headline = getHeadline(applicant);
  const summary = getSummary(applicant);
  const about = (applicant.about as string) || (applicant.linkedin_about as string) || "";
  const experience = (applicant.experience as string) || (applicant.linkedin_experience as string) || "";
  const education = (applicant.education as string) || (applicant.linkedin_education as string) || "";

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1" />
      <div
        className="w-full max-w-md bg-background border-l shadow-xl overflow-y-auto animate-in slide-in-from-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            {photo ? (
              <img src={photo} alt="" className="size-16 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="size-16 rounded-xl bg-muted flex items-center justify-center shrink-0 text-2xl font-bold text-muted-foreground">
                {getName(applicant).charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold">{getName(applicant)}</h2>
              {headline && <p className="text-sm text-muted-foreground">{headline}</p>}
              <div className="flex items-center gap-2 mt-2">
                {applicant.attendee_type && (
                  <Badge variant="outline" className="text-xs">
                    {applicant.attendee_type_detail || applicant.attendee_type}
                  </Badge>
                )}
                <Badge
                  variant={applicant.status === "accepted" ? "default" : applicant.status === "rejected" ? "destructive" : "secondary"}
                  className="text-xs"
                >
                  {applicant.status.charAt(0).toUpperCase() + applicant.status.slice(1)}
                </Badge>
              </div>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="size-5" />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button size="sm" variant={applicant.status === "accepted" ? "default" : "outline"} className="flex-1"
              onClick={() => onStatusChange(applicant.applicant_id, "accepted")}>
              <CheckCircle2 className="size-4 mr-1" />Accept
            </Button>
            <Button size="sm" variant={applicant.status === "waitlisted" ? "default" : "outline"} className="flex-1"
              onClick={() => onStatusChange(applicant.applicant_id, "waitlisted")}>
              <Clock className="size-4 mr-1" />Waitlist
            </Button>
            <Button size="sm" variant={applicant.status === "rejected" ? "destructive" : "outline"} className="flex-1"
              onClick={() => onStatusChange(applicant.applicant_id, "rejected")}>
              <XCircle className="size-4 mr-1" />Reject
            </Button>
          </div>

          <Separator />

          {/* Contact */}
          <div className="space-y-2 text-sm">
            {applicant.email && (
              <a href={`mailto:${applicant.email}`} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <span className="truncate">{applicant.email}</span>
              </a>
            )}
            {applicant.linkedin_url && (
              <a href={applicant.linkedin_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:underline">
                <Linkedin className="size-4" />LinkedIn<ExternalLink className="size-3" />
              </a>
            )}
            {applicant.company && <p className="text-muted-foreground">{applicant.title ? `${applicant.title} @ ${applicant.company}` : applicant.company}</p>}
            {applicant.location && <p className="text-muted-foreground">{applicant.location}</p>}
          </div>

          {/* AI Summary */}
          {(summary || applicant.ai_reasoning) && (
            <>
              <Separator />
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sparkles className="size-3" />AI Summary
                </h3>
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-sm leading-relaxed">
                    {summary || applicant.ai_reasoning}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* About / Experience / Education */}
          {about && (
            <>
              <Separator />
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">About</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{about}</p>
              </div>
            </>
          )}
          {experience && (
            <>
              <Separator />
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Experience</h3>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{experience}</p>
              </div>
            </>
          )}
          {education && (
            <>
              <Separator />
              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Education</h3>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{education}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
