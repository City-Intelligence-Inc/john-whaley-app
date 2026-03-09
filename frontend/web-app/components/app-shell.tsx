"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  CalendarDays,
  ClipboardCheck,
  Linkedin,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Review", icon: ClipboardCheck },
  { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/dashboard/linkedin", label: "LinkedIn", icon: Linkedin },
  { href: "/dashboard/admin", label: "Admin", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-[#0b1120] border-r border-white/[0.06] flex flex-col">
        {/* Logo / Brand */}
        <div className="px-4 py-5 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 text-sm font-bold">
            ER
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight text-white">
              Event Review
            </span>
            <span className="text-[11px] text-white/40">
              AI Applicant Review
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white/[0.08] text-white"
                    : "text-white/50 hover:bg-white/[0.04] hover:text-white/80"
                }`}
              >
                <Icon className="size-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-white/[0.06]">
          <UserButton
            appearance={{
              elements: {
                avatarBox: "size-8",
              },
            }}
          />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-[#0f172a]">
        <div className="p-6 sm:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
