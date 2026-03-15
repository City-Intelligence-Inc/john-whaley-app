"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Save,
  Loader2,
  Plus,
  X,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import type { PromptSettings } from "@/lib/api";
import { JUDGE_PERSONAS } from "@/lib/judge-personas";
import type { JudgePersona } from "@/lib/judge-personas";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PersonaFromAPI {
  id: string;
  name: string;
  emoji: string;
  specialty: string;
  description: string;
  preferred_types: string[];
  bias?: string;
  scoring_modifiers?: string;
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function GlobalSettingsPage() {
  /* ---- Prompt & Criteria state ---- */
  const [promptSettings, setPromptSettings] = useState<PromptSettings>({
    default_prompt: "",
    criteria: [],
  });
  const [newCriterion, setNewCriterion] = useState("");
  const [loadingPrompt, setLoadingPrompt] = useState(true);
  const [savingPrompt, setSavingPrompt] = useState(false);

  /* ---- Judge Personas state ---- */
  const [personas, setPersonas] = useState<PersonaFromAPI[]>([]);
  const [loadingPersonas, setLoadingPersonas] = useState(true);
  const [editingPersona, setEditingPersona] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState("");
  const [savingPersona, setSavingPersona] = useState(false);
  const [deletingPersona, setDeletingPersona] = useState<string | null>(null);

  // New custom persona
  const [showNewPersona, setShowNewPersona] = useState(false);
  const [newPersona, setNewPersona] = useState({
    name: "",
    emoji: "",
    specialty: "",
    description: "",
  });
  const [creatingPersona, setCreatingPersona] = useState(false);

  /* ---- Global Whitelist / Blacklist state ---- */
  const [wlEmails, setWlEmails] = useState("");
  const [blEmails, setBlEmails] = useState("");
  const [loadingLists, setLoadingLists] = useState(true);
  const [savingWl, setSavingWl] = useState(false);
  const [savingBl, setSavingBl] = useState(false);

  /* ---------------------------------------------------------------- */
  /*  Load data                                                        */
  /* ---------------------------------------------------------------- */

  const loadPromptSettings = useCallback(async () => {
    setLoadingPrompt(true);
    try {
      const data = await api.getPromptSettings();
      setPromptSettings(data);
    } catch {
      toast.error("Failed to load prompt settings");
    } finally {
      setLoadingPrompt(false);
    }
  }, []);

  const loadPersonas = useCallback(async () => {
    setLoadingPersonas(true);
    try {
      const data = await api.getPersonas();
      setPersonas(data);
    } catch {
      // Fall back to built-in personas
      setPersonas(
        JUDGE_PERSONAS.map((p) => ({
          id: p.id,
          name: p.name,
          emoji: p.emoji,
          specialty: p.specialty,
          description: p.description,
          preferred_types: [...p.preferred_types],
        }))
      );
    } finally {
      setLoadingPersonas(false);
    }
  }, []);

  const loadLists = useCallback(async () => {
    setLoadingLists(true);
    try {
      const [wl, bl] = await Promise.all([
        api.getWhitelist(),
        api.getBlacklist(),
      ]);
      setWlEmails((wl.emails ?? []).join("\n"));
      setBlEmails((bl.emails ?? []).join("\n"));
    } catch {
      toast.error("Failed to load whitelist/blacklist");
    } finally {
      setLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    loadPromptSettings();
    loadPersonas();
    loadLists();
  }, [loadPromptSettings, loadPersonas, loadLists]);

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                          */
  /* ---------------------------------------------------------------- */

  function linesToArray(text: string): string[] {
    return text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  const builtInIds = new Set(JUDGE_PERSONAS.map((p) => p.id));

  /* ---------------------------------------------------------------- */
  /*  Save handlers                                                    */
  /* ---------------------------------------------------------------- */

  const savePrompt = async () => {
    setSavingPrompt(true);
    try {
      await api.updatePromptSettings(promptSettings);
      toast.success("Prompt settings saved");
    } catch {
      toast.error("Failed to save prompt settings");
    } finally {
      setSavingPrompt(false);
    }
  };

  const addCriterion = () => {
    const val = newCriterion.trim();
    if (!val) return;
    if (promptSettings.criteria.includes(val)) {
      toast.error("Criterion already exists");
      return;
    }
    setPromptSettings({
      ...promptSettings,
      criteria: [...promptSettings.criteria, val],
    });
    setNewCriterion("");
  };

  const removeCriterion = (idx: number) => {
    setPromptSettings({
      ...promptSettings,
      criteria: promptSettings.criteria.filter((_, i) => i !== idx),
    });
  };

  const startEditPersona = (p: PersonaFromAPI) => {
    setEditingPersona(p.id);
    setEditDescription(p.description);
  };

  const savePersonaDescription = async () => {
    if (!editingPersona) return;
    setSavingPersona(true);
    try {
      await api.updatePersona(editingPersona, {
        description: editDescription,
      });
      setPersonas((prev) =>
        prev.map((p) =>
          p.id === editingPersona
            ? { ...p, description: editDescription }
            : p
        )
      );
      setEditingPersona(null);
      toast.success("Persona updated");
    } catch {
      toast.error("Failed to update persona");
    } finally {
      setSavingPersona(false);
    }
  };

  const deletePersona = async (id: string) => {
    setDeletingPersona(id);
    try {
      await api.deletePersona(id);
      setPersonas((prev) => prev.filter((p) => p.id !== id));
      toast.success("Persona deleted");
    } catch {
      toast.error("Failed to delete persona");
    } finally {
      setDeletingPersona(null);
    }
  };

  const createPersona = async () => {
    if (!newPersona.name.trim() || !newPersona.specialty.trim()) {
      toast.error("Name and specialty are required");
      return;
    }
    setCreatingPersona(true);
    try {
      const id = `custom_${Date.now()}`;
      await api.updatePersona(id, {
        id,
        name: newPersona.name.trim(),
        emoji: newPersona.emoji.trim() || "⚡",
        specialty: newPersona.specialty.trim(),
        description: newPersona.description.trim(),
        preferred_types: [],
      });
      await loadPersonas();
      setShowNewPersona(false);
      setNewPersona({ name: "", emoji: "", specialty: "", description: "" });
      toast.success("Custom persona created");
    } catch {
      toast.error("Failed to create persona");
    } finally {
      setCreatingPersona(false);
    }
  };

  const saveWhitelist = async () => {
    setSavingWl(true);
    try {
      await api.updateWhitelist(linesToArray(wlEmails));
      toast.success("Global whitelist saved");
    } catch {
      toast.error("Failed to save whitelist");
    } finally {
      setSavingWl(false);
    }
  };

  const saveBlacklist = async () => {
    setSavingBl(true);
    try {
      await api.updateBlacklist(linesToArray(blEmails));
      toast.success("Global blacklist saved");
    } catch {
      toast.error("Failed to save blacklist");
    } finally {
      setSavingBl(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="space-y-10">
      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Global configuration for prompts, judge personas, and
          whitelist/blacklist rules.
        </p>
      </div>

      {/* ================================================================ */}
      {/*  SECTION 1 — Default Prompt & Criteria                           */}
      {/* ================================================================ */}

      <section>
        <div className="flex items-center gap-2 mb-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gold/10">
            <Sparkles className="size-4 text-gold" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Default Prompt & Criteria
            </h2>
            <p className="text-xs text-muted-foreground">
              Set the default review prompt and scoring criteria used by the AI.
            </p>
          </div>
        </div>

        {loadingPrompt ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-gold" />
          </div>
        ) : (
          <Card className="border-border/50 bg-card/50">
            <CardContent className="pt-6 space-y-6">
              {/* Default prompt */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-foreground">
                  Default Review Prompt
                </Label>
                <p className="text-xs text-muted-foreground">
                  This prompt is sent to the AI when reviewing each applicant.
                </p>
                <Textarea
                  placeholder="You are evaluating applicants for an AI-focused event..."
                  value={promptSettings.default_prompt}
                  onChange={(e) =>
                    setPromptSettings({
                      ...promptSettings,
                      default_prompt: e.target.value,
                    })
                  }
                  rows={6}
                  className="bg-background border-border/50 focus-visible:ring-gold/40 text-sm resize-y"
                />
              </div>

              <Separator />

              {/* Criteria list */}
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-foreground">
                    Scoring Criteria
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Individual criteria the AI uses when scoring applicants.
                  </p>
                </div>

                {promptSettings.criteria.length > 0 && (
                  <div className="space-y-1.5">
                    {promptSettings.criteria.map((criterion, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/40 bg-background/40 group"
                      >
                        <span className="text-sm text-foreground flex-1">
                          {criterion}
                        </span>
                        <button
                          onClick={() => removeCriterion(idx)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Add a criterion..."
                    value={newCriterion}
                    onChange={(e) => setNewCriterion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCriterion();
                      }
                    }}
                    className="bg-background border-border/50 focus-visible:ring-gold/40 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addCriterion}
                    disabled={!newCriterion.trim()}
                    className="border-border/50 hover:border-gold/30 hover:bg-gold/5 shrink-0"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <Button
                  onClick={savePrompt}
                  disabled={savingPrompt}
                  className="bg-gold hover:bg-gold/90 text-gold-foreground"
                >
                  {savingPrompt ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="size-4 mr-2" />
                  )}
                  Save Prompt Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      {/* ================================================================ */}
      {/*  SECTION 2 — Judge Personas                                      */}
      {/* ================================================================ */}

      <section>
        <div className="flex items-center gap-2 mb-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gold/10">
            <Sparkles className="size-4 text-gold" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Judge Personas
            </h2>
            <p className="text-xs text-muted-foreground">
              AI judges each bring a different perspective when scoring
              applicants.
            </p>
          </div>
        </div>

        {loadingPersonas ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-gold" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {personas.map((persona) => {
                const isBuiltIn = builtInIds.has(persona.id);
                const isEditing = editingPersona === persona.id;

                return (
                  <Card
                    key={persona.id}
                    className={`border-border/50 bg-card/50 transition-all ${
                      isEditing
                        ? "ring-1 ring-gold/30 border-gold/20"
                        : "hover:border-border"
                    }`}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl leading-none">
                            {persona.emoji}
                          </span>
                          <div>
                            <CardTitle className="text-sm font-semibold text-foreground leading-snug">
                              {persona.name}
                            </CardTitle>
                            <CardDescription className="text-[11px] mt-0.5">
                              {persona.specialty}
                            </CardDescription>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          {/* Edit button */}
                          <button
                            onClick={() =>
                              isEditing
                                ? setEditingPersona(null)
                                : startEditPersona(persona)
                            }
                            className="p-1 rounded hover:bg-gold/10 text-muted-foreground hover:text-gold transition-colors"
                          >
                            <Pencil className="size-3.5" />
                          </button>

                          {/* Delete button (custom only) */}
                          {!isBuiltIn && (
                            <button
                              onClick={() => deletePersona(persona.id)}
                              disabled={deletingPersona === persona.id}
                              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                            >
                              {deletingPersona === persona.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="size-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="pt-0">
                      {isEditing ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editDescription}
                            onChange={(e) =>
                              setEditDescription(e.target.value)
                            }
                            rows={4}
                            className="bg-background border-border/50 focus-visible:ring-gold/40 text-xs resize-y"
                          />
                          <div className="flex items-center gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingPersona(null)}
                              className="border-border/50 text-xs h-7"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={savePersonaDescription}
                              disabled={savingPersona}
                              className="bg-gold hover:bg-gold/90 text-gold-foreground text-xs h-7"
                            >
                              {savingPersona && (
                                <Loader2 className="size-3 mr-1 animate-spin" />
                              )}
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {persona.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              {/* ── Add Custom Persona card ── */}
              {!showNewPersona ? (
                <button
                  onClick={() => setShowNewPersona(true)}
                  className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/50 bg-card/30 p-6 hover:border-gold/30 hover:bg-gold/5 transition-all cursor-pointer min-h-[180px]"
                >
                  <div className="flex size-10 items-center justify-center rounded-xl bg-gold/10">
                    <Plus className="size-5 text-gold" />
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">
                    Create Custom Persona
                  </span>
                </button>
              ) : (
                <Card className="border-gold/20 bg-gold/[0.02]">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-foreground">
                      New Custom Persona
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Emoji"
                        value={newPersona.emoji}
                        onChange={(e) =>
                          setNewPersona({
                            ...newPersona,
                            emoji: e.target.value,
                          })
                        }
                        className="w-16 bg-background border-border/50 focus-visible:ring-gold/40 text-center text-lg"
                        maxLength={4}
                      />
                      <Input
                        placeholder="Name"
                        value={newPersona.name}
                        onChange={(e) =>
                          setNewPersona({
                            ...newPersona,
                            name: e.target.value,
                          })
                        }
                        className="flex-1 bg-background border-border/50 focus-visible:ring-gold/40 text-sm"
                      />
                    </div>
                    <Input
                      placeholder="Specialty (e.g. 'Ethics & governance')"
                      value={newPersona.specialty}
                      onChange={(e) =>
                        setNewPersona({
                          ...newPersona,
                          specialty: e.target.value,
                        })
                      }
                      className="bg-background border-border/50 focus-visible:ring-gold/40 text-sm"
                    />
                    <Textarea
                      placeholder="Description — what this judge boosts/penalizes..."
                      value={newPersona.description}
                      onChange={(e) =>
                        setNewPersona({
                          ...newPersona,
                          description: e.target.value,
                        })
                      }
                      rows={3}
                      className="bg-background border-border/50 focus-visible:ring-gold/40 text-xs resize-y"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowNewPersona(false);
                          setNewPersona({
                            name: "",
                            emoji: "",
                            specialty: "",
                            description: "",
                          });
                        }}
                        className="border-border/50 text-xs h-7"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={createPersona}
                        disabled={
                          creatingPersona ||
                          !newPersona.name.trim() ||
                          !newPersona.specialty.trim()
                        }
                        className="bg-gold hover:bg-gold/90 text-gold-foreground text-xs h-7"
                      >
                        {creatingPersona && (
                          <Loader2 className="size-3 mr-1 animate-spin" />
                        )}
                        Create
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ================================================================ */}
      {/*  SECTION 3 — Global Whitelist & Blacklist                        */}
      {/* ================================================================ */}

      <section>
        <div className="flex items-center gap-2 mb-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gold/10">
            <ShieldCheck className="size-4 text-gold" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Global Whitelist & Blacklist
            </h2>
            <p className="text-xs text-muted-foreground">
              These apply to all events. Per-event lists can be configured in
              each event's settings.
            </p>
          </div>
        </div>

        {loadingLists ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-gold" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ── Global Whitelist Card ── */}
            <Card className="border-emerald-500/20 bg-emerald-500/[0.03]">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-emerald-500/15">
                    <ShieldCheck className="size-4 text-emerald-400" />
                  </div>
                  <div>
                    <CardTitle className="text-[15px] text-foreground">
                      Global Whitelist
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Always accept these emails across all events
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Emails (one per line)
                  </Label>
                  <Textarea
                    placeholder={"vip@example.com\npartner@company.co"}
                    value={wlEmails}
                    onChange={(e) => setWlEmails(e.target.value)}
                    rows={6}
                    className="bg-background/60 border-border/50 focus-visible:ring-emerald-500/40 font-mono text-xs resize-y"
                  />
                </div>

                <Button
                  onClick={saveWhitelist}
                  disabled={savingWl}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {savingWl ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="size-4 mr-2" />
                  )}
                  Save Whitelist
                </Button>
              </CardContent>
            </Card>

            {/* ── Global Blacklist Card ── */}
            <Card className="border-red-500/20 bg-red-500/[0.03]">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-md bg-red-500/15">
                    <ShieldAlert className="size-4 text-red-400" />
                  </div>
                  <div>
                    <CardTitle className="text-[15px] text-foreground">
                      Global Blacklist
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Always reject these emails across all events
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Emails (one per line)
                  </Label>
                  <Textarea
                    placeholder={"spam@example.com\nbanned@domain.net"}
                    value={blEmails}
                    onChange={(e) => setBlEmails(e.target.value)}
                    rows={6}
                    className="bg-background/60 border-border/50 focus-visible:ring-red-500/40 font-mono text-xs resize-y"
                  />
                </div>

                <Button
                  onClick={saveBlacklist}
                  disabled={savingBl}
                  variant="destructive"
                  className="w-full"
                >
                  {savingBl ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="size-4 mr-2" />
                  )}
                  Save Blacklist
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </section>
    </div>
  );
}
