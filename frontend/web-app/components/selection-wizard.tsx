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
import { ChevronLeft, ChevronRight, Plus, Sparkles, X, Users, User } from "lucide-react";
import type { SelectionPreferences, PanelConfig } from "@/lib/api";
import { DEFAULT_PANEL_CONFIG } from "@/lib/api";
import { JUDGE_PERSONAS } from "@/lib/judge-personas";

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

const PANEL_SIZES = [3, 6, 9, 12] as const;

interface SelectionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: SelectionPreferences;
  panelConfig?: PanelConfig;
  onSave: (prefs: SelectionPreferences, panelConfig?: PanelConfig) => void;
}

export function SelectionWizard({
  open,
  onOpenChange,
  preferences,
  panelConfig: initialPanelConfig,
  onSave,
}: SelectionWizardProps) {
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState<SelectionPreferences>({ ...preferences });
  const [noLimit, setNoLimit] = useState(preferences.venue_capacity === null);
  const [newCategory, setNewCategory] = useState("");
  const [panel, setPanel] = useState<PanelConfig>(initialPanelConfig || { ...DEFAULT_PANEL_CONFIG });

  const isPanelMode = panel.enabled;

  // Map logical step to content step
  // Panel mode:   0=ReviewMode, 1=JudgeSelection, 2=Capacity, 3=Mix, 4=AutoAccept, 5=Relevance, 6=Priorities
  // Single mode:  0=Capacity, 1=Mix, 2=AutoAccept, 3=Relevance, 4=Priorities
  // We use a "content step" approach: the step index directly maps to content
  const getStepContent = () => {
    if (isPanelMode) {
      if (step === 0) return "review_mode";
      if (step === 1) return "judge_selection";
      if (step === 2) return "capacity";
      if (step === 3) return "mix";
      if (step === 4) return "auto_accept";
      if (step === 5) return "relevance";
      if (step === 6) return "priorities";
    } else {
      // Step 0 is always review mode (so user can switch back)
      if (step === 0) return "review_mode";
      if (step === 1) return "capacity";
      if (step === 2) return "mix";
      if (step === 3) return "auto_accept";
      if (step === 4) return "relevance";
      if (step === 5) return "priorities";
    }
    return "review_mode";
  };

  // Recalc total steps when panel mode changes
  const adjustedTotalSteps = isPanelMode ? 7 : 6;

  // Combine built-in types with custom categories
  const allTypes = [
    ...ATTENDEE_TYPES,
    ...(prefs.custom_categories || []).map((c) => ({ key: c, label: c })),
  ];

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setStep(0);
      setPrefs({ ...preferences });
      setNoLimit(preferences.venue_capacity === null);
      setNewCategory("");
      setPanel(initialPanelConfig || { ...DEFAULT_PANEL_CONFIG });
    }
    onOpenChange(isOpen);
  };

  const addCategory = () => {
    const value = newCategory.trim();
    if (!value) return;
    const existing = allTypes.some((t) => t.key.toLowerCase() === value.toLowerCase());
    if (existing) return;
    setPrefs((p) => ({
      ...p,
      custom_categories: [...(p.custom_categories || []), value],
    }));
    setNewCategory("");
  };

  const removeCategory = (key: string) => {
    setPrefs((p) => {
      const { [key]: _, ...restMix } = p.attendee_mix;
      return {
        ...p,
        custom_categories: (p.custom_categories || []).filter((c) => c !== key),
        attendee_mix: restMix,
        auto_accept_types: p.auto_accept_types.filter((t) => t !== key),
      };
    });
  };

  const handleSave = () => {
    onSave(prefs, panel.enabled ? panel : undefined);
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

  const toggleJudge = (judgeId: string) => {
    setPanel((p) => {
      const isSelected = p.judge_ids.includes(judgeId);
      if (isSelected) {
        return { ...p, judge_ids: p.judge_ids.filter((id) => id !== judgeId) };
      }
      if (p.judge_ids.length >= p.panel_size) return p;
      return { ...p, judge_ids: [...p.judge_ids, judgeId] };
    });
  };

  const content = getStepContent();

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
          {Array.from({ length: adjustedTotalSteps }, (_, i) => (
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
            {step + 1} / {adjustedTotalSteps}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 pr-1">
          {/* Review Mode Selection */}
          {content === "review_mode" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-1">Review Mode</h3>
                <p className="text-sm text-muted-foreground">
                  Choose how applicants will be evaluated.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPanel((p) => ({ ...p, enabled: false }))}
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                    !isPanelMode ? "border-primary bg-primary/5" : "border-muted hover:bg-muted/50"
                  }`}
                >
                  <User className="size-8 text-muted-foreground" />
                  <span className="text-sm font-medium">Single Reviewer</span>
                  <span className="text-xs text-muted-foreground text-center">
                    One AI reviews all applicants
                  </span>
                </button>
                <button
                  onClick={() => setPanel((p) => ({ ...p, enabled: true }))}
                  className={`flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors ${
                    isPanelMode ? "border-primary bg-primary/5" : "border-muted hover:bg-muted/50"
                  }`}
                >
                  <Users className="size-8 text-muted-foreground" />
                  <span className="text-sm font-medium">Judge Panel</span>
                  <span className="text-xs text-muted-foreground text-center">
                    Multiple AI judges with unique biases
                  </span>
                </button>
              </div>

              {isPanelMode && (
                <>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Panel Size</Label>
                      <div className="grid grid-cols-4 gap-2 mt-1.5">
                        {PANEL_SIZES.map((size) => (
                          <button
                            key={size}
                            onClick={() => setPanel((p) => ({
                              ...p,
                              panel_size: size,
                              judge_ids: p.judge_ids.slice(0, size),
                            }))}
                            className={`rounded-lg border-2 py-2 text-center font-medium transition-colors ${
                              panel.panel_size === size
                                ? "border-primary bg-primary/5"
                                : "border-muted hover:bg-muted/50"
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Adjudication Mode</Label>
                      <RadioGroup
                        value={panel.adjudication_mode}
                        onValueChange={(v) => setPanel((p) => ({ ...p, adjudication_mode: v as "union" | "majority" }))}
                        className="mt-1.5"
                      >
                        <label className="flex items-start gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
                          <RadioGroupItem value="union" className="mt-0.5" />
                          <div>
                            <div className="text-sm font-medium">Union (any judge)</div>
                            <div className="text-xs text-muted-foreground">If ANY judge accepts, the applicant is accepted. More inclusive.</div>
                          </div>
                        </label>
                        <label className="flex items-start gap-3 rounded-md border px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors">
                          <RadioGroupItem value="majority" className="mt-0.5" />
                          <div>
                            <div className="text-sm font-medium">Majority (&gt;50%)</div>
                            <div className="text-xs text-muted-foreground">More than half the judges must accept. More selective.</div>
                          </div>
                        </label>
                      </RadioGroup>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-3">
                    <h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">How the Judge Panel Works</h4>
                    <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                      <li>All applicants are classified by type (same as single mode)</li>
                      <li>Each judge gets seats based on your venue capacity &amp; attendee mix</li>
                      <li>Each judge independently scores ALL applicants through their unique lens, then fills their seats with top picks</li>
                      <li>Final decision: {panel.adjudication_mode === "union" ? "any judge accepts = accepted" : ">50% of judges must accept"}, otherwise waitlisted</li>
                    </ol>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Judge Selection (panel only) */}
          {content === "judge_selection" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-1">Select Your Judges</h3>
                <p className="text-sm text-muted-foreground">
                  Pick {panel.panel_size} judges for your panel. Each brings a unique perspective.
                </p>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium tabular-nums">
                  {panel.judge_ids.length}/{panel.panel_size} selected
                </span>
                {panel.judge_ids.length === panel.panel_size && (
                  <span className="text-xs text-green-600 font-medium">Panel complete</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {JUDGE_PERSONAS.map((persona) => {
                  const isSelected = panel.judge_ids.includes(persona.id);
                  const isFull = panel.judge_ids.length >= panel.panel_size;
                  const isDisabled = !isSelected && isFull;
                  return (
                    <button
                      key={persona.id}
                      onClick={() => toggleJudge(persona.id)}
                      disabled={isDisabled}
                      className={`flex flex-col items-start gap-1 rounded-lg border-2 p-2.5 text-left transition-all ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : isDisabled
                            ? "border-muted opacity-40 cursor-not-allowed"
                            : "border-muted hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg">{persona.emoji}</span>
                        <span className="text-xs font-medium leading-tight">{persona.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
                        {persona.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Venue Capacity */}
          {content === "capacity" && (
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

          {/* Attendee Mix */}
          {content === "mix" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-1">Target Attendee Mix</h3>
                <p className="text-sm text-muted-foreground">
                  Set soft target percentages for each attendee type. These guide the AI but aren&apos;t strict quotas.
                </p>
              </div>
              <div className="space-y-3">
                {allTypes.map((t) => {
                  const value = prefs.attendee_mix[t.key] ?? 0;
                  const isCustom = (prefs.custom_categories || []).includes(t.key);
                  return (
                    <div key={t.key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-sm">{t.label}</Label>
                          {isCustom && (
                            <button
                              onClick={() => removeCategory(t.key)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <X className="size-3.5" />
                            </button>
                          )}
                        </div>
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
              <div className="flex gap-2">
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="Add a category..."
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCategory();
                    }
                  }}
                />
                <Button variant="outline" size="icon" onClick={addCategory} className="h-8 w-8 shrink-0">
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Auto-Accept Rules */}
          {content === "auto_accept" && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold mb-1">Auto-Accept Rules</h3>
                <p className="text-sm text-muted-foreground">
                  Select which attendee types should be automatically accepted (score 100, skip AI scoring).
                  Stanford affiliates are checked by default.
                </p>
              </div>
              <div className="space-y-2">
                {allTypes.map((t) => (
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

          {/* AI Relevance Filter */}
          {content === "relevance" && (
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

          {/* Custom Priorities */}
          {content === "priorities" && (
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
            {step < adjustedTotalSteps - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                size="sm"
                disabled={
                  isPanelMode && step === 1 && panel.judge_ids.length !== panel.panel_size
                }
              >
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
