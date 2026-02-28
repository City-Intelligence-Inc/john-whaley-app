"use client";

import { useState } from "react";
import { X, Plus } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { api, type PromptSettings } from "@/lib/api";

interface ReviewPromptEditorProps {
  settings: PromptSettings;
  onSave: () => void;
}

export function ReviewPromptEditor({ settings, onSave }: ReviewPromptEditorProps) {
  const [prompt, setPrompt] = useState(settings.default_prompt);
  const [criteria, setCriteria] = useState<string[]>(settings.criteria);
  const [newCriterion, setNewCriterion] = useState("");
  const [saving, setSaving] = useState(false);

  const addCriterion = () => {
    const value = newCriterion.trim();
    if (value && !criteria.includes(value)) {
      setCriteria([...criteria, value]);
      setNewCriterion("");
    }
  };

  const removeCriterion = (c: string) => {
    setCriteria(criteria.filter((x) => x !== c));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updatePromptSettings({ default_prompt: prompt, criteria });
      toast.success("Prompt settings saved");
      onSave();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Prompt</CardTitle>
        <CardDescription>
          Customize the prompt used when running AI reviews on applicants
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="prompt">Default Prompt</Label>
          <Textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            placeholder="Enter the prompt for AI reviews..."
          />
        </div>

        <div className="space-y-2">
          <Label>Evaluation Criteria</Label>
          <div className="flex gap-2">
            <Input
              value={newCriterion}
              onChange={(e) => setNewCriterion(e.target.value)}
              placeholder="Add a criterion..."
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
          <div className="flex flex-wrap gap-2 mt-2">
            {criteria.map((c) => (
              <Badge key={c} variant="secondary" className="gap-1">
                {c}
                <button onClick={() => removeCriterion(c)} className="ml-1 hover:text-destructive">
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save Prompt Settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
