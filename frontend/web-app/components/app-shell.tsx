"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Sparkles } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ── Top Bar ── */}
      <header className="h-14 shrink-0 flex items-center justify-between px-6 border-b border-border/50 bg-card/50">
        <Link href="/events" className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-gold/15">
            <Sparkles className="size-3.5 text-gold" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Selecta
          </span>
        </Link>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "size-8 ring-1 ring-border",
            },
          }}
        />
      </header>

      {/* ── Content ── */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
