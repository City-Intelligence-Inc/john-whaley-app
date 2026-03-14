"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Shield,
  ShieldOff,
  Save,
  Plus,
  X,
  Key,
  Check,
  Loader2,
  Search,
  UserPlus,
  Users,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Session {
  session_id: string;
  name: string;
  status: string;
  applicant_count: number;
}

interface Person {
  id: string; // email or url
  name: string;
  email?: string;
  headline?: string;
  photo_url?: string;
  source: "linkedin" | "applicant";
}

// ── Person Search (searches LinkedIn DB + applicants) ──
function PersonSearch({
  onAdd,
  existingIds,
}: {
  onAdd: (person: Person) => void;
  existingIds: Set<string>;
}) {
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load people from LinkedIn DB + sessions
  useEffect(() => {
    (async () => {
      try {
        const [liResp, sessResp] = await Promise.all([
          fetch(`${API}/linkedin/database`).then((r) => r.json()),
          fetch(`${API}/sessions`).then((r) => r.json()),
        ]);

        const ppl: Person[] = [];
        // LinkedIn profiles
        for (const p of liResp.items || []) {
          if (p.email || p.name) {
            ppl.push({
              id: p.email?.toLowerCase() || p.url,
              name: p.name || "Unknown",
              email: p.email,
              headline: p.headline,
              photo_url: p.photo_url,
              source: "linkedin",
            });
          }
        }

        // Applicants from active sessions
        for (const s of sessResp || []) {
          if (s.status !== "active") continue;
          try {
            const appResp = await fetch(
              `${API}/applicants?session_id=${s.session_id}`
            ).then((r) => r.json());
            for (const a of appResp || []) {
              if (a.email && !ppl.find((p) => p.id === a.email.toLowerCase())) {
                ppl.push({
                  id: a.email.toLowerCase(),
                  name: a.name || a.email,
                  email: a.email,
                  headline: a.attendee_type_detail || a.attendee_type || "",
                  source: "applicant",
                });
              }
            }
          } catch {}
        }

        setPeople(ppl);
        setLoaded(true);
      } catch (e) {
        console.error(e);
        setLoaded(true);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return people
      .filter(
        (p) =>
          !existingIds.has(p.id) &&
          [p.name, p.email, p.headline].some((f) =>
            f?.toLowerCase().includes(q)
          )
      )
      .slice(0, 8);
  }, [query, people, existingIds]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder={
              loaded
                ? `Search ${people.length} people by name or email...`
                : "Loading people..."
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-gold"
          />
        </div>
      </div>

      {/* Search results dropdown */}
      {filtered.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-xl overflow-hidden">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onAdd(p);
                setQuery("");
              }}
              className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-background transition-colors"
            >
              {p.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.photo_url}
                  alt=""
                  className="w-7 h-7 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gold/10 flex items-center justify-center text-[10px] font-bold text-gold">
                  {p.name
                    .split(" ")
                    .map((w) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-foreground font-medium truncate">
                  {p.name}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {p.email || p.headline || ""}
                </div>
              </div>
              <span className="text-[9px] text-muted-foreground/60 uppercase px-1.5 py-0.5 rounded bg-background border border-border">
                {p.source === "linkedin" ? "LI" : "App"}
              </span>
              <UserPlus className="w-3.5 h-3.5 text-gold shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── List Editor with Person Search ──
function SmartListEditor({
  title,
  icon,
  color,
  items,
  onChange,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  const [manualInput, setManualInput] = useState("");
  const existingIds = useMemo(() => new Set(items), [items]);

  function addManual() {
    const val = manualInput.trim().toLowerCase();
    if (val && !items.includes(val)) {
      onChange([...items, val]);
      setManualInput("");
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3
        className={`text-sm font-semibold flex items-center gap-2 mb-4 ${color}`}
      >
        {icon} {title}
        <span className="ml-auto text-[10px] text-muted-foreground font-normal">
          {items.length} entries
        </span>
      </h3>

      {/* Person search */}
      <div className="mb-3">
        <PersonSearch
          existingIds={existingIds}
          onAdd={(p) => {
            if (p.email && !items.includes(p.email.toLowerCase())) {
              onChange([...items, p.email.toLowerCase()]);
            }
          }}
        />
      </div>

      {/* Manual email input */}
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder="Or type email manually..."
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addManual()}
          className="flex-1 bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-gold"
        />
        <button
          onClick={addManual}
          disabled={!manualInput.trim()}
          className="px-2.5 py-1.5 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 disabled:opacity-30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">
          No entries — search for a person above or type an email
        </p>
      ) : (
        <div className="space-y-0.5 max-h-60 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item}
              className="flex items-center justify-between bg-background rounded-lg px-3 py-1.5 text-sm text-foreground group"
            >
              <span className="truncate text-xs">{item}</span>
              <button
                onClick={() => onChange(items.filter((i) => i !== item))}
                className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Settings Page ──
export default function SettingsPage() {
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionWhitelist, setSessionWhitelist] = useState<string[]>([]);
  const [sessionBlacklist, setSessionBlacklist] = useState<string[]>([]);
  const [lumaKey, setLumaKey] = useState("");
  const [hasLumaKey, setHasLumaKey] = useState(false);
  const [liAt, setLiAt] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  // Load data
  const load = useCallback(async () => {
    try {
      const [wl, bl, sess, luma] = await Promise.all([
        fetch(`${API}/settings/whitelist`).then((r) => r.json()),
        fetch(`${API}/settings/blacklist`).then((r) => r.json()),
        fetch(`${API}/sessions`).then((r) => r.json()),
        fetch(`${API}/settings/luma-key`).then((r) => r.json()),
      ]);
      setWhitelist(wl.emails || []);
      setBlacklist(bl.emails || []);
      setSessions((sess || []).filter((s: Session) => s.status === "active"));
      setHasLumaKey(luma.has_key || false);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    load();
    setLiAt(localStorage.getItem("li_at") || "");
  }, [load]);

  // Load per-session lists
  useEffect(() => {
    if (!selectedSession) return;
    (async () => {
      const [wl, bl] = await Promise.all([
        fetch(
          `${API}/settings/sessions/${selectedSession}/whitelist`
        ).then((r) => r.json()),
        fetch(
          `${API}/settings/sessions/${selectedSession}/blacklist`
        ).then((r) => r.json()),
      ]);
      setSessionWhitelist(wl.emails || []);
      setSessionBlacklist(bl.emails || []);
    })();
  }, [selectedSession]);

  async function save(key: string, endpoint: string, body: object) {
    setSaving(key);
    try {
      await fetch(`${API}${endpoint}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setSaved(key);
      setTimeout(() => setSaved(null), 1500);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(null);
    }
  }

  function SaveBtn({ id, onClick }: { id: string; onClick: () => void }) {
    const isActive = saving === id;
    const isDone = saved === id;
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          isDone
            ? "bg-emerald-600 text-white"
            : "bg-gold text-background hover:bg-gold/90"
        }`}
      >
        {isActive ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isDone ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <Save className="w-3.5 h-3.5" />
        )}
        {isDone ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage whitelist, blacklist, API keys, and event-specific rules
        </p>
      </div>

      {/* ── Global Lists ── */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-gold" /> Global Lists
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Apply to all events. Search people from your LinkedIn database or
              uploaded applicants.
            </p>
          </div>
          <SaveBtn
            id="global"
            onClick={() => {
              save("global", "/settings/whitelist", { emails: whitelist });
              save("global-bl", "/settings/blacklist", { emails: blacklist });
            }}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SmartListEditor
            title="Whitelist (Auto-Accept)"
            icon={<Shield className="w-4 h-4" />}
            color="text-emerald-400"
            items={whitelist}
            onChange={setWhitelist}
          />
          <SmartListEditor
            title="Blacklist (Auto-Reject)"
            icon={<ShieldOff className="w-4 h-4" />}
            color="text-red-400"
            items={blacklist}
            onChange={setBlacklist}
          />
        </div>
      </section>

      {/* ── Per-Event Lists ── */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Per-Event Lists
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Event-specific overrides. Merged with global lists during analysis.
            </p>
          </div>
          {selectedSession && (
            <SaveBtn
              id="session"
              onClick={() => {
                save(
                  "session",
                  `/settings/sessions/${selectedSession}/whitelist`,
                  { emails: sessionWhitelist }
                );
                save(
                  "session-bl",
                  `/settings/sessions/${selectedSession}/blacklist`,
                  { emails: sessionBlacklist }
                );
              }}
            />
          )}
        </div>

        {/* Event picker */}
        <div className="mb-4">
          <div className="flex gap-2 flex-wrap">
            {sessions.map((s) => (
              <button
                key={s.session_id}
                onClick={() =>
                  setSelectedSession(
                    s.session_id === selectedSession ? null : s.session_id
                  )
                }
                className={`px-4 py-2 rounded-lg text-xs font-medium border transition-all ${
                  s.session_id === selectedSession
                    ? "bg-gold/10 border-gold/30 text-gold"
                    : "border-border text-muted-foreground hover:border-gold/20 hover:text-foreground"
                }`}
              >
                {s.name}
                <span className="ml-2 text-[10px] text-muted-foreground">
                  {s.applicant_count}
                </span>
              </button>
            ))}
            {sessions.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">
                No active events
              </p>
            )}
          </div>
        </div>

        {selectedSession ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SmartListEditor
              title="Event Whitelist"
              icon={<Shield className="w-4 h-4" />}
              color="text-emerald-400"
              items={sessionWhitelist}
              onChange={setSessionWhitelist}
            />
            <SmartListEditor
              title="Event Blacklist"
              icon={<ShieldOff className="w-4 h-4" />}
              color="text-red-400"
              items={sessionBlacklist}
              onChange={setSessionBlacklist}
            />
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm bg-card border border-border rounded-xl">
            Select an event above to manage its lists
          </div>
        )}
      </section>

      {/* ── API Keys ── */}
      <section className="mb-10">
        <h2 className="text-base font-semibold text-foreground mb-4">
          API Keys & Credentials
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Luma */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Key className="w-4 h-4 text-gold" /> Luma API Key
              {hasLumaKey && (
                <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full ml-auto">
                  Connected
                </span>
              )}
            </h3>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder={
                  hasLumaKey
                    ? "Key saved (paste to update)"
                    : "Paste Luma API key"
                }
                value={lumaKey}
                onChange={(e) => setLumaKey(e.target.value)}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-gold font-mono"
              />
              <button
                onClick={() =>
                  save("luma", "/settings/luma-key", { api_key: lumaKey })
                }
                disabled={!lumaKey.trim()}
                className={`px-3 py-2 rounded-lg transition-colors ${
                  saved === "luma"
                    ? "bg-emerald-600 text-white"
                    : "bg-gold text-background hover:bg-gold/90 disabled:opacity-30"
                }`}
              >
                {saved === "luma" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* li_at */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Key className="w-4 h-4 text-gold" /> LinkedIn li_at Cookie
            </h3>
            <div className="flex gap-2">
              <input
                type="password"
                placeholder="Paste from DevTools → Cookies → linkedin.com"
                value={liAt}
                onChange={(e) => setLiAt(e.target.value)}
                className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-gold font-mono"
              />
              <button
                onClick={() => {
                  localStorage.setItem("li_at", liAt);
                  setSaved("liat");
                  setTimeout(() => setSaved(null), 1500);
                }}
                disabled={!liAt.trim()}
                className={`px-3 py-2 rounded-lg transition-colors ${
                  saved === "liat"
                    ? "bg-emerald-600 text-white"
                    : "bg-gold text-background hover:bg-gold/90 disabled:opacity-30"
                }`}
              >
                {saved === "liat" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              Browser-only. Used for LinkedIn profile scraping.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
