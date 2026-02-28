"use client";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex h-14 items-center border-b px-6">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
            AR
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-none">
              Applicant Reviewer
            </span>
            <span className="text-[10px] text-muted-foreground">
              Event Organizer Tool
            </span>
          </div>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-6">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
