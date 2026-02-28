"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Brain,
  Plus,
  X,
  Loader2,
  GripVertical,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { useStats } from "@/hooks/use-applicants";

export default function AnalyzePage() {
  const router = useRouter();
  const { stats } = useStats();
  const [prompt, setPrompt] = useState(
    "You are evaluating applicants for an exclusive tech networking event. Select candidates who would contribute most to meaningful conversations and connections."
  );
  const [criteria, setCriteria] = useState<string[]>([
    "Professional relevance",
    "Industry experience",
    "Networking potential",
  ]);
  const [newCriterion, setNewCriterion] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState<"criteria" | "analyzing" | "done">("criteria");

  // Load saved settings
  useEffect(() => {
    api.getPromptSettings().then((s) => {
      if (s.default_prompt) setPrompt(s.default_prompt);
      if (s.criteria?.length) setCriteria(s.criteria);
    }).catch(() => {});
  }, []);

  const addCriterion = () => {
    console.log("[Analyze] Add criterion clicked:", newCriterion.trim());
    const value = newCriterion.trim();
    if (value && !criteria.includes(value)) {
      setCriteria([...criteria, value]);
      setNewCriterion("");
    }
  };

  const removeCriterion = (c: string) => {
    console.log("[Analyze] Remove criterion clicked:", c);
    setCriteria(criteria.filter((x) => x !== c));
  };

  const handleAnalyze = async () => {
    console.log("[Analyze] Analyze All clicked, criteria:", criteria);
    const apiKey = localStorage.getItem("ai_api_key");
    const provider = localStorage.getItem("ai_provider") || "anthropic";
    const model = localStorage.getItem("ai_model") || "claude-sonnet-4-20250514";

    if (!apiKey) {
      toast.error("Please configure your AI API key in Settings first");
      return;
    }

    setStep("analyzing");
    setAnalyzing(true);

    try {
      // Save settings for next time
      await api.updatePromptSettings({ default_prompt: prompt, criteria });

      // Run bulk analysis
      const result = await api.analyzeAll({
        api_key: apiKey,
        model,
        provider,
        prompt,
        criteria,
      });

      const accepted = result.candidates.filter((c) => c.status === "accepted").length;
      const waitlisted = result.candidates.filter((c) => c.status === "waitlisted").length;
      const rejected = result.candidates.filter((c) => c.status === "rejected").length;

      toast.success(
        `Analysis complete: ${accepted} accepted, ${waitlisted} waitlisted, ${rejected} rejected`
      );
      setStep("done");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed");
      setStep("criteria");
    } finally {
      setAnalyzing(false);
    }
  };

  if (step === "analyzing") {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-24 space-y-6">
        <div className="relative">
          <Brain className="size-16 text-primary animate-pulse" />
          <Sparkles className="size-6 text-yellow-500 absolute -top-1 -right-1 animate-bounce" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Analyzing Applicants</h2>
          <p className="text-muted-foreground max-w-md">
            AI is reviewing all {stats?.total || 0} applicants against your criteria
            and ranking them. This may take a moment...
          </p>
        </div>
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (step === "done") {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center py-24 space-y-6">
        <div className="flex size-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <Brain className="size-8 text-green-600 dark:text-green-400" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Analysis Complete</h2>
          <p className="text-muted-foreground max-w-md">
            All applicants have been ranked and categorized. View the results to see
            who should attend, who&apos;s on the waitlist, and who was rejected.
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => { console.log("[Analyze] View Results clicked"); router.push("/results"); }} size="lg">
            View Results
          </Button>
          <Button onClick={() => { console.log("[Analyze] Re-analyze clicked"); setStep("criteria"); }} variant="outline" size="lg">
            Re-analyze
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">AI Analysis</h2>
        <p className="text-muted-foreground">
          Define your criteria, then let AI rank all {stats?.total || 0} applicants
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evaluation Prompt</CardTitle>
          <CardDescription>
            Describe your event and what kind of applicants you&apos;re looking for
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder="Describe your event and ideal attendees..."
            className="resize-none"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evaluation Criteria</CardTitle>
          <CardDescription>
            Add criteria the AI should use to evaluate applicants (in order of importance)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newCriterion}
              onChange={(e) => setNewCriterion(e.target.value)}
              placeholder="e.g., Technical expertise, Leadership experience..."
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCriterion();
                }
              }}
            />
            <Button variant="outline" size="icon" onClick={addCriterion}>
              <Plus className="size-4" />
            </Button>
          </div>

          {criteria.length > 0 && (
            <div className="space-y-2">
              {criteria.map((c, i) => (
                <div
                  key={c}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <GripVertical className="size-4 text-muted-foreground" />
                  <span className="text-muted-foreground font-mono text-xs w-5">
                    {i + 1}.
                  </span>
                  <span className="flex-1">{c}</span>
                  <button
                    onClick={() => removeCriterion(c)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <Button
        onClick={handleAnalyze}
        disabled={analyzing || !stats?.total}
        size="lg"
        className="w-full"
      >
        <Brain className="size-5 mr-2" />
        {!stats?.total
          ? "Upload applicants first"
          : `Analyze ${stats.total} Applicants`}
      </Button>
    </div>
  );
}
