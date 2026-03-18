"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Save, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";

export default function SettingsPage() {
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [newWhitelist, setNewWhitelist] = useState("");
  const [newBlacklist, setNewBlacklist] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [criteria, setCriteria] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const [wl, bl, prompts] = await Promise.all([
          api.getWhitelist(),
          api.getBlacklist(),
          api.getPromptSettings(),
        ]);
        setWhitelist(wl.emails || []);
        setBlacklist(bl.emails || []);
        setPrompt(prompts.default_prompt || "");
        setCriteria((prompts.criteria || []).join("\n"));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSavePrompt = useCallback(async () => {
    setSaving(true);
    try {
      await api.updatePromptSettings({
        default_prompt: prompt,
        criteria: criteria.split("\n").filter(Boolean),
      });
      toast.success("Prompt settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [prompt, criteria]);

  const addToList = async (type: "whitelist" | "blacklist") => {
    const value = type === "whitelist" ? newWhitelist.trim() : newBlacklist.trim();
    if (!value) return;
    const current = type === "whitelist" ? whitelist : blacklist;
    const updated = [...new Set([...current, value.toLowerCase()])];
    try {
      if (type === "whitelist") {
        await api.updateWhitelist(updated);
        setWhitelist(updated);
        setNewWhitelist("");
      } else {
        await api.updateBlacklist(updated);
        setBlacklist(updated);
        setNewBlacklist("");
      }
      toast.success(`Added to ${type}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  const removeFromList = async (type: "whitelist" | "blacklist", email: string) => {
    const current = type === "whitelist" ? whitelist : blacklist;
    const updated = current.filter((e) => e !== email);
    try {
      if (type === "whitelist") {
        await api.updateWhitelist(updated);
        setWhitelist(updated);
      } else {
        await api.updateBlacklist(updated);
        setBlacklist(updated);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Global configuration for Selecta.</p>
      </div>

      {/* Prompt */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">AI Prompt</CardTitle>
          <CardDescription>Default prompt used when analyzing guests.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Prompt</Label>
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} />
          </div>
          <div className="space-y-2">
            <Label>Criteria (one per line)</Label>
            <Textarea value={criteria} onChange={(e) => setCriteria(e.target.value)} rows={3} />
          </div>
          <Button onClick={handleSavePrompt} disabled={saving}>
            {saving ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Save className="size-4 mr-2" />}
            Save
          </Button>
        </CardContent>
      </Card>

      {/* Whitelist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Whitelist</CardTitle>
          <CardDescription>These emails are auto-accepted across all events.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={newWhitelist} onChange={(e) => setNewWhitelist(e.target.value)}
              placeholder="email@example.com" onKeyDown={(e) => e.key === "Enter" && addToList("whitelist")} />
            <Button size="sm" variant="outline" onClick={() => addToList("whitelist")}>
              <Plus className="size-4" />
            </Button>
          </div>
          {whitelist.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {whitelist.map((email) => (
                <span key={email} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                  {email}
                  <button onClick={() => removeFromList("whitelist", email)} className="hover:text-emerald-900"><X className="size-3" /></button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Blacklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Blacklist</CardTitle>
          <CardDescription>These emails are auto-rejected across all events.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={newBlacklist} onChange={(e) => setNewBlacklist(e.target.value)}
              placeholder="email@example.com" onKeyDown={(e) => e.key === "Enter" && addToList("blacklist")} />
            <Button size="sm" variant="outline" onClick={() => addToList("blacklist")}>
              <Plus className="size-4" />
            </Button>
          </div>
          {blacklist.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {blacklist.map((email) => (
                <span key={email} className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
                  {email}
                  <button onClick={() => removeFromList("blacklist", email)} className="hover:text-red-900"><X className="size-3" /></button>
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
