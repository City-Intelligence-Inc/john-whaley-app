"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  Plus,
  Loader2,
  Calendar,
  Users,
  Trash2,
  Download,
  Check,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { Session } from "@/lib/api";

interface LumaEvent {
  api_id: string;
  name: string;
  start_at: string;
  cover_url?: string;
  url?: string;
  guest_status?: string;
}

export default function EventsPage() {
  const router = useRouter();
  const { user, isLoaded: userLoaded } = useUser();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  // Luma events matched to user's email
  const [myLumaEvents, setMyLumaEvents] = useState<LumaEvent[]>([]);
  const [lumaLoading, setLumaLoading] = useState(false);
  const [lumaChecked, setLumaChecked] = useState(false);

  // Manual event lookup
  const [lookupUrl, setLookupUrl] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookedUpEvent, setLookedUpEvent] = useState<LumaEvent | null>(null);
  const [lookupError, setLookupError] = useState("");

  const [importing, setImporting] = useState<string | null>(null);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ── Data loading ── */

  const fetchSessions = useCallback(async () => {
    try {
      const data = await api.listSessions();
      setSessions(data);
    } catch {
      toast.error("Failed to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMyLumaEvents = useCallback(async () => {
    const email = user?.emailAddresses?.[0]?.emailAddress;
    if (!email) {
      setLumaChecked(true);
      return;
    }
    setLumaLoading(true);
    try {
      const res = await api.myLumaEvents(email);
      setMyLumaEvents(res.events || []);
    } catch {
      // Silently fail -- Luma key may not be configured
    } finally {
      setLumaLoading(false);
      setLumaChecked(true);
    }
  }, [user]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    if (userLoaded) fetchMyLumaEvents();
  }, [userLoaded, fetchMyLumaEvents]);

  /* ── Derived state ── */

  const importedLumaIds = new Set(
    sessions
      .filter((s) => s.source === "luma" && s.source_detail)
      .map((s) => s.source_detail!)
  );

  // Deduplicate: don't show in "Your Luma Events" if already imported
  const unimportedLumaEvents = myLumaEvents.filter(
    (e) => !importedLumaIds.has(e.api_id)
  );

  /* ── Actions ── */

  const lookupEvent = async () => {
    const url = lookupUrl.trim();
    if (!url) return;
    setLookupLoading(true);
    setLookedUpEvent(null);
    setLookupError("");
    try {
      const event = await api.lookupLumaEvent(url);
      if (importedLumaIds.has(event.api_id)) {
        const match = sessions.find((s) => s.source_detail === event.api_id);
        if (match) {
          router.push(`/events/${match.session_id}`);
          return;
        }
      }
      setLookedUpEvent(event);
    } catch (err) {
      setLookupError(
        err instanceof Error
          ? err.message
          : "Event not found. Make sure Stardrop has been added as a host."
      );
    } finally {
      setLookupLoading(false);
    }
  };

  const importLumaEvent = async (event: LumaEvent) => {
    setImporting(event.api_id);
    try {
      const res = await api.importFromLuma(event.api_id);
      toast.success(`Imported ${res.count} guests from "${event.name}"`);
      setLookedUpEvent(null);
      setLookupUrl("");
      await fetchSessions();
      router.push(`/events/${res.session_id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to import event"
      );
    } finally {
      setImporting(null);
    }
  };

  const createEvent = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const session = await api.createSession({
        name: newName.trim(),
        source: "manual",
      });
      setCreateOpen(false);
      setNewName("");
      router.push(`/events/${session.session_id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create event"
      );
    } finally {
      setCreating(false);
    }
  };

  const deleteEvent = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteSession(deleteTarget.session_id);
      toast.success(`Deleted "${deleteTarget.name}"`);
      setDeleteTarget(null);
      fetchSessions();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete event"
      );
    } finally {
      setDeleting(false);
    }
  };

  /* ── Helpers ── */

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  const isPageLoading = loading || (!lumaChecked && userLoaded);

  /* ── Render ── */

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Events
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Import from Luma or create a new event
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          variant="outline"
          className="border-border/50 hover:border-gold/30 hover:bg-gold/5"
        >
          <Plus className="size-4 mr-2" />
          New Event
        </Button>
      </div>

      {/* ── Luma Event Lookup ── */}
      <Card className="border-border/50 bg-card/50">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-purple-500/10">
              <Search className="size-4 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                Import from Luma
              </p>
              <p className="text-xs text-muted-foreground">
                Paste your Luma event link to import the guest list
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder="https://lu.ma/your-event"
              value={lookupUrl}
              onChange={(e) => {
                setLookupUrl(e.target.value);
                setLookupError("");
                setLookedUpEvent(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") lookupEvent();
              }}
              className="bg-background border-border/50 focus-visible:ring-purple-500/40 text-sm"
            />
            <Button
              onClick={lookupEvent}
              disabled={lookupLoading || !lookupUrl.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
            >
              {lookupLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  <Search className="size-4 mr-2" />
                  Look up
                </>
              )}
            </Button>
          </div>

          {/* Lookup error */}
          {lookupError && (
            <p className="text-xs text-destructive mt-2">{lookupError}</p>
          )}

          {/* Lookup result */}
          {lookedUpEvent && (
            <div className="mt-3 p-3 rounded-lg border border-purple-500/20 bg-purple-500/5 flex items-center gap-3">
              {lookedUpEvent.cover_url && (
                <img
                  src={lookedUpEvent.cover_url}
                  alt=""
                  className="size-12 rounded-md object-cover shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {lookedUpEvent.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(lookedUpEvent.start_at)}
                </p>
              </div>
              <Button
                size="sm"
                disabled={importing === lookedUpEvent.api_id}
                onClick={() => importLumaEvent(lookedUpEvent)}
                className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
              >
                {importing === lookedUpEvent.api_id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <>
                    <Download className="size-3.5 mr-1.5" />
                    Import
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Auto-detected Luma events (unimported only) ── */}
      {lumaLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="size-3.5 animate-spin" />
          Checking Luma for events with your email...
        </div>
      )}

      {!lumaLoading && unimportedLumaEvents.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Available to import
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {unimportedLumaEvents.map((event) => (
              <Card
                key={event.api_id}
                className="border-border/50 bg-card/50 hover:border-purple-500/30 transition-all"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    {event.cover_url && (
                      <img
                        src={event.cover_url}
                        alt=""
                        className="size-10 rounded-md object-cover shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm font-semibold text-foreground leading-snug truncate">
                        {event.name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDate(event.start_at)}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={importing === event.api_id}
                    onClick={() => importLumaEvent(event)}
                    className="w-full border-purple-500/20 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/30"
                  >
                    {importing === event.api_id ? (
                      <Loader2 className="size-3.5 mr-2 animate-spin" />
                    ) : (
                      <Download className="size-3.5 mr-2" />
                    )}
                    Import Guests
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ── Loading state ── */}
      {isPageLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-6 animate-spin text-gold" />
        </div>
      )}

      {/* ── Empty state ── */}
      {!isPageLoading && sessions.length === 0 && unimportedLumaEvents.length === 0 && !lookedUpEvent && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gold/10 mb-4">
            <Calendar className="size-7 text-gold" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            No events yet
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Paste a Luma event link above to import guests, or create a blank event.
          </p>
        </div>
      )}

      {/* ── Imported events grid ── */}
      {!isPageLoading && sessions.length > 0 && (
        <section>
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Your events
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.map((session) => (
              <Card
                key={session.session_id}
                className="group relative cursor-pointer border-border/50 bg-card/50 hover:border-gold/30 hover:bg-card/80 transition-all"
                onClick={() => router.push(`/events/${session.session_id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-[15px] font-semibold text-foreground leading-snug pr-8">
                      {session.name}
                    </CardTitle>
                    <Badge
                      variant={session.status === "active" ? "default" : "secondary"}
                      className={
                        session.status === "active"
                          ? "bg-gold/15 text-gold border-gold/20 hover:bg-gold/20"
                          : ""
                      }
                    >
                      {session.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Users className="size-3.5" />
                      {session.applicant_count}{" "}
                      {session.applicant_count === 1 ? "guest" : "guests"}
                    </span>
                    {session.created_at && (
                      <span className="flex items-center gap-1.5">
                        <Calendar className="size-3.5" />
                        {formatDate(session.created_at)}
                      </span>
                    )}
                  </div>

                  {session.source && (
                    <div className="mt-3">
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                        {session.source}
                      </Badge>
                    </div>
                  )}

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(session);
                    }}
                    className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* ── Create Event Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>New Event</DialogTitle>
            <DialogDescription>
              Create a blank event to start adding guests manually.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Event name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createEvent();
              }}
              className="bg-background border-border/50 focus-visible:ring-gold/40"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              className="border-border/50"
            >
              Cancel
            </Button>
            <Button
              onClick={createEvent}
              disabled={!newName.trim() || creating}
              className="bg-gold hover:bg-gold/90 text-gold-foreground"
            >
              {creating && <Loader2 className="size-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation ── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;?
              This will remove all guest data and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="border-border/50"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteEvent}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
