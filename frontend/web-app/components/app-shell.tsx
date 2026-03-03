"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex h-16 items-center border-b px-6 bg-[#1e293b]">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-white/20 text-white text-base font-bold">
            ER
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold leading-tight text-white">
              Event Review
            </span>
            <span className="text-xs text-white/70">
              AI-Powered Applicant Review Tool
            </span>
          </div>
        </div>
        <nav className="ml-8 flex gap-1">
          <Link
            href="/"
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              pathname === "/"
                ? "bg-white/20 text-white"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            Review
          </Link>
          <Link
            href="/admin"
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              pathname === "/admin"
                ? "bg-white/20 text-white"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            Admin
          </Link>
        </nav>
      </header>
      <main className="flex-1 overflow-auto p-6 sm:p-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
