"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <h2 className="text-xl font-bold text-destructive">Something went wrong</h2>
      <pre className="max-w-2xl overflow-auto rounded-md bg-muted p-4 text-sm whitespace-pre-wrap">
        {error.message}
        {"\n\n"}
        {error.stack}
      </pre>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
      >
        Try again
      </button>
    </div>
  );
}
