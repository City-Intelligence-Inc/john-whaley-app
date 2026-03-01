"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import type { SelectionPreferences } from "@/lib/api";

const ATTENDEE_TYPES = [
  { key: "vc", label: "VCs / Investors" },
  { key: "entrepreneur", label: "Founders / Entrepreneurs" },
  { key: "faculty", label: "Faculty / Researchers" },
  { key: "alumni", label: "Stanford Alumni" },
  { key: "press", label: "Press / Media" },
  { key: "student", label: "Students" },
  { key: "other", label: "Other (Industry)" },
];

const RELEVANCE_OPTIONS = [
  {
    value: "strict",
    label: "Strict",
    description: "Only accept applicants with direct, clear relevance to AI/LLM.",
  },
  {
    value: "moderate",
    label: "Moderate",
    description: "Accept applicants with reasonable relevance. Some tangential connections OK.",
  },
  {
    value: "loose",
    label: "Loose",
    description: "Accept most applicants who show any interest or connection.",
  },
  {
    value: "none",
    label: "None",
    description: "Do not filter by relevance. Score purely on other factors.",
  },
];

const TOTAL_STEPS = 5;

interface SelectionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: SelectionPreferences;
  onSave: (prefs: SelectionPreferences) => void;
}

export function SelectionWizard({
  open,
  onOpenChange,
  preferences,
  onSave,
}: SelectionWizardProps) {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<SelectionPreferences>({ ...preferences });
  const [noLimit, setNoLimit] = useState(preferences.venue_capacity === null);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setStep(0);
      setPrefs({ ...preferences });
      setNoLimit(preferences.venue_capacity === null);
    }
    onOpenChange(isOpen);
  };

  const handleSave = () => {
    onSave(prefs);
    onOpenChange(false);
  };

  const updateMix = (key: string, value: number) => {
    setPrefs((p) => ({
      ...p,
      attendee_mix: { ...p.attendee_mix, [key]: value },
    }));
  };

  const toggleAutoAccept = (key: string) => {
    setPrefs((p) => ({
      ...p,
      auto_accept_types: p.auto_accept_types.includes(key)
        ? p.auto_accept_types.filter((t) => t !== key)
        : [...p.auto_accept_types, key],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Selection Criteria
          </DialogTitle>
          <DialogDescription>
            Configure how the AI should evaluate and select applicants.
          </DialogDescription>
        </DialogHeader>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 py-1">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`size-2.5 rounded-full transition-colors ${
                i === step
                  ? "bg-primary"
                  : i < step
                    ? "bg-primary/40"
                    : "bg-muted-foreground/20"
              }`}
            />
          ))}
          <span className="text-xs text-muted-foreground ml-2">
            {step + 1} / {TOTAL_STEPS}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          {/* Step 1: Venue Capacity */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-1">Venue Capacity</h3>
                <p className="text-sm text-muted-foreground">
                  How many attendees can your venue hold? This helps the AI be more selective when needed.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={noLimit}
                  onCheckedChange={(checked) => {
                    setNoLimit(checked);
                    if (checked) {
                      setPrefs((p) => ({ ...p, venue_capacity: null }));
                    } else {
                      setPrefs((p) => ({ ...p, venue_capacity: 200 }));
                    }
                  }}
                />
                <Label className="text-sm">No limit</Label>
              </div>
              {!noLimit && (
                <div className="space-y-2">
                  <Label className="text-sm">Maximum attendees</Label>
                  <Input
                    type="number"
                    min={1}
                    value={prefs.venue_capacity ?? ""}
                    onChange={(e) =>
                      setPrefs((p) => ({
                        ...p,
                        venue_capacity: e.target.value ? parseInt(e.target.value) : null,
                      }))
                    }
                    placeholder="e.g. 200"
                    className="h-10 w-40"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Attendee Mix */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-1">Target Attendee Mix</h3>
                <p className="text-sm text-muted-foreground">
                  Set soft target percentages for each attendee type. These guide the AI but aren&apos;t strict quotas.
                </p>
              </div>
              <div className="space-y-3">
                {ATTENDEE_TYPES.map((t) => {
                  const value = prefs.attendee_mix[t.key] ?? 0;
                  return (
                    <div key={t.key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">{t.label}</Label>
                        <span className="text-sm font-mono tabular-nums text-muted-foreground w-10 text-right">
                          {value}%
                        </span>
                      </div>
                      <Slider
                        value={[value]}
                        min={0}
                        max={50}
                        step={5}
                        onValueChange={([v]) => updateMix(t.key, v)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 3: Auto-Accept Rules */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-1">Auto-Accept Rules</h3>
                <p className="text-sm text-muted-foreground">
                  Select which attendee types should be automatically accepted (score 100, skip AI scoring).
                  Stanford affiliates are checked by default.
                </p>
              </div>
              <div className="space-y-2">
                {ATTENDEE_TYPES.map((t) => (
                  <label
                    key={t.key}
                    className="flex items-center gap-3 rounded-md border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={prefs.auto_accept_types.includes(t.key)}
                      onCheckedChange={() => toggleAutoAccept(t.key)}
                    />
                    <span className="text-sm">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: AI Relevance Filter */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-1">AI Relevance Filter</h3>
                <p className="text-sm text-muted-foreground">
                  How strictly should the AI filter applicants by relevance to your event?
                </p>
              </div>
              <RadioGroup
                value={prefs.relevance_filter}
                onValueChange={(v) => setPrefs((p) => ({ ...p, relevance_filter: v }))}
              >
                {RELEVANCE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-start gap-3 rounded-md border px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <RadioGroupItem value={opt.value} className="mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.description}</div>
                    </div>
                  </label>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Step 5: Custom Priorities */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-1">Custom Priorities</h3>
                <p className="text-sm text-muted-foreground">
                  Any additional instructions for the AI? These are added directly to the scoring prompt.
                </p>
              </div>
              <Textarea
                value={prefs.custom_priorities}
                onChange={(e) => setPrefs((p) => ({ ...p, custom_priorities: e.target.value }))}
                rows={5}
                placeholder="e.g. Prioritize people who have built AI products. Prefer attendees from the Bay Area. We need more female representation..."
                className="resize-none text-sm"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-between sm:justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 0}
            size="sm"
          >
            <ChevronLeft className="size-4 mr-1" />
            Back
          </Button>
          <div className="flex gap-2">
            {step < TOTAL_STEPS - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} size="sm">
                Next
                <ChevronRight className="size-4 ml-1" />
              </Button>
            ) : (
              <Button onClick={handleSave} size="sm">
                <Sparkles className="size-4 mr-1.5" />
                Save & Run Analysis
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
