"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const providers = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
];

const models: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
    { value: "claude-haiku-4-20250506", label: "Claude Haiku 4" },
  ],
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
  ],
};

export function AIConfig() {
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("claude-sonnet-4-20250514");

  useEffect(() => {
    setApiKey(localStorage.getItem("ai_api_key") || "");
    setProvider(localStorage.getItem("ai_provider") || "anthropic");
    setModel(localStorage.getItem("ai_model") || "claude-sonnet-4-20250514");
  }, []);

  const handleSave = () => {
    localStorage.setItem("ai_api_key", apiKey);
    localStorage.setItem("ai_provider", provider);
    localStorage.setItem("ai_model", model);
    toast.success("AI configuration saved");
  };

  const handleProviderChange = (value: string) => {
    setProvider(value);
    const firstModel = models[value]?.[0]?.value;
    if (firstModel) setModel(firstModel);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Configuration</CardTitle>
        <CardDescription>
          Configure your AI provider and API key. Keys are stored locally in your browser only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="api-key">API Key</Label>
          <Input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your API key..."
          />
          <p className="text-xs text-muted-foreground">
            Your key is stored in localStorage and never sent to our servers
          </p>
        </div>

        <div className="space-y-2">
          <Label>Provider</Label>
          <Select value={provider} onValueChange={handleProviderChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Model</Label>
          <Select value={model} onValueChange={setModel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(models[provider] || []).map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave} className="w-full">
          Save Configuration
        </Button>
      </CardContent>
    </Card>
  );
}
