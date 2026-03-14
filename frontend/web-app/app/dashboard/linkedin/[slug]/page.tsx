"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  Users,
  Mail,
  Building2,
  Briefcase,
  GraduationCap,
  Star,
  Award,
  Languages,
  BookOpen,
  FolderOpen,
  Heart,
  Calendar,
  Save,
  Plus,
  X,
  Check,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Profile {
  url: string;
  name?: string;
  email?: string;
  headline?: string;
  photo_url?: string;
  location?: string;
  connections?: string;
  company?: string;
  education?: string;
  about?: string;
  experience?: string;
  skills?: string;
  certifications?: string;
  languages?: string;
  recommendations?: string;
  publications?: string;
  awards?: string;
  courses?: string;
  organizations?: string;
  volunteer?: string;
  projects?: string;
  scraped_at?: string;
  source?: string;
}

interface Judge {
  id: string;
  name: string;
  emoji: string;
  specialty: string;
  description: string;
  bias: string;
  preferred_types: string[];
  scoring_modifiers: string;
}

const SECTIONS: {
  key: keyof Profile;
  label: string;
  icon: typeof Briefcase;
  full?: boolean;
}[] = [
  { key: "about", label: "About", icon: BookOpen, full: true },
  { key: "experience", label: "Experience", icon: Briefcase, full: true },
  { key: "education", label: "Education", icon: GraduationCap, full: true },
  { key: "skills", label: "Skills", icon: Star },
  { key: "certifications", label: "Certifications", icon: Award },
  { key: "languages", label: "Languages", icon: Languages },
  { key: "recommendations", label: "Recommendations", icon: Heart, full: true },
  { key: "publications", label: "Publications", icon: BookOpen, full: true },
  { key: "awards", label: "Awards", icon: Award },
  { key: "courses", label: "Courses", icon: BookOpen },
  { key: "organizations", label: "Organizations", icon: Users },
  { key: "volunteer", label: "Volunteer", icon: Heart },
  { key: "projects", label: "Projects", icon: FolderOpen },
];

