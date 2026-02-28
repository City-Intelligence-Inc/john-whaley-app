"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { AIConfig } from "@/components/ai-config";
import { ReviewPromptEditor } from "@/components/review-prompt-editor";
import { usePromptSettings } from "@/hooks/use-applicants";

export default function SettingsPage() {
  const { settings, loading, refresh } = usePromptSettings();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Configure AI provider and review prompts
        </p>
      </div>

      <AIConfig />

      {loading ? (
        <Skeleton className="h-64 w-full" />
      ) : settings ? (
        <ReviewPromptEditor settings={settings} onSave={refresh} />
      ) : null}
    </div>
  );
}
