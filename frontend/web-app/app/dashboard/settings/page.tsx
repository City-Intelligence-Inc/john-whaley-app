"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  Settings,
  Shield,
  ShieldOff,
  Save,
  Plus,
  X,
  Trash2,
  Key,
  Users,
  Check,
  Loader2,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Session {
  session_id: string;
  name: string;
  status: string;
  applicant_count: number;
}

function useApi() {
  const { getToken } = useAuth();
  const headers = useCallback(
    async () => {
      const token = await getToken();
      const h: Record<string, string> = { "Content-Type": "application/json" };
      if (token) h.Authorization = `Bearer ${token}`;
      return h;
    },
    [getToken]
  );
  return { headers };
}

// ── List Editor Component ──
function ListEditor({
  title,
  icon,
  color,
  items,
  onChange,
  placeholder,
}: {
  title: string;
  icon: React.ReactNode;
  color: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState("");

  function add() {
    const val = input.trim().toLowerCase();
    if (val && !items.includes(val)) {
      onChange([...items, val]);
      setInput("");
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className={`text-sm font-semibold flex items-center gap-2 mb-3 ${color}`}>
        {icon} {title}
      </h3>
      <div className="flex gap-2 mb-3">
        <input
          type="text"
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-gold"
        />
        <button
          onClick={add}
          disabled={!input.trim()}
          className="px-3 py-2 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 disabled:opacity-30 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3 text-center">No entries yet</p>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {items.map((item) => (
            <div
              key={item}
              className="flex items-center justify-between bg-background rounded-lg px-3 py-1.5 text-sm text-foreground group"
            >
              <span className="truncate">{item}</span>
              <button
                onClick={() => onChange(items.filter((i) => i !== item))}
                className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="text-[10px] text-muted-foreground mt-2">{items.length} entries</div>
    </div>
  );
}

// ── Main Settings Page ──
export default function SettingsPage() {
  const { headers } = useApi();
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
    const h = await headers();
    try {
      const [wl, bl, sess, luma] = await Promise.all([
        fetch(`${API}/settings/whitelist`, { headers: h }).then((r) => r.json()),
        fetch(`${API}/settings/blacklist`, { headers: h }).then((r) => r.json()),
        fetch(`${API}/sessions`, { headers: h }).then((r) => r.json()),
        fetch(`${API}/settings/luma-key`, { headers: h }).then((r) => r.json()),
      ]);
      setWhitelist(wl.emails || []);
      setBlacklist(bl.emails || []);
      setSessions(sess || []);
      setHasLumaKey(luma.has_key || false);
    } catch (e) {
      console.error(e);
    }
  }, [headers]);

  useEffect(() => { load(); }, [load]);

  // Load per-session lists when session changes
  useEffect(() => {
    if (!selectedSession) return;
    (async () => {
      const h = await headers();
      const [wl, bl] = await Promise.all([
        fetch(`${API}/settings/sessions/${selectedSession}/whitelist`, { headers: h }).then((r) => r.json()),
        fetch(`${API}/settings/sessions/${selectedSession}/blacklist`, { headers: h }).then((r) => r.json()),
      ]);
      setSessionWhitelist(wl.emails || []);
      setSessionBlacklist(bl.emails || []);
    })();
  }, [selectedSession, headers]);

  async function save(key: string, endpoint: string, body: object) {
    setSaving(key);
    try {
      const h = await headers();
      await fetch(`${API}${endpoint}`, {
        method: "PUT",
        headers: h,
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
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
          saved === id
            ? "bg-emerald-600 text-white"
            : "bg-gold text-background hover:bg-gold/90"
        }`}
      >
        {saving === id ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : saved === id ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <Save className="w-3.5 h-3.5" />
        )}
        {saved === id ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <div className="-m-6 sm:-m-8 min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Settings className="w-6 h-6 text-gold" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage lists, API keys, and event configurations</p>
          </div>
        </div>

        {/* ── Global Whitelist / Blacklist ── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Global Lists</h2>
              <p className="text-xs text-muted-foreground">Apply to all events. Whitelisted emails are auto-accepted, blacklisted are auto-rejected.</p>
            </div>
            <SaveBtn
              id="global"
              onClick={() => {
                save("global-wl", "/settings/whitelist", { emails: whitelist });
                save("global-bl", "/settings/blacklist", { emails: blacklist });
              }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ListEditor
              title="Whitelist"
              icon={<Shield className="w-4 h-4" />}
              color="text-emerald-400"
              items={whitelist}
              onChange={setWhitelist}
              placeholder="email@example.com"
            />
            <ListEditor
              title="Blacklist"
              icon={<ShieldOff className="w-4 h-4" />}
              color="text-red-400"
              items={blacklist}
              onChange={setBlacklist}
              placeholder="email@example.com"
            />
          </div>
        </section>

        {/* ── Per-Event Lists ── */}
        <section className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Per-Event Lists</h2>
              <p className="text-xs text-muted-foreground">Override global lists for specific events. Merged with global during analysis.</p>
            </div>
            {selectedSession && (
              <SaveBtn
                id="session"
                onClick={() => {
                  save("session-wl", `/settings/sessions/${selectedSession}/whitelist`, { emails: sessionWhitelist });
                  save("session-bl", `/settings/sessions/${selectedSession}/blacklist`, { emails: sessionBlacklist });
                }}
              />
            )}
          </div>

          {/* Session picker */}
          <div className="mb-4">
            <select
              value={selectedSession || ""}
              onChange={(e) => setSelectedSession(e.target.value || null)}
              className="bg-card border border-border rounded-lg px-4 py-2.5 text-sm text-foreground cursor-pointer outline-none focus:border-gold w-full max-w-md"
            >
              <option value="">Select an event...</option>
              {sessions
                .filter((s) => s.status === "active")
                .map((s) => (
                  <option key={s.session_id} value={s.session_id}>
                    {s.name} ({s.applicant_count} applicants)
                  </option>
                ))}
            </select>
          </div>

          {selectedSession ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ListEditor
                title="Event Whitelist"
                icon={<Shield className="w-4 h-4" />}
                color="text-emerald-400"
                items={sessionWhitelist}
                onChange={setSessionWhitelist}
                placeholder="email@example.com"
              />
              <ListEditor
                title="Event Blacklist"
                icon={<ShieldOff className="w-4 h-4" />}
                color="text-red-400"
                items={sessionBlacklist}
                onChange={setSessionBlacklist}
                placeholder="email@example.com"
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
          <h2 className="text-base font-semibold text-foreground mb-4">API Keys</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Luma API Key */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Key className="w-4 h-4 text-gold" /> Luma API Key
                {hasLumaKey && (
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full ml-auto">Connected</span>
                )}
              </h3>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder={hasLumaKey ? "Key saved (paste new to update)" : "Paste Luma API key"}
                  value={lumaKey}
                  onChange={(e) => setLumaKey(e.target.value)}
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-gold font-mono"
                />
                <button
                  onClick={() => save("luma", "/settings/luma-key", { api_key: lumaKey })}
                  disabled={!lumaKey.trim()}
                  className="px-3 py-2 rounded-lg bg-gold text-background hover:bg-gold/90 disabled:opacity-30 transition-colors"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* li_at Cookie */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Key className="w-4 h-4 text-gold" /> LinkedIn li_at Cookie
              </h3>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Paste li_at from browser DevTools"
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
                  {saved === "liat" ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Stored in browser only. Used for LinkedIn scraping.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
