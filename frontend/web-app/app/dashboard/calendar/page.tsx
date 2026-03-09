"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Key,
  Loader2,
  Calendar,
  Users,
  MapPin,
  Clock,
  ExternalLink,
  ChevronLeft,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ── Types ──────────────────────────────────────────────────────────────

interface LumaEvent {
  id: string;
  name: string;
  description?: string;
  start_at?: string;
  end_at?: string;
  timezone?: string;
  cover_url?: string;
  url?: string;
  geo_address_json?: { city?: string; full_address?: string };
  geo_latitude?: string;
  geo_longitude?: string;
}

interface EventEntry {
  api_id?: string;
  event: LumaEvent;
  tags?: { id: string; name: string }[];
}

interface Guest {
  id: string;
  user_name?: string;
  user_first_name?: string;
  user_last_name?: string;
  user_email?: string;
  approval_status?: string;
  registered_at?: string;
  checked_in_at?: string;
  phone_number?: string;
  event_tickets?: {
    id: string;
    name: string;
    amount: number;
    currency: string;
    checked_in_at?: string;
  }[];
}

interface GuestEntry {
  api_id?: string;
  guest: Guest;
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatDate(iso?: string) {
  if (!iso) return "TBD";
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusColor(status?: string) {
  switch (status) {
    case "approved":
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "pending_approval":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "declined":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    case "waitlist":
      return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "invited":
      return "bg-blue-500/20 text-blue-400 border-blue-500/30";
    default:
      return "bg-slate-500/20 text-slate-400 border-slate-500/30";
  }
}

function statusIcon(status?: string) {
  switch (status) {
    case "approved":
      return <CheckCircle2 className="size-3.5" />;
    case "declined":
      return <XCircle className="size-3.5" />;
    default:
      return <AlertCircle className="size-3.5" />;
  }
}

const STORAGE_KEY = "luma-api-key";

// ── Component ──────────────────────────────────────────────────────────

export default function CalendarPage() {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [connected, setConnected] = useState(false);

  const [events, setEvents] = useState<EventEntry[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const [selectedEvent, setSelectedEvent] = useState<EventEntry | null>(null);
  const [guests, setGuests] = useState<GuestEntry[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [guestsHasMore, setGuestsHasMore] = useState(false);
  const [guestsNextCursor, setGuestsNextCursor] = useState<string | null>(null);

  // Load saved key
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setApiKey(saved);
      setConnected(true);
    }
  }, []);

  // Fetch events
  const fetchEvents = useCallback(
    async (cursor?: string) => {
      const key = apiKey.trim();
      if (!key) return;
      setLoadingEvents(true);
      try {
        const params = new URLSearchParams();
        params.set("sort_column", "start_at");
        params.set("sort_direction", "desc");
        if (cursor) params.set("pagination_cursor", cursor);

        const res = await fetch(`/api/luma/events?${params}`, {
          headers: { "x-luma-api-key": key },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || err.message || `Error ${res.status}`);
        }
        const data = await res.json();
        if (cursor) {
          setEvents((prev) => [...prev, ...(data.entries || [])]);
        } else {
          setEvents(data.entries || []);
        }
        setHasMore(!!data.has_more);
        setNextCursor(data.next_cursor || null);
        setConnected(true);
        localStorage.setItem(STORAGE_KEY, key);
        if (!cursor) toast.success(`Loaded ${data.entries?.length || 0} events`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to fetch events";
        toast.error(msg);
        if (!cursor) setConnected(false);
      } finally {
        setLoadingEvents(false);
      }
    },
    [apiKey]
  );

  // Fetch guests for an event
  const fetchGuests = useCallback(
    async (eventId: string, cursor?: string) => {
      const key = apiKey.trim();
      if (!key) return;
      setLoadingGuests(true);
      try {
        const params = new URLSearchParams();
        params.set("event_id", eventId);
        if (cursor) params.set("pagination_cursor", cursor);

        const res = await fetch(`/api/luma/guests?${params}`, {
          headers: { "x-luma-api-key": key },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.detail || err.message || `Error ${res.status}`);
        }
        const data = await res.json();
        if (cursor) {
          setGuests((prev) => [...prev, ...(data.entries || [])]);
        } else {
          setGuests(data.entries || []);
        }
        setGuestsHasMore(!!data.has_more);
        setGuestsNextCursor(data.next_cursor || null);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to fetch guests";
        toast.error(msg);
      } finally {
        setLoadingGuests(false);
      }
    },
    [apiKey]
  );

  // Open event detail / guests view
  const openEvent = useCallback(
    (entry: EventEntry) => {
      setSelectedEvent(entry);
      setGuests([]);
      setGuestsNextCursor(null);
      fetchGuests(entry.event.id);
    },
    [fetchGuests]
  );

  // Auto-fetch on connect
  useEffect(() => {
    if (connected && events.length === 0) {
      fetchEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  // ── Render: Guests Detail View ─────────────────────────────────────

  if (selectedEvent) {
    const ev = selectedEvent.event;
    const approvedCount = guests.filter(
      (g) => g.guest.approval_status === "approved"
    ).length;

    return (
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedEvent(null)}
          className="gap-1.5 text-slate-400 hover:text-white"
        >
          <ChevronLeft className="size-4" />
          Back to Events
        </Button>

        <Card className="bg-[#1a1a24] border-[#2a2a38]">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-xl text-white">{ev.name}</CardTitle>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-400">
                  {ev.start_at && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="size-3.5" />
                      {formatDate(ev.start_at)} at {formatTime(ev.start_at)}
                    </span>
                  )}
                  {ev.geo_address_json?.city && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5" />
                      {ev.geo_address_json.city}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="gap-1.5 text-slate-300 border-slate-600">
                  <Users className="size-3.5" />
                  {guests.length} guests ({approvedCount} approved)
                </Badge>
                {ev.url && (
                  <a href={ev.url} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <ExternalLink className="size-3.5" />
                      Luma
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingGuests && guests.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="size-5 animate-spin mr-2" />
                Loading attendees...
              </div>
            ) : guests.length === 0 ? (
              <p className="text-center py-12 text-slate-500">No guests found.</p>
            ) : (
              <>
                <div className="rounded-lg border border-[#2a2a38] overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#2a2a38] hover:bg-transparent">
                        <TableHead className="text-slate-400">Name</TableHead>
                        <TableHead className="text-slate-400">Email</TableHead>
                        <TableHead className="text-slate-400">Status</TableHead>
                        <TableHead className="text-slate-400">Registered</TableHead>
                        <TableHead className="text-slate-400">Checked In</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {guests.map((g) => {
                        const guest = g.guest;
                        const name =
                          guest.user_name ||
                          [guest.user_first_name, guest.user_last_name]
                            .filter(Boolean)
                            .join(" ") ||
                          "—";
                        return (
                          <TableRow
                            key={guest.id}
                            className="border-[#2a2a38] hover:bg-[#22222e]"
                          >
                            <TableCell className="font-medium text-white">
                              {name}
                            </TableCell>
                            <TableCell className="text-slate-400 text-sm">
                              {guest.user_email || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`gap-1 text-xs ${statusColor(guest.approval_status)}`}
                              >
                                {statusIcon(guest.approval_status)}
                                {guest.approval_status || "unknown"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-slate-400 text-sm">
                              {guest.registered_at
                                ? formatDate(guest.registered_at)
                                : "—"}
                            </TableCell>
                            <TableCell className="text-slate-400 text-sm">
                              {guest.checked_in_at
                                ? formatTime(guest.checked_in_at)
                                : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {guestsHasMore && (
                  <div className="flex justify-center mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        guestsNextCursor &&
                        fetchGuests(selectedEvent.event.id, guestsNextCursor)
                      }
                      disabled={loadingGuests}
                    >
                      {loadingGuests ? (
                        <Loader2 className="size-4 animate-spin mr-2" />
                      ) : null}
                      Load More
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render: Events List ────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Calendar</h1>
          <p className="text-sm text-slate-400 mt-1">
            Connect your Luma account to view events and attendees.
          </p>
        </div>
        {connected && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEvents()}
            disabled={loadingEvents}
            className="gap-1.5"
          >
            {loadingEvents ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh
          </Button>
        )}
      </div>

      {/* API Key Card */}
      <Card className="bg-[#1a1a24] border-[#2a2a38]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-white">
            <Key className="size-4" />
            Luma API Key
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                placeholder="Paste your Luma API key..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10 bg-[#12121a] border-[#2a2a38] text-white placeholder:text-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                {showKey ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            <Button
              onClick={() => fetchEvents()}
              disabled={!apiKey.trim() || loadingEvents}
            >
              {loadingEvents ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : null}
              {connected ? "Reconnect" : "Connect"}
            </Button>
            {connected && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  localStorage.removeItem(STORAGE_KEY);
                  setApiKey("");
                  setConnected(false);
                  setEvents([]);
                  toast.success("Disconnected");
                }}
                title="Disconnect"
                className="text-slate-400 hover:text-red-400"
              >
                <XCircle className="size-4" />
              </Button>
            )}
          </div>
          {connected && (
            <p className="text-xs text-green-400 mt-2 flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" />
              Connected to Luma
            </p>
          )}
        </CardContent>
      </Card>

      {/* Events List */}
      {connected && (
        <Card className="bg-[#1a1a24] border-[#2a2a38]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-white">
              <Calendar className="size-4" />
              Events
              {events.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {events.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingEvents && events.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-slate-400">
                <Loader2 className="size-5 animate-spin mr-2" />
                Loading events...
              </div>
            ) : events.length === 0 ? (
              <p className="text-center py-12 text-slate-500">
                No events found on your calendar.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {events.map((entry) => {
                    const ev = entry.event;
                    const isPast =
                      ev.end_at && new Date(ev.end_at) < new Date();
                    return (
                      <button
                        key={ev.id}
                        onClick={() => openEvent(entry)}
                        className="w-full text-left rounded-lg border border-[#2a2a38] p-4 hover:border-[#3a3a4a] hover:bg-[#22222e] transition-colors"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-white truncate">
                                {ev.name}
                              </h3>
                              {isPast && (
                                <Badge
                                  variant="outline"
                                  className="text-xs text-slate-500 border-slate-600 shrink-0"
                                >
                                  Past
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-slate-400">
                              {ev.start_at && (
                                <span className="flex items-center gap-1">
                                  <Clock className="size-3.5" />
                                  {formatDate(ev.start_at)},{" "}
                                  {formatTime(ev.start_at)}
                                </span>
                              )}
                              {ev.geo_address_json?.city && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="size-3.5" />
                                  {ev.geo_address_json.city}
                                </span>
                              )}
                            </div>
                            {entry.tags && entry.tags.length > 0 && (
                              <div className="flex gap-1.5 mt-2">
                                {entry.tags.map((tag) => (
                                  <Badge
                                    key={tag.id}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {tag.name}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500 shrink-0">
                            <Users className="size-4" />
                            <span className="text-sm">View</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {hasMore && (
                  <div className="flex justify-center mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => nextCursor && fetchEvents(nextCursor)}
                      disabled={loadingEvents}
                    >
                      {loadingEvents ? (
                        <Loader2 className="size-4 animate-spin mr-2" />
                      ) : null}
                      Load More Events
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
