"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Save,
  Loader2,
  Users,
  Settings2,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useEvent } from "@/components/event-provider";
import { api } from "@/lib/api";
import {
  ATTENDEE_TYPES,
  DEFAULT_SELECTION_PREFERENCES,
} from "@/lib/constants";
import type { SelectionPreferences } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ListData {
  emails: string[];
  linkedin_urls: string[];
}

interface SyncUpdate {
  guest_id: string;
  name: string;
  status: string;
  success?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function EventSettingsPage() {
  const { sessionId, session } = useEvent();

  /* ---- Whitelist / Blacklist state ---- */
  const [globalWhitelist, setGlobalWhitelist] = useState<string[]>([]);
  const [globalBlacklist, setGlobalBlacklist] = useState<string[]>([]);

  const [wlEmails, setWlEmails] = useState("");
  const [wlUrls, setWlUrls] = useState("");
  const [blEmails, setBlEmails] = useState("");
  const [blUrls, setBlUrls] = useState("");

  const [savingWl, setSavingWl] = useState(false);
  const [savingBl, setSavingBl] = useState(false);
  const [loadingLists, setLoadingLists] = useState(true);

  /* ---- Selection Preferences state ---- */
  const [prefs, setPrefs] = useState<SelectionPreferences>({
    ...DEFAULT_SELECTION_PREFERENCES,
    attendee_mix: Object.fromEntries(
      ATTENDEE_TYPES.map((t) => [t.key, 0])
    ),
    auto_accept_types: [...DEFAULT_SELECTION_PREFERENCES.auto_accept_types],
    custom_categories: [],
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [loadingPrefs, setLoadingPrefs] = useState(true);

  /* ---- Luma Sync state ---- */
  const [dryRun, setDryRun] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncUpdate[] | null>(null);

  /* ---------------------------------------------------------------- */
  /*  Load data                                                        */
  /* ---------------------------------------------------------------- */

  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    try {
      const [gWl, gBl, sWl, sBl] = await Promise.all([
        api.getWhitelist(),
        api.getBlacklist(),
        api.getSessionWhitelist(sessionId),
        api.getSessionBlacklist(sessionId),
      ]);
      setGlobalWhitelist(gWl.emails);
      setGlobalBlacklist(gBl.emails);
      setWlEmails((sWl.emails ?? []).join("\n"));
      setWlUrls((sWl.linkedin_urls ?? []).join("\n"));
      setBlEmails((sBl.emails ?? []).join("\n"));
      setBlUrls((sBl.linkedin_urls ?? []).join("\n"));
    } catch {
      toast.error("Failed to load whitelist/blacklist");
    } finally {
      setLoadingLists(false);
    }
  }, [sessionId]);

  const loadPrefs = useCallback(async () => {
    setLoadingPrefs(true);
    try {
      if (session?.selection_preferences) {
        setPrefs({
          ...DEFAULT_SELECTION_PREFERENCES,
          ...session.selection_preferences,
          attendee_mix: {
            ...Object.fromEntries(ATTENDEE_TYPES.map((t) => [t.key, 0])),
            ...(session.selection_preferences.attendee_mix ?? {}),
          },
          auto_accept_types:
            session.selection_preferences.auto_accept_types ?? [
              ...DEFAULT_SELECTION_PREFERENCES.auto_accept_types,
            ],
          custom_categories:
            session.selection_preferences.custom_categories ?? [],
        });
      }
    } catch {
      toast.error("Failed to load selection preferences");
    } finally {
      setLoadingPrefs(false);
    }
  }, [session]);

  useEffect(() => {
    loadLists();
    loadPrefs();
  }, [loadLists, loadPrefs]);

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                          */
  /* ---------------------------------------------------------------- */

  function linesToArray(text: string): string[] {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  const totalMix = Object.values(prefs.attendee_mix).reduce(
    (a, b) => a + b,
    0
  );

  /* ---------------------------------------------------------------- */
  /*  Save handlers                                                    */
  /* ---------------------------------------------------------------- */

  const saveWhitelist = async () => {
    setSavingWl(true);
    try {
      await api.updateSessionWhitelist(sessionId, {
        emails: linesToArray(wlEmails),
        linkedin_urls: linesToArray(wlUrls),
      });
      toast.success("Event whitelist saved");
    } catch {
      toast.error("Failed to save whitelist");
    } finally {
      setSavingWl(false);
    }
  };

  const saveBlacklist = async () => {
    setSavingBl(true);
    try {
      await api.updateSessionBlacklist(sessionId, {
        emails: linesToArray(blEmails),
        linkedin_urls: linesToArray(blUrls),
      });
      toast.success("Event blacklist saved");
    } catch {
      toast.error("Failed to save blacklist");
    } finally {
      setSavingBl(false);
    }
  };

  const savePreferences = async () => {
    setSavingPrefs(true);
    try {
      await api.updateSelectionPreferences(prefs);
      toast.success("Selection preferences saved");
    } catch {
      toast.error("Failed to save preferences");
    } finally {
      setSavingPrefs(false);
    }
  };

  const runLumaSync = async () => {
    setSyncing(true);
    setSyncResults(null);
    try {
      const res = await api.syncToLuma(sessionId, dryRun);
      setSyncResults(res.updates ?? []);
      toast.success(
        dryRun
          ? `Dry run complete: ${res.count} updates`
          : `Synced ${res.count} updates to Luma`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Luma sync failed"
      );
    } finally {
      setSyncing(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-10">
      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Event Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure whitelist/blacklist rules, selection preferences, and Luma
          sync for{" "}
          <span className="text-foreground font-medium">
            {session?.name ?? "this event"}
          </span>
          .
        </p>
      </div>

      {/* ================================================================ */}
      {/*  SECTION 1 — Whitelist & Blacklist  (TOP, most prominent)        */}
      {/* ================================================================ */}

      <section>
        <div className="flex items-center gap-2 mb-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gold/10">
            <ShieldCheck className="size-4 text-gold" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Whitelist & Blacklist
            </h2>
            <p className="text-xs text-muted-foreground">
              Control which applicants are always accepted or always rejected
              for this event.
            </p>
          </div>
        </div>

        {loadingLists ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-gold" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Whitelist Card ── */}
            <Card className="border-emerald-500/20 bg-emerald-500/[0.03]">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/15">
                    <ShieldCheck className="size-4 text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle className="text-[15px] text-foreground">
                      Whitelist
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Always accept these applicants
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Event whitelist emails */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Emails (one per line)
                  </Label>
                  <Textarea
                    placeholder={"alice@example.com\nbob@company.co"}
                    value={wlEmails}
                    onChange={(e) => setWlEmails(e.target.value)}
                    rows={5}
                    className="bg-background/60 border-border/50 focus-visible:ring-emerald-500/40 font-mono text-xs resize-y"
                  />
                </div>

                {/* Event whitelist LinkedIn URLs */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    LinkedIn URLs (one per line)
                  </Label>
                  <Textarea
                    placeholder={
                      "https://linkedin.com/in/alice\nhttps://linkedin.com/in/bob"
                    }
                    value={wlUrls}
                    onChange={(e) => setWlUrls(e.target.value)}
                    rows={4}
                    className="bg-background/60 border-border/50 focus-visible:ring-emerald-500/40 font-mono text-xs resize-y"
                  />
                </div>

                <Button
                  onClick={saveWhitelist}
                  disabled={savingWl}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {savingWl ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="size-4 mr-2" />
                  )}
                  Save Whitelist
                </Button>

                {/* Global reference (read-only) */}
                {globalWhitelist.length > 0 && (
                  <>
                    <Separator className="my-2" />
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                        Global Whitelist (read-only)
                      </Label>
                      <div className="rounded-md border border-border/30 bg-muted/30 p-3 max-h-32 overflow-y-auto">
                        <pre className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap">
                          {globalWhitelist.join("\n")}
                        </pre>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* ── Blacklist Card ── */}
            <Card className="border-red-500/20 bg-red-500/[0.03]">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-red-500/15">
                    <ShieldAlert className="size-4 text-red-400" />
                  </div>
                  <div>
                    <CardTitle className="text-[15px] text-foreground">
                      Blacklist
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Always reject these applicants
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Event blacklist emails */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Emails (one per line)
                  </Label>
                  <Textarea
                    placeholder={"spam@example.com\nunwanted@domain.net"}
                    value={blEmails}
                    onChange={(e) => setBlEmails(e.target.value)}
                    rows={5}
                    className="bg-background/60 border-border/50 focus-visible:ring-red-500/40 font-mono text-xs resize-y"
                  />
                </div>

                {/* Event blacklist LinkedIn URLs */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    LinkedIn URLs (one per line)
                  </Label>
                  <Textarea
                    placeholder={
                      "https://linkedin.com/in/spammer\nhttps://linkedin.com/in/blocked"
                    }
                    value={blUrls}
                    onChange={(e) => setBlUrls(e.target.value)}
                    rows={4}
                    className="bg-background/60 border-border/50 focus-visible:ring-red-500/40 font-mono text-xs resize-y"
                  />
                </div>

                <Button
                  onClick={saveBlacklist}
                  disabled={savingBl}
                  variant="destructive"
                  className="w-full"
                >
                  {savingBl ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="size-4 mr-2" />
                  )}
                  Save Blacklist
                </Button>

                {/* Global reference (read-only) */}
                {globalBlacklist.length > 0 && (
                  <>
                    <Separator className="my-2" />
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
                        Global Blacklist (read-only)
                      </Label>
                      <div className="rounded-md border border-border/30 bg-muted/30 p-3 max-h-32 overflow-y-auto">
                        <pre className="text-[11px] text-muted-foreground font-mono whitespace-pre-wrap">
                          {globalBlacklist.join("\n")}
                        </pre>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      {/* ================================================================ */}
      {/*  SECTION 2 — Selection Preferences                               */}
      {/* ================================================================ */}

      <section>
        <div className="flex items-center gap-2 mb-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gold/10">
            <Settings2 className="size-4 text-gold" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Selection Preferences
            </h2>
            <p className="text-xs text-muted-foreground">
              Control capacity, attendee mix, auto-accept rules, and custom
              priorities.
            </p>
          </div>
        </div>

        {loadingPrefs ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-gold" />
          </div>
        ) : (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="pt-6 space-y-8">
              {/* Venue Capacity */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  Venue Capacity
                </Label>
                <p className="text-xs text-muted-foreground">
                  Maximum number of attendees. Leave blank for no limit.
                </p>
                <Input
                  type="number"
                  min={0}
                  placeholder="No limit"
                  value={prefs.venue_capacity ?? ""}
                  onChange={(e) =>
                    setPrefs({
                      ...prefs,
                      venue_capacity: e.target.value
                        ? parseInt(e.target.value, 10)
                        : null,
                    })
                  }
                  className="max-w-xs bg-background border-border/50 focus-visible:ring-gold/40"
                />
              </div>

              <Separator />

              {/* Attendee Mix Sliders */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium text-foreground">
                      Attendee Mix
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Target percentage for each attendee type.
                    </p>
                  </div>
                  <div
                    className={`text-sm font-mono font-medium ${
                      totalMix === 100
                        ? "text-emerald-400"
                        : totalMix > 100
                          ? "text-red-400"
                          : "text-amber-400"
                    }`}
                  >
                    {totalMix}%
                    {totalMix === 100 && (
                      <span className="text-emerald-400/60 ml-1 text-xs">
                        (balanced)
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-5">
                  {ATTENDEE_TYPES.map((type) => {
                    const pct = prefs.attendee_mix[type.key] ?? 0;
                    return (
                      <div key={type.key} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-foreground">
                            <span
                              className="inline-block size-2 rounded-full mr-1.5"
                              style={{ backgroundColor: type.color }}
                            />
                            {type.label}
                          </span>
                          <span className="text-xs font-mono text-muted-foreground w-10 text-right">
                            {pct}%
                          </span>
                        </div>
                        <Slider
                          min={0}
                          max={100}
                          step={5}
                          value={[pct]}
                          onValueChange={([v]) =>
                            setPrefs({
                              ...prefs,
                              attendee_mix: {
                                ...prefs.attendee_mix,
                                [type.key]: v,
                              },
                            })
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Auto-accept Types */}
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-foreground">
                    Auto-Accept Types
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Applicants of these types are automatically accepted without
                    AI scoring.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {ATTENDEE_TYPES.map((type) => {
                    const checked = prefs.auto_accept_types.includes(type.key);
                    return (
                      <label
                        key={type.key}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                          checked
                            ? "border-gold/30 bg-gold/5"
                            : "border-border/50 bg-background/30 hover:border-border"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = v
                              ? [...prefs.auto_accept_types, type.key]
                              : prefs.auto_accept_types.filter(
                                  (t) => t !== type.key
                                );
                            setPrefs({
                              ...prefs,
                              auto_accept_types: next,
                            });
                          }}
                          className="data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                        />
                        <span className="text-xs font-medium text-foreground">
                          {type.label}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Relevance Filter */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  Relevance Filter
                </Label>
                <p className="text-xs text-muted-foreground">
                  How strictly to filter applicants based on event relevance.
                </p>
                <Select
                  value={prefs.relevance_filter}
                  onValueChange={(v) =>
                    setPrefs({ ...prefs, relevance_filter: v })
                  }
                >
                  <SelectTrigger className="max-w-xs bg-background border-border/50 focus:ring-gold/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="strict">Strict</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="loose">Loose</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Custom Priorities */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  Custom Priorities
                </Label>
                <p className="text-xs text-muted-foreground">
                  Free-form instructions for the AI to prioritize during
                  selection.
                </p>
                <Textarea
                  placeholder="e.g. Prioritize applicants with experience in generative AI, robotics, or biotech..."
                  value={prefs.custom_priorities}
                  onChange={(e) =>
                    setPrefs({ ...prefs, custom_priorities: e.target.value })
                  }
                  rows={4}
                  className="bg-background border-border/50 focus-visible:ring-gold/40 text-sm resize-y"
                />
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <Button
                  onClick={savePreferences}
                  disabled={savingPrefs}
                  className="bg-gold hover:bg-gold/90 text-gold-foreground"
                >
                  {savingPrefs ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="size-4 mr-2" />
                  )}
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ================================================================ */}
      {/*  SECTION 3 — Luma Sync                                           */}
      {/* ================================================================ */}

      <section>
        <div className="flex items-center gap-2 mb-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gold/10">
            <RefreshCw className="size-4 text-gold" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Luma Sync
            </h2>
            <p className="text-xs text-muted-foreground">
              Push accept/reject decisions back to Luma.
            </p>
          </div>
        </div>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="pt-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3">
                <Switch
                  checked={dryRun}
                  onCheckedChange={setDryRun}
                  className="data-[state=checked]:bg-gold"
                />
                <div>
                  <Label className="text-sm font-medium text-foreground">
                    Dry Run
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {dryRun
                      ? "Preview changes without updating Luma"
                      : "Changes will be applied to Luma"}
                  </p>
                </div>
              </div>

              <Button
                onClick={runLumaSync}
                disabled={syncing}
                className={`sm:ml-auto ${
                  dryRun
                    ? "bg-gold hover:bg-gold/90 text-gold-foreground"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white"
                }`}
              >
                {syncing ? (
                  <Loader2 className="size-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="size-4 mr-2" />
                )}
                {dryRun ? "Preview Sync" : "Sync to Luma"}
              </Button>
            </div>

            {/* Sync Results Preview */}
            {syncResults !== null && (
              <>
                <Separator />
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {dryRun ? "Preview" : "Results"} ({syncResults.length}{" "}
                    updates)
                  </Label>
                  {syncResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No updates to sync. All statuses are already in sync with
                      Luma.
                    </p>
                  ) : (
                    <div className="rounded-lg border border-border/30 overflow-hidden max-h-64 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-muted/30 border-b border-border/30">
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                              Name
                            </th>
                            <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                              Status
                            </th>
                            {!dryRun && (
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                                Result
                              </th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {syncResults.map((u, i) => (
                            <tr
                              key={u.guest_id || i}
                              className="border-b border-border/10 last:border-0"
                            >
                              <td className="px-3 py-1.5 text-foreground">
                                {u.name}
                              </td>
                              <td className="px-3 py-1.5">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                    u.status === "accepted"
                                      ? "bg-emerald-500/15 text-emerald-400"
                                      : u.status === "rejected"
                                        ? "bg-red-500/15 text-red-400"
                                        : "bg-amber-500/15 text-amber-400"
                                  }`}
                                >
                                  {u.status}
                                </span>
                              </td>
                              {!dryRun && (
                                <td className="px-3 py-1.5 text-muted-foreground">
                                  {u.success === false ? (
                                    <span className="text-red-400">
                                      Failed
                                    </span>
                                  ) : (
                                    <span className="text-emerald-400">
                                      OK
                                    </span>
                                  )}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
