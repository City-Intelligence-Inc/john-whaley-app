"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Loader2,
  Calendar,
  Users,
  ExternalLink,
  Trash2,
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
}

export default function EventsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  // Luma import dialog
  const [lumaOpen, setLumaOpen] = useState(false);
  const [lumaEvents, setLumaEvents] = useState<LumaEvent[]>([]);
  const [lumaLoading, setLumaLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);

  // Create event dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // ── Luma Import ──
  const openLumaDialog = async () => {
    setLumaOpen(true);
    setLumaLoading(true);
    try {
      const res = await api.listLumaEvents();
      setLumaEvents(res.entries || []);
    } catch {
      toast.error("Failed to fetch Luma events. Check your API key in Settings.");
    } finally {
      setLumaLoading(false);
    }
  };

  const importLumaEvent = async (event: LumaEvent) => {
    setImporting(event.api_id);
    try {
      const res = await api.importFromLuma(event.api_id);
      toast.success(`Imported ${res.count} guests from "${event.name}"`);
      setLumaOpen(false);
      router.push(`/events/${res.session_id}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to import event"
      );
    } finally {
      setImporting(null);
    }
  };

  // ── Create Manual Event ──
  const createEvent = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const session = await api.createSession({
        name: newName.trim(),
        source: "manual",
      });
      toast.success(`Created "${session.name}"`);
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

  // ── Delete Event ──
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Events
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your events and guest lists
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={openLumaDialog}
            className="border-border/50 hover:border-gold/30 hover:bg-gold/5"
          >
            <ExternalLink className="size-4 mr-2" />
            Import from Luma
          </Button>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-gold hover:bg-gold/90 text-gold-foreground"
          >
            <Plus className="size-4 mr-2" />
            New Event
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-gold" />
        </div>
      )}

      {/* Empty state */}
      {!loading && sessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gold/10 mb-4">
            <Calendar className="size-7 text-gold" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            No events yet
          </h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            Create a new event or import one from Luma to get started with guest
            selection.
          </p>
        </div>
      )}

      {/* Events grid */}
      {!loading && sessions.length > 0 && (
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
                    variant={
                      session.status === "active" ? "default" : "secondary"
                    }
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

                {/* Source badge */}
                {session.source && (
                  <div className="mt-3">
                    <Badge
                      variant="secondary"
                      className="text-[10px] uppercase tracking-wider"
                    >
                      {session.source}
                    </Badge>
                  </div>
                )}

                {/* Delete button (shown on hover) */}
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
      )}

      {/* ── Luma Import Dialog ── */}
      <Dialog open={lumaOpen} onOpenChange={setLumaOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Import from Luma</DialogTitle>
            <DialogDescription>
              Select a Luma event to import its guest list.
            </DialogDescription>
          </DialogHeader>

          {lumaLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-gold" />
            </div>
          ) : lumaEvents.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No Luma events found. Make sure your API key is configured in
              Settings.
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto -mx-6 px-6 space-y-2">
              {lumaEvents.map((event) => (
                <button
                  key={event.api_id}
                  disabled={importing !== null}
                  onClick={() => importLumaEvent(event)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-gold/30 hover:bg-gold/5 transition-all text-left disabled:opacity-50"
                >
                  {event.cover_url && (
                    <img
                      src={event.cover_url}
                      alt=""
                      className="size-10 rounded-md object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {event.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(event.start_at)}
                    </div>
                  </div>
                  {importing === event.api_id && (
                    <Loader2 className="size-4 animate-spin text-gold shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Create Event Dialog ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>New Event</DialogTitle>
            <DialogDescription>
              Create a blank event to start adding guests.
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

      {/* ── Delete Confirmation Dialog ── */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;?
              This will remove all associated guest data. This action cannot be
              undone.
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