function initials(name?: string) {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

// ── Judge Card ──
function JudgeCard({
  judge,
  onEdit,
  onDelete,
  isCustom,
}: {
  judge: Judge;
  onEdit: () => void;
  onDelete?: () => void;
  isCustom: boolean;
}) {
  return (
    <div className="bg-[#1a2236] border border-[#253256] rounded-xl p-4 hover:border-[#488CFF]/30 transition-colors group">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{judge.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white">{judge.name}</h3>
            {isCustom && (
              <span className="text-[9px] bg-[#488CFF]/15 text-[#488CFF] px-1.5 py-0.5 rounded-full">Custom</span>
            )}
          </div>
          <p className="text-[11px] text-[#488CFF] mt-0.5">{judge.specialty}</p>
          <p className="text-xs text-[#7B8DB5] mt-1.5 leading-relaxed line-clamp-2">{judge.description}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {judge.preferred_types.map((t) => (
              <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-[#111827] text-[#5A6B8A] border border-[#253256]">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-[#111827] text-[#5A6B8A] hover:text-[#488CFF]">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {isCustom && onDelete && (
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-[#111827] text-[#5A6B8A] hover:text-red-400">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Judge Editor Modal ──
function JudgeEditor({
  judge,
  onSave,
  onClose,
}: {
  judge: Judge | null; // null = creating new
  onSave: (j: Judge) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Judge>(
    judge || {
      id: "",
      name: "",
      emoji: "",
      specialty: "",
      description: "",
      bias: "",
      preferred_types: [],
      scoring_modifiers: "",
    }
  );
  const [saving, setSaving] = useState(false);

  const isNew = !judge;

  async function handleSave() {
    const id = form.id || form.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    setSaving(true);
    try {
      await fetch(`${API}/settings/personas/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, id }),
      });
      onSave({ ...form, id });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const field = (label: string, key: keyof Judge, multi?: boolean) => (
    <div>
      <label className="block text-[10px] text-[#4A5A7A] uppercase tracking-wider font-semibold mb-1">{label}</label>
      {multi ? (
        <textarea
          value={form[key] as string}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          rows={3}
          className="w-full bg-[#0d1117] border border-[#253256] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#4A5A7A] outline-none focus:border-[#488CFF] resize-y font-mono leading-relaxed"
        />
      ) : (
        <input
          value={form[key] as string}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full bg-[#0d1117] border border-[#253256] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#4A5A7A] outline-none focus:border-[#488CFF]"
        />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto" onClick={onClose}>
      <div className="max-w-xl mx-auto my-10 px-4" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#111827] border border-[#253256] rounded-2xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#253256]">
            <h2 className="text-base font-semibold text-white">
              {isNew ? "Create New Judge" : `Edit: ${judge?.name}`}
            </h2>
            <button onClick={onClose} className="text-[#4A5A7A] hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div className="grid grid-cols-[60px_1fr_1fr] gap-3">
              <div>
                <label className="block text-[10px] text-[#4A5A7A] uppercase tracking-wider font-semibold mb-1">Emoji</label>
                <input
                  value={form.emoji}
                  onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                  className="w-full bg-[#0d1117] border border-[#253256] rounded-lg px-3 py-2 text-xl text-center outline-none focus:border-[#488CFF]"
                />
              </div>
              {field("Name", "name")}
              {field("Specialty", "specialty")}
            </div>

            {field("Description", "description", true)}
            {field("System Prompt / Bias", "bias", true)}
            {field("Scoring Modifiers", "scoring_modifiers", true)}

            <div>
              <label className="block text-[10px] text-[#4A5A7A] uppercase tracking-wider font-semibold mb-1">
                Preferred Types (comma-separated)
              </label>
              <input
                value={form.preferred_types.join(", ")}
                onChange={(e) =>
                  setForm({ ...form, preferred_types: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })
                }
                placeholder="vc, entrepreneur, faculty, student"
                className="w-full bg-[#0d1117] border border-[#253256] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#4A5A7A] outline-none focus:border-[#488CFF]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-[#5A6B8A] border border-[#253256] hover:text-white">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!form.name || saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold bg-[#488CFF] text-white hover:bg-[#3a7ae0] disabled:opacity-40"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isNew ? "Create Judge" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Profile Page ──
export default function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [editingJudge, setEditingJudge] = useState<Judge | null | "new">(null);
  const [builtinIds, setBuiltinIds] = useState<Set<string>>(new Set());

  const loadJudges = useCallback(async () => {
    try {
      // Get built-in list
      const builtinResp = await fetch(`${API}/settings/judge-personas`);
      const builtinData = await builtinResp.json();
      setBuiltinIds(new Set(builtinData.map((j: Judge) => j.id)));

      // Get full merged list (built-in + custom)
      const resp = await fetch(`${API}/settings/personas`);
      const data = await resp.json();
      setJudges(data);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/linkedin/database`);
        const d = await r.json();
        const items: Profile[] = d.items || [];
        const match = items.find((p) => {
          const m = p.url.match(/linkedin\.com\/in\/([^/?&#\s]+)/);
          return m && m[1].replace(/\/$/, "") === slug;
        });
        setProfile(match || null);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    loadJudges();
  }, [slug, loadJudges]);

  async function deleteJudge(id: string) {
    try {
      await fetch(`${API}/settings/personas/${id}`, { method: "DELETE" });
      loadJudges();
    } catch (e) {
      console.error(e);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111827] -m-6 sm:-m-8 flex items-center justify-center">
        <div className="animate-pulse text-[#4A5A7A]">Loading profile...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#111827] -m-6 sm:-m-8 flex flex-col items-center justify-center gap-4">
        <p className="text-[#4A5A7A] text-lg">Profile not found</p>
        <Link href="/dashboard/linkedin" className="text-[#488CFF] text-sm hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to profiles
        </Link>
      </div>
    );
  }

  const activeSections = SECTIONS.filter((s) => profile[s.key]);

  return (
    <div className="min-h-screen bg-[#111827] -m-6 sm:-m-8">
      {/* Banner */}
      <div className="relative h-48 bg-gradient-to-br from-[#0d47a1] via-[#1565c0] to-[#1976d2]">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImciIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxjaXJjbGUgY3g9IjIwIiBjeT0iMjAiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZykiLz48L3N2Zz4=')] opacity-50" />
        <Link
          href="/dashboard/linkedin"
          className="absolute top-4 left-6 flex items-center gap-2 text-white/80 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> All Profiles
        </Link>
      </div>

      {/* Profile header */}
      <div className="max-w-4xl mx-auto px-6 -mt-20 relative z-10">
        <div className="flex items-end gap-6 mb-6">
          {profile.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.photo_url}
              alt=""
              className="w-32 h-32 rounded-2xl object-cover border-4 border-[#111827] shadow-2xl bg-[#1a2236]"
            />
          ) : (
            <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-[#1a237e] to-[#0d47a1] border-4 border-[#111827] shadow-2xl flex items-center justify-center">
              <span className="text-4xl font-bold text-[#90caf9]">{initials(profile.name)}</span>
            </div>
          )}
          <div className="pb-2 flex-1">
            <h1 className="text-3xl font-bold text-white">{profile.name}</h1>
            <p className="text-base text-[#7B8DB5] mt-1">{profile.headline}</p>
          </div>
        </div>

        {/* Meta bar */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-[#5A6B8A] mb-8 bg-[#1a2236] rounded-xl px-5 py-3 border border-[#253256]">
          {profile.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#488CFF]" /> {profile.location}
            </span>
          )}
          {profile.company && (
            <span className="flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#488CFF]" /> {profile.company}
            </span>
          )}
          {profile.connections && (
            <span className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#488CFF]" /> {profile.connections} connections
            </span>
          )}
          {profile.email && (
            <span className="flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-[#488CFF]" /> {profile.email}
            </span>
          )}
          <a href={profile.url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[#488CFF] hover:underline ml-auto">
            <ExternalLink className="w-4 h-4" /> LinkedIn
          </a>
          {profile.scraped_at && (
            <span className="flex items-center gap-1.5 text-xs text-[#4A5A7A]">
              <Calendar className="w-3.5 h-3.5" /> {profile.scraped_at.slice(0, 10)}
            </span>
          )}
        </div>

        {/* Profile Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-12">
          {activeSections.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.key}
                className={`bg-[#1a2236] border border-[#253256] rounded-xl p-5 ${s.full ? "md:col-span-2" : ""}`}
              >
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#488CFF] mb-3 flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {s.label}
                </h2>
                <pre className="text-sm text-[#9BA8C2] whitespace-pre-wrap break-words font-[inherit] leading-relaxed">
                  {profile[s.key] as string}
                </pre>
              </div>
            );
          })}
        </div>

        {/* ── AI Judges Panel ── */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">AI Judge Panel</h2>
              <p className="text-xs text-[#5A6B8A] mt-0.5">
                {judges.length} judges evaluate applicants during analysis. Edit prompts or create new judges.
              </p>
            </div>
            <button
              onClick={() => setEditingJudge("new")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#488CFF] text-white hover:bg-[#3a7ae0] transition-colors"
            >
              <Plus className="w-4 h-4" /> New Judge
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {judges.map((j) => (
              <JudgeCard
                key={j.id}
                judge={j}
                isCustom={!builtinIds.has(j.id)}
                onEdit={() => setEditingJudge(j)}
                onDelete={!builtinIds.has(j.id) ? () => deleteJudge(j.id) : undefined}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Judge Editor Modal */}
      {editingJudge && (
        <JudgeEditor
          judge={editingJudge === "new" ? null : editingJudge}
          onClose={() => setEditingJudge(null)}
          onSave={() => {
            setEditingJudge(null);
            loadJudges();
          }}
        />
      )}
    </div>
  );
}
