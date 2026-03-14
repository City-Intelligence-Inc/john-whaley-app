"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Sparkles,
  LayoutDashboard,
  CalendarDays,
  Linkedin,
  Settings,
  ShieldCheck,
  ChevronDown,
} from "lucide-react";
import { useEffect, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Session {
  session_id: string;
  name: string;
  status: string;
  applicant_count: number;
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Review", icon: LayoutDashboard },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/dashboard/linkedin", label: "LinkedIn", icon: Linkedin },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [sessionOpen, setSessionOpen] = useState(false);

  // Load sessions
  useEffect(() => {
    fetch(`${API}/sessions`)
      .then((r) => r.json())
      .then((data) => {
        const active = (data || []).filter((s: Session) => s.status === "active");
        setSessions(active);
        // Auto-select first active session
        const saved = localStorage.getItem("active_session");
        if (saved && active.find((s: Session) => s.session_id === saved)) {
          setActiveSession(saved);
        } else if (active.length > 0) {
          setActiveSession(active[0].session_id);
        }
      })
      .catch(() => {});
  }, []);

  const switchSession = useCallback((id: string) => {
    setActiveSession(id);
    localStorage.setItem("active_session", id);
    setSessionOpen(false);
  }, []);

  const currentSession = sessions.find((s) => s.session_id === activeSession);

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Left Sidebar ── */}
      <aside className="w-[220px] shrink-0 flex flex-col border-r border-border/50 bg-card/50">
        {/* Brand */}
        <div className="px-5 pt-5 pb-4">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gold/15">
              <Sparkles className="size-4 text-gold" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              AI Select
            </span>
          </Link>
        </div>

        {/* Session Switcher */}
        <div className="px-3 mb-2">
          <button
            onClick={() => setSessionOpen(!sessionOpen)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-background border border-border hover:border-gold/30 transition-colors text-left"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-gold shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">
                Event
              </div>
              <div className="text-xs text-foreground truncate">
                {currentSession?.name || "Select event..."}
              </div>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${
                sessionOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {sessionOpen && (
            <div className="mt-1 bg-background border border-border rounded-lg overflow-hidden shadow-xl">
              {sessions.length === 0 ? (
                <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                  No active events
                </div>
              ) : (
                sessions.map((s) => (
                  <button
                    key={s.session_id}
                    onClick={() => switchSession(s.session_id)}
                    className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between ${
                      s.session_id === activeSession
                        ? "bg-gold/10 text-gold"
                        : "text-foreground hover:bg-card"
                    }`}
                  >
                    <span className="truncate">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
                      {s.applicant_count}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Section label */}
        <div className="px-5 pt-3 pb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Navigation
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
                  active
                    ? "bg-gold/10 text-gold"
                    : "text-muted-foreground hover:bg-card hover:text-foreground"
                }`}
              >
                <Icon
                  className={`size-4 shrink-0 transition-colors ${
                    active
                      ? "text-gold"
                      : "text-muted-foreground/60 group-hover:text-muted-foreground"
                  }`}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-border/50">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "size-8 ring-1 ring-border",
              },
            }}
          />
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 sm:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
