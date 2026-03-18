"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  CalendarDays,
  Users,
  Loader2,
  ExternalLink,
  Trash2,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import type { Session } from "@/lib/api";

export default function EventsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [lumaUrl, setLumaUrl] = useState("");
  const [creating, setCreating] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const data = await api.listSessions();
      setSessions(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleCreate = async () => {
    if (!newName.trim() && !lumaUrl.trim()) return;
    setCreating(true);
    try {
      if (lumaUrl.trim()) {
        const event = await api.lookupLumaEvent(lumaUrl.trim());
        const result = await api.importFromLuma(event.api_id);
        toast.success(`Imported from Luma: ${event.name}`);
        router.push(`/events/${result.session_id}`);
      } else {
        const session = await api.createSession({ name: newName.trim() });
        toast.success("Event created");
        router.push(`/events/${session.session_id}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this event and all its applicants?")) return;
    try {
      await api.deleteSession(id);
      toast.success("Event deleted");
      setSessions((prev) => prev.filter((s) => s.session_id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Select an event to review its guest list.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="size-4 mr-2" />
          New Event
        </Button>
      </div>

      {sessions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CalendarDays className="size-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium mb-1">No events yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Create an event or import from Luma to get started.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="size-4 mr-2" />
              New Event
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sessions.map((s) => (
            <Card
              key={s.session_id}
              className="cursor-pointer transition-all hover:shadow-md hover:border-primary/20 group"
              onClick={() => router.push(`/events/${s.session_id}`)}
            >
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/5 text-primary shrink-0">
                  <CalendarDays className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate group-hover:text-primary transition-colors">
                    {s.name}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="size-3" />
                      {s.applicant_count} guests
                    </span>
                    {s.source && (
                      <Badge variant="secondary" className="text-[10px] h-5">
                        {s.source}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {s.last_analysis_results && (
                    <div className="text-xs text-muted-foreground text-right">
                      <span className="text-emerald-600 font-medium">{s.last_analysis_results.accepted}</span>
                      {" / "}
                      <span>{s.last_analysis_results.total}</span>
                      <span className="ml-1">accepted</span>
                    </div>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                    onClick={(e) => handleDelete(s.session_id, e)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                  <ExternalLink className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Event</DialogTitle>
            <DialogDescription>
              Create a blank event or import guests from a Luma link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Event Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Demo Day 2026"
              />
            </div>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  or import from Luma
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Link2 className="size-3.5" />
                Luma Event URL
              </Label>
              <Input
                value={lumaUrl}
                onChange={(e) => setLumaUrl(e.target.value)}
                placeholder="https://lu.ma/your-event"
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={creating || (!newName.trim() && !lumaUrl.trim())}
              className="w-full"
            >
              {creating && <Loader2 className="size-4 mr-2 animate-spin" />}
              {lumaUrl.trim() ? "Import from Luma" : "Create Event"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
