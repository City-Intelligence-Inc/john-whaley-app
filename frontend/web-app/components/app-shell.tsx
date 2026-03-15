"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  Sparkles,
  CalendarDays,
  Linkedin,
  Settings,
  LayoutDashboard,
  Brain,
  SlidersHorizontal,
} from "lucide-react";

const TOP_NAV = [
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/linkedin", label: "LinkedIn", icon: Linkedin },
  { href: "/settings", label: "Settings", icon: Settings },
];

const EVENT_SUB_NAV = [
  { suffix: "", label: "Overview", icon: LayoutDashboard },
  { suffix: "/analyze", label: "Analyze", icon: Brain },
  { suffix: "/settings", label: "Event Settings", icon: SlidersHorizontal },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Extract sessionId from pathname: /events/[sessionId] or /events/[sessionId]/...
  const eventMatch = pathname.match(/^\/events\/([^/]+)/);
  const sessionId = eventMatch ? eventMatch[1] : null;

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Left Sidebar ── */}
      <aside className="w-[220px] shrink-0 flex flex-col border-r border-border/50 bg-card/50">
        {/* Brand */}
        <div className="px-5 pt-5 pb-4">
          <Link href="/events" className="flex items-center gap-2.5 group">
            <div className="flex size-8 items-center justify-center rounded-lg bg-gold/15">
              <Sparkles className="size-4 text-gold" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-foreground">
              Selecta
            </span>
          </Link>
        </div>

        {/* Section label */}
        <div className="px-5 pt-3 pb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Navigation
          </span>
        </div>

        {/* Top-level nav */}
        <nav className="px-3 space-y-0.5">
          {TOP_NAV.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/events"
                ? pathname === "/events" || pathname.startsWith("/events/")
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

        {/* Event sub-nav (shown when inside /events/[sessionId]) */}
        {sessionId && (
          <>
            <div className="px-5 pt-5 pb-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Event
              </span>
            </div>
            <nav className="px-3 space-y-0.5">
              {EVENT_SUB_NAV.map(({ suffix, label, icon: Icon }) => {
                const href = `/events/${sessionId}${suffix}`;
                const active =
                  suffix === ""
                    ? pathname === `/events/${sessionId}`
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
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

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
