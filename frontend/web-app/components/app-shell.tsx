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
      {/* Sidebar — Klarity-inspired navy */}
      <aside className="w-60 shrink-0 bg-[#1a2236] flex flex-col">
        {/* Logo / Brand */}
        <div className="px-5 pt-6 pb-8 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#488CFF] text-white text-sm font-bold shadow-md shadow-[#488CFF]/25">
            ER
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold leading-tight text-white tracking-tight">
              Event Review
            </span>
            <span className="text-[11px] text-[#7B8DB5] font-medium">
              AI Applicant Review
            </span>
          </div>
        </div>

        {/* Section label */}
        <div className="px-5 pb-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#4A5A7A]">
            Navigation
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all ${
                  active
                    ? "bg-[#488CFF]/15 text-[#6AABFF] shadow-sm shadow-[#488CFF]/10"
                    : "text-[#7B8DB5] hover:bg-white/[0.04] hover:text-[#B0BFD8]"
                }`}
              >
                <Icon
                  className={`size-[18px] shrink-0 transition-colors ${
                    active
                      ? "text-[#488CFF]"
                      : "text-[#4A5A7A] group-hover:text-[#7B8DB5]"
                  }`}
                />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-5 py-5 border-t border-[#253256]">
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
      <main className="flex-1 overflow-auto bg-[#111827]">
        <div className="p-6 sm:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
