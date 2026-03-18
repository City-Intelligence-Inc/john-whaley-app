"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Brain,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useEvent } from "@/components/event-provider";
import { api } from "@/lib/api";

const PROVIDERS = [
  { id: "anthropic", name: "Anthropic" },
  { id: "openai", name: "OpenAI" },
];

const MODELS: Record<string, { id: string; name: string }[]> = {
  anthropic: [
    { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4" },
    { id: "claude-haiku-4-20250414", name: "Claude Haiku 4" },
  ],
  openai: [
    { id: "gpt-4o", name: "GPT-4o" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
  ],
};

export default function AnalyzePage() {
  const router = useRouter();
  const { sessionId, session, applicants, refreshAll } = useEvent();

  const [apiKey, setApiKey] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("ai_api_key") || "" : ""
  );
  const [provider, setProvider] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("ai_provider") || "anthropic" : "anthropic"
  );
  const [model, setModel] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("ai_model") || "claude-sonnet-4-20250514" : "claude-sonnet-4-20250514"
  );
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0, phase: "" });
  const [done, setDone] = useState(false);

  const handleRun = useCallback(async () => {
    if (!apiKey.trim()) { toast.error("Enter an API key"); return; }
    if (applicants.length === 0) { toast.error("No guests to analyze"); return; }

    // Save preferences
    localStorage.setItem("ai_api_key", apiKey);
    localStorage.setItem("ai_provider", provider);
    localStorage.setItem("ai_model", model);

    setRunning(true);
    setDone(false);
    setProgress({ completed: 0, total: applicants.length, phase: "Starting..." });

    try {
      await api.analyzeAllStream(
        {
          api_key: apiKey,
          model,
          provider,
          prompt: "",
          criteria: [],
          session_id: sessionId,
        },
        {
          onStart: (d) => setProgress((p) => ({ ...p, total: d.total, phase: "Analyzing..." })),
          onPhase: (d) => setProgress((p) => ({ ...p, phase: d.message })),
          onClassify: (d) => setProgress((p) => ({ ...p, completed: d.completed, phase: `Classifying: ${d.name}` })),
          onProgress: (d) => setProgress((p) => ({ ...p, completed: d.completed, phase: `Scoring: ${d.name}` })),
          onError: (d) => setProgress((p) => ({ ...p, completed: d.completed })),
          onComplete: () => {
            setDone(true);
            setRunning(false);
            toast.success("Analysis complete");
            refreshAll();
          },
        }
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
      setRunning(false);
    }
  }, [apiKey, provider, model, applicants, sessionId, refreshAll]);

  const pct = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push(`/events/${sessionId}`)}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Run Analysis</h1>
          <p className="text-sm text-muted-foreground">{session?.name} — {applicants.length} guests</p>
        </div>
      </div>

      {done ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="pt-6 flex flex-col items-center text-center gap-4">
            <CheckCircle2 className="size-12 text-emerald-600" />
            <div>
              <p className="text-lg font-semibold text-emerald-900">Analysis Complete</p>
              <p className="text-sm text-emerald-700 mt-1">
                {progress.completed} guests analyzed. Go back to review results.
              </p>
            </div>
            <Button onClick={() => router.push(`/events/${sessionId}`)}>
              View Results
            </Button>
          </CardContent>
        </Card>
      ) : running ? (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3">
              <Loader2 className="size-5 animate-spin text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">{progress.phase}</p>
                <p className="text-xs text-muted-foreground">
                  {progress.completed} / {progress.total}
                </p>
              </div>
              <span className="text-sm font-mono tabular-nums">{Math.round(pct)}%</span>
            </div>
            <Progress value={pct} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="size-4" />
              AI Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <p className="text-xs text-muted-foreground">Your key is stored locally and never sent to our servers.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select value={provider} onValueChange={(v) => { setProvider(v); setModel(MODELS[v]?.[0]?.id || ""); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVIDERS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(MODELS[provider] || []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleRun} className="w-full" disabled={!apiKey.trim()}>
              <Brain className="size-4 mr-2" />
              Analyze {applicants.length} Guests
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
