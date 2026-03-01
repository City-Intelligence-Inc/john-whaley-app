"use client";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex h-16 items-center border-b px-6 bg-[#8C1515]">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-white/20 text-white text-base font-bold">
            224G
          </div>
          <div className="flex flex-col">
            <span className="text-base font-semibold leading-tight text-white">
              CS 224G Demo Day
            </span>
            <span className="text-xs text-white/70">
              Applicant Review Tool &middot; Stanford Winter 2026
            </span>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-6 sm:p-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
