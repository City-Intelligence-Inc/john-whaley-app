"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Search,
  X,
  ExternalLink,
  MapPin,
  Building2,
  GraduationCap,
  Users,
  Briefcase,
  Award,
  Languages,
  BookOpen,
  FolderOpen,
  Heart,
  Star,
  Grid3X3,
  List,
  SlidersHorizontal,
  RefreshCw,
  Plus,
  ClipboardPaste,
  Check,
  Loader2,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

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
  error?: string;
}

type FilterKey =
  | "has-photo"
  | "has-about"
  | "has-exp"
  | "has-edu"
  | "has-skills"
  | "no-photo"
  | "no-about";

type SortKey = "name" | "recent" | "fields";

const FIELD_KEYS = [
  "name",
  "headline",
  "location",
  "about",
  "experience",
  "education",
  "skills",
  "photo_url",
  "certifications",
  "languages",
  "recommendations",
  "publications",
  "awards",
  "courses",
  "organizations",
  "volunteer",
  "projects",
] as const;

function fieldCount(p: Profile) {
  return FIELD_KEYS.filter((f) => p[f as keyof Profile]).length;
}

function initials(name?: string) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ── Detail section config ──
const SECTIONS: { key: keyof Profile; label: string; icon: typeof Briefcase; full?: boolean }[] = [
  { key: "about", label: "About", icon: BookOpen, full: true },
  { key: "experience", label: "Experience", icon: Briefcase, full: true },
  { key: "education", label: "Education", icon: GraduationCap },
  { key: "skills", label: "Skills", icon: Star },
  { key: "company", label: "Company", icon: Building2 },
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

// ── Filter config ──
const FILTERS: { key: FilterKey; label: string; positive: boolean }[] = [
  { key: "has-photo", label: "Photo", positive: true },
  { key: "has-about", label: "About", positive: true },
  { key: "has-exp", label: "Experience", positive: true },
  { key: "has-edu", label: "Education", positive: true },
  { key: "has-skills", label: "Skills", positive: true },
  { key: "no-photo", label: "No Photo", positive: false },
  { key: "no-about", label: "No About", positive: false },
];

function matchesFilter(p: Profile, f: FilterKey) {
  switch (f) {
    case "has-photo": return !!p.photo_url;
    case "has-about": return !!p.about;
    case "has-exp": return !!p.experience;
    case "has-edu": return !!p.education;
    case "has-skills": return !!p.skills;
    case "no-photo": return !p.photo_url;
    case "no-about": return !p.about;
  }
}

// ── Avatar ──
function Avatar({ p, size = "sm" }: { p: Profile; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "w-20 h-20" : "w-11 h-11";
  const textSize = size === "lg" ? "text-2xl" : "text-sm";

  if (p.photo_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={p.photo_url}
        alt=""
        className={`${dim} rounded-full object-cover border-2 border-[#253256] bg-[#1a2236] flex-shrink-0`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
          (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
        }}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-full bg-gradient-to-br from-[#1a237e] to-[#0d47a1] border-2 border-[#253256] flex items-center justify-center flex-shrink-0`}
    >
      <span className={`${textSize} font-bold text-[#90caf9]`}>
        {initials(p.name)}
      </span>
    </div>
  );
}

// ── Field Tag ──
function FieldTag({ has, label }: { has: boolean; label: string }) {
  return (
    <span
      className={`text-[9px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide ${
        has
          ? "bg-emerald-500/15 text-emerald-400"
          : "bg-red-500/10 text-red-400/60"
      }`}
    >
      {label}
    </span>
  );
}

function slugFromUrl(url: string) {
  const m = url.match(/linkedin\.com\/in\/([^/?&#\s]+)/);
  return m ? m[1].replace(/\/$/, "") : null;
}

// ── Profile Card ──
function ProfileCard({ p, onClick, onNavigate }: { p: Profile; onClick: () => void; onNavigate: () => void }) {
  return (
    <div
      onClick={onNavigate}
      className="group bg-[#1a2236] border border-[#253256] rounded-xl overflow-hidden cursor-pointer transition-all hover:border-[#488CFF]/50 hover:shadow-lg hover:shadow-[#488CFF]/5 hover:-translate-y-0.5"
    >
      {/* Banner + avatar */}
      <div className="h-14 bg-gradient-to-r from-[#0d47a1] to-[#1565c0] relative">
        <div className="absolute -bottom-5 left-4">
          <Avatar p={p} />
        </div>
      </div>

      {/* Info */}
      <div className="pt-7 px-4 pb-2">
        <h3 className="font-semibold text-sm text-white truncate group-hover:text-[#6AABFF] transition-colors">
          {p.name || "Unknown"}
        </h3>
        <p className="text-xs text-[#7B8DB5] mt-0.5 line-clamp-2 leading-relaxed min-h-[2.5em]">
          {p.headline || "No headline"}
        </p>
      </div>

      {/* Meta */}
      <div className="px-4 pb-2 space-y-1">
        {p.location && (
          <div className="flex items-center gap-1.5 text-[11px] text-[#4A5A7A]">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{p.location}</span>
          </div>
        )}
        {p.company && (
          <div className="flex items-center gap-1.5 text-[11px] text-[#4A5A7A]">
            <Building2 className="w-3 h-3" />
            <span className="truncate">{p.company}</span>
          </div>
        )}
      </div>

      {/* Tags */}
      <div className="px-4 pb-3 flex flex-wrap gap-1">
        <FieldTag has={!!p.photo_url} label="photo" />
        <FieldTag has={!!p.about} label="about" />
        <FieldTag has={!!p.experience} label="exp" />
        <FieldTag has={!!p.education} label="edu" />
        <FieldTag has={!!p.skills} label="skills" />
      </div>

      {/* About preview */}
      {p.about && (
        <div className="px-4 pb-3 text-[11px] text-[#5A6B8A] line-clamp-2 leading-relaxed">
          {p.about}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 flex items-center justify-between border-t border-[#253256]">
        <a
          href={p.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[11px] text-[#488CFF] font-medium hover:underline flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" /> LinkedIn
        </a>
        {p.connections && (
          <span className="text-[10px] text-[#4A5A7A]">
            {p.connections} conn
          </span>
        )}
      </div>
    </div>
  );
}

// ── Detail Overlay ──
function DetailOverlay({
  p,
  onClose,
}: {
  p: Profile;
  onClose: () => void;
}) {
  const activeSections = SECTIONS.filter((s) => p[s.key]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div className="max-w-3xl mx-auto my-10 px-4" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#1a2236] border border-[#253256] rounded-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="relative">
            <div className="h-24 bg-gradient-to-r from-[#0d47a1] to-[#1565c0]" />
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            <div className="absolute -bottom-10 left-6">
              <Avatar p={p} size="lg" />
            </div>
          </div>

          {/* Profile info */}
          <div className="pt-14 px-6 pb-4">
            <h2 className="text-xl font-bold text-white">{p.name}</h2>
            <p className="text-sm text-[#7B8DB5] mt-1">{p.headline}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-[#5A6B8A]">
              {p.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> {p.location}
                </span>
              )}
              {p.connections && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> {p.connections} connections
                </span>
              )}
              {p.email && <span>{p.email}</span>}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <a
                href={p.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[#488CFF] hover:underline flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" /> View on LinkedIn
              </a>
              {p.scraped_at && (
                <span className="text-[10px] text-[#4A5A7A]">
                  Scraped: {p.scraped_at.slice(0, 10)}
                </span>
              )}
            </div>
          </div>

          {/* Sections */}
          <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeSections.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.key}
                  className={`bg-[#111827] border border-[#1e2a42] rounded-xl p-4 ${
                    s.full ? "md:col-span-2" : ""
                  }`}
                >
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[#488CFF] mb-2 flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5" />
                    {s.label}
                  </h3>
                  <pre className="text-xs text-[#9BA8C2] whitespace-pre-wrap break-words font-[inherit] leading-relaxed max-h-64 overflow-y-auto">
                    {p[s.key] as string}
                  </pre>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Table Row ──
function TableRow({ p, onClick }: { p: Profile; onClick: () => void }) {
  return (
    <tr
      onClick={onClick}
      className="border-b border-[#1e2a42] hover:bg-[#1a2236] cursor-pointer transition-colors"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar p={p} />
          <div className="min-w-0">
            <div className="text-sm font-medium text-white truncate max-w-[180px]">
              {p.name || "Unknown"}
            </div>
            <div className="text-[11px] text-[#5A6B8A] truncate max-w-[180px]">
              {p.email || ""}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-[#7B8DB5] max-w-[240px]">
        <span className="line-clamp-2 leading-relaxed">{p.headline || "—"}</span>
      </td>
      <td className="px-4 py-3 text-xs text-[#5A6B8A] whitespace-nowrap">
        {p.location || "—"}
      </td>
      <td className="px-4 py-3 text-xs text-[#5A6B8A] max-w-[140px]">
        <span className="truncate block">{p.company || "—"}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-1">
          <FieldTag has={!!p.photo_url} label="P" />
          <FieldTag has={!!p.about} label="A" />
          <FieldTag has={!!p.experience} label="E" />
          <FieldTag has={!!p.education} label="Ed" />
          <FieldTag has={!!p.skills} label="S" />
        </div>
      </td>
      <td className="px-4 py-3">
        <a
          href={p.url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[11px] text-[#488CFF] hover:underline"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </td>
    </tr>
  );
}

// ── Manual Scrape Panel (full page overlay) ──
function ManualScrapePanel({
  onAdded,
}: {
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [content, setContent] = useState("");
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [recentAdds, setRecentAdds] = useState<{ name: string; url: string; time: string }[]>([]);

  async function handleSave() {
    if (!url.trim() || !content.trim()) return;
    setSaving(true);
    try {
      const resp = await fetch(`${API}/linkedin/manual-scrape`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          email: email.trim() || undefined,
          content: content.trim(),
          photo_base64: photoData || undefined,
        }),
      });
      if (resp.ok) {
        setRecentAdds((prev) => [
          { name: url.split("/in/")[1]?.replace(/\/$/, "") || "profile", url: url.trim(), time: new Date().toLocaleTimeString() },
          ...prev,
        ].slice(0, 10));
        setUrl("");
        setEmail("");
        setContent("");
        setPhotoData(null);
        onAdded();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  // Handle paste for images
  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData.items;
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setPhotoData(ev.target?.result as string);
        reader.readAsDataURL(file);
        return;
      }
    }
  }

  // Handle drop for images
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPhotoData(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#488CFF] text-white hover:bg-[#3a7ae0] transition-colors"
      >
        <ClipboardPaste className="w-4 h-4" /> Manual Scrape
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto" onClick={() => setOpen(false)}>
      <div className="max-w-2xl mx-auto my-8 px-4" onClick={(e) => e.stopPropagation()}>
        <div className="bg-[#111827] border border-[#253256] rounded-2xl overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#253256]">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <ClipboardPaste className="w-5 h-5 text-[#488CFF]" />
              Manual Profile Scrape
            </h2>
            <button onClick={() => setOpen(false)} className="text-[#4A5A7A] hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            {/* URL + Email */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-[#4A5A7A] uppercase tracking-wider font-semibold mb-1">LinkedIn URL *</label>
                <input
                  type="text"
                  placeholder="https://linkedin.com/in/someone"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  autoFocus
                  className="w-full bg-[#0d1117] border border-[#253256] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#4A5A7A] outline-none focus:border-[#488CFF]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#4A5A7A] uppercase tracking-wider font-semibold mb-1">Email (optional)</label>
                <input
                  type="email"
                  placeholder="their@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#253256] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#4A5A7A] outline-none focus:border-[#488CFF]"
                />
              </div>
            </div>

            {/* Photo drop zone */}
            <div>
              <label className="block text-[10px] text-[#4A5A7A] uppercase tracking-wider font-semibold mb-1">Profile Photo</label>
              <div
                onPaste={handlePaste}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (ev) => setPhotoData(ev.target?.result as string);
                    reader.readAsDataURL(file);
                  };
                  input.click();
                }}
                tabIndex={0}
                className="border-2 border-dashed border-[#253256] rounded-xl p-4 text-center cursor-pointer hover:border-[#488CFF]/50 transition-colors min-h-[70px] flex items-center justify-center gap-3"
              >
                {photoData ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photoData} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-[#253256]" />
                ) : (
                  <span className="text-xs text-[#4A5A7A]">Paste (Cmd+V), drag, or click to add photo</span>
                )}
                {photoData && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setPhotoData(null); }}
                    className="text-[#4A5A7A] hover:text-red-400 text-xs"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Content paste */}
            <div>
              <label className="block text-[10px] text-[#4A5A7A] uppercase tracking-wider font-semibold mb-1">Profile Content * (Cmd+A Cmd+C from LinkedIn, Cmd+V here)</label>
              <textarea
                placeholder={"Go to their LinkedIn profile page\nCmd+A to select all\nCmd+C to copy\nCmd+V to paste here\n\nThe backend strips nav junk and parses into: name, headline, location, about, experience, education, skills, certifications, languages, etc."}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={12}
                className="w-full bg-[#0d1117] border border-[#253256] rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-[#4A5A7A] outline-none focus:border-[#488CFF] resize-y font-mono leading-relaxed"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-[#4A5A7A]">Cmd+Enter to save</span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setUrl(""); setEmail(""); setContent(""); setPhotoData(null); }}
                  className="px-4 py-2 rounded-lg text-sm text-[#5A6B8A] hover:text-white border border-[#253256] hover:border-[#488CFF]/30 transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={handleSave}
                  disabled={!url.trim() || !content.trim() || saving}
                  className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? "Saving..." : "Save to Database"}
                </button>
              </div>
            </div>

            {/* Recent adds */}
            {recentAdds.length > 0 && (
              <div className="border-t border-[#253256] pt-4 mt-2">
                <h4 className="text-[10px] text-[#4A5A7A] uppercase tracking-wider font-semibold mb-2">Recently Added</h4>
                <div className="space-y-1">
                  {recentAdds.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-[#7B8DB5] bg-[#0d1117] rounded-lg px-3 py-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="flex-1 truncate">{r.name}</span>
                      <span className="text-[#4A5A7A]">{r.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global keyboard handler for Cmd+Enter */}
      <div
        ref={(el) => {
          if (!el) return;
          const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleSave();
            }
          };
          window.addEventListener("keydown", handler);
          return () => window.removeEventListener("keydown", handler);
        }}
      />
    </div>
  );
}

// ── CSV Enrichment Panel ──
function EnrichPanel({
  onDone,
  getToken,
}: {
  onDone: () => void;
  getToken: () => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [liAt, setLiAt] = useState("");
  const [csvUrls, setCsvUrls] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [scraping, setScraping] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<{ url: string; name?: string; error?: string }[]>([]);

  function onCsvFile(file: File) {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const re = /https?:\/\/(?:www\.)?linkedin\.com\/(?:in|company)\/[^\s,"'<>]+/gi;
      const seen = new Set<string>();
      const urls: string[] = [];
      let m;
      while ((m = re.exec(text)) !== null) {
        const u = m[0].replace(/[,;"'\s]+$/, "");
        if (!seen.has(u)) { seen.add(u); urls.push(u); }
      }
      setCsvUrls(urls);
    };
    reader.readAsText(file);
  }

  async function startEnrich() {
    if (!csvUrls.length) return;
    setScraping(true);
    setProgress({ done: 0, total: csvUrls.length });
    setResults([]);

    try {
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const r = await fetch(`${API}/linkedin/enrich`, {
        method: "POST",
        headers,
        body: JSON.stringify({ urls: csvUrls, li_at: liAt || undefined, max_retries: 2 }),
      });
      const d = await r.json();
      const jobId = d.job_id;

      // Stream results
      const resp = await fetch(`${API}/linkedin/stream/${jobId}`, { headers });
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let eventType = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const result = JSON.parse(line.slice(6));
              if (eventType === "done") break;
              setResults((prev) => [...prev, result]);
              setProgress((p) => ({ ...p, done: p.done + 1 }));
            } catch {}
            eventType = "";
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setScraping(false);
      onDone();
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[#253256] text-[#7B8DB5] hover:border-[#488CFF]/50 hover:text-white transition-colors"
      >
        <RefreshCw className="w-3.5 h-3.5" /> Enrich CSV
      </button>
    );
  }

  return (
    <div className="bg-[#1a2236] border border-[#253256] rounded-xl p-5 mb-4 mx-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Batch Enrich from CSV</h3>
        <button onClick={() => setOpen(false)} className="text-[#4A5A7A] hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-end mb-4">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-semibold text-[#4A5A7A] uppercase tracking-wide mb-1">CSV File</label>
          <label className="flex items-center gap-2 cursor-pointer border border-dashed border-[#253256] hover:border-[#488CFF] rounded-lg px-4 py-2.5 transition-colors">
            <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && onCsvFile(e.target.files[0])} />
            <span className="text-sm text-[#5A6B8A]">{fileName || "Choose CSV..."}</span>
            {csvUrls.length > 0 && <span className="text-xs text-emerald-400 ml-auto">{csvUrls.length} URLs found</span>}
          </label>
        </div>
        <div className="flex-1 min-w-[260px]">
          <label className="block text-[10px] font-semibold text-[#4A5A7A] uppercase tracking-wide mb-1">li_at Cookie (for full profiles)</label>
          <input
            type="password"
            placeholder="Paste li_at from browser DevTools → Cookies → linkedin.com"
            value={liAt}
            onChange={(e) => setLiAt(e.target.value)}
            className="w-full rounded-lg border border-[#253256] bg-[#111827] px-3 py-2.5 text-sm text-white placeholder:text-[#4A5A7A] outline-none focus:border-[#488CFF] font-mono"
          />
        </div>
        <button
          onClick={startEnrich}
          disabled={!csvUrls.length || scraping}
          className="rounded-lg px-5 py-2.5 text-sm font-semibold bg-[#488CFF] text-white hover:bg-[#3a7ae0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {scraping ? `Scraping ${progress.done}/${progress.total}...` : "Start Enrichment"}
        </button>
      </div>

      {/* Progress bar */}
      {scraping && (
        <div className="h-1.5 bg-[#253256] rounded-full overflow-hidden mb-3">
          <div
            className="h-full bg-gradient-to-r from-[#488CFF] to-cyan-400 transition-all duration-300 rounded-full"
            style={{ width: `${progress.total ? Math.round(progress.done / progress.total * 100) : 0}%` }}
          />
        </div>
      )}

      {/* Live results */}
      {results.length > 0 && (
        <div className="max-h-48 overflow-y-auto text-xs space-y-1">
          {results.map((r, i) => (
            <div key={i} className={`flex items-center gap-2 px-2 py-1 rounded ${r.error ? "text-red-400" : "text-emerald-400"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${r.error ? "bg-red-400" : "bg-emerald-400"}`} />
              <span className="text-[#9BA8C2] truncate flex-1">{r.name || r.url}</span>
              {r.error && <span className="text-red-400/70 text-[10px]">{r.error.slice(0, 40)}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Page ──
export default function LinkedInPage() {
  const router = useRouter();
  const { getToken } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
  const [sort, setSort] = useState<SortKey>("name");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [selected, setSelected] = useState<Profile | null>(null);

  const loadDatabase = useCallback(async () => {
    try {
      const token = await getToken();
      const r = await fetch(`${API}/linkedin/database`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const d = await r.json();
      setProfiles(d.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    loadDatabase();
  }, [loadDatabase]);

  // Close detail on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const toggleFilter = (f: FilterKey) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let result = profiles.filter((p) => {
      // Search
      if (search) {
        const hay = [
          p.name,
          p.headline,
          p.about,
          p.experience,
          p.education,
          p.skills,
          p.company,
          p.location,
          p.email,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (
          !search
            .toLowerCase()
            .split(/\s+/)
            .every((w) => hay.includes(w))
        )
          return false;
      }
      // Filters
      for (const f of activeFilters) {
        if (!matchesFilter(p, f)) return false;
      }
      return true;
    });

    // Sort
    if (sort === "name")
      result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    else if (sort === "recent")
      result.sort((a, b) =>
        (b.scraped_at || "").localeCompare(a.scraped_at || "")
      );
    else result.sort((a, b) => fieldCount(b) - fieldCount(a));

    return result;
  }, [profiles, search, activeFilters, sort]);

  // Stats
  const stats = useMemo(
    () => ({
      total: profiles.length,
      photos: profiles.filter((p) => p.photo_url).length,
      about: profiles.filter((p) => p.about).length,
      experience: profiles.filter((p) => p.experience).length,
      education: profiles.filter((p) => p.education).length,
      skills: profiles.filter((p) => p.skills).length,
    }),
    [profiles]
  );

  return (
    <div className="min-h-screen bg-[#111827] text-[#9BA8C2] -m-6 sm:-m-8">
      {/* ── Top Bar ── */}
      <div className="sticky top-0 z-20 bg-[#111827]/95 backdrop-blur-md border-b border-[#1e2a42]">
        {/* Row 1: Title + Search */}
        <div className="px-6 py-3 flex items-center gap-4">
          <h1 className="text-base font-bold text-white whitespace-nowrap">
            LinkedIn Profiles
          </h1>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4A5A7A]" />
            <input
              type="text"
              placeholder="Search name, headline, company, skills, school..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#1a2236] border border-[#253256] rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-[#4A5A7A] outline-none focus:border-[#488CFF] transition-colors"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#4A5A7A] hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <span className="bg-[#488CFF] text-white text-xs font-bold px-3 py-1 rounded-full">
            {filtered.length}
          </span>

          <button
            onClick={loadDatabase}
            className="text-[#4A5A7A] hover:text-[#488CFF] transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <EnrichPanel onDone={loadDatabase} getToken={getToken} />
          <ManualScrapePanel onAdded={loadDatabase} />
        </div>

        {/* Row 2: Filters + Sort + View toggle */}
        <div className="px-6 pb-3 flex items-center gap-2 flex-wrap">
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#4A5A7A] mr-1" />

          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => toggleFilter(f.key)}
              className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-all ${
                activeFilters.has(f.key)
                  ? "bg-[#488CFF] border-[#488CFF] text-white"
                  : "border-[#253256] text-[#5A6B8A] hover:border-[#488CFF]/50 hover:text-[#7B8DB5]"
              }`}
            >
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
                  f.positive ? "bg-emerald-400" : "bg-red-400"
                }`}
              />
              {f.label}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="bg-[#1a2236] border border-[#253256] rounded-lg text-xs text-[#7B8DB5] px-3 py-1.5 cursor-pointer outline-none"
            >
              <option value="name">Name A-Z</option>
              <option value="recent">Recently Scraped</option>
              <option value="fields">Most Complete</option>
            </select>

            <div className="flex bg-[#1a2236] border border-[#253256] rounded-lg p-0.5">
              <button
                onClick={() => setView("cards")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  view === "cards"
                    ? "bg-[#488CFF] text-white"
                    : "text-[#5A6B8A] hover:text-[#7B8DB5]"
                }`}
              >
                <Grid3X3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setView("table")}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  view === "table"
                    ? "bg-[#488CFF] text-white"
                    : "text-[#5A6B8A] hover:text-[#7B8DB5]"
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stats Bar ── */}
      <div className="px-6 py-2 border-b border-[#1e2a42] flex gap-6 text-[11px] text-[#4A5A7A] bg-[#0f1520]">
        <span>
          <strong className="text-[#488CFF]">{stats.total}</strong> profiles
        </span>
        <span>
          <strong className="text-[#488CFF]">{stats.photos}</strong> photos
        </span>
        <span>
          <strong className="text-[#488CFF]">{stats.about}</strong> about
        </span>
        <span>
          <strong className="text-[#488CFF]">{stats.experience}</strong>{" "}
          experience
        </span>
        <span>
          <strong className="text-[#488CFF]">{stats.education}</strong>{" "}
          education
        </span>
        <span>
          <strong className="text-[#488CFF]">{stats.skills}</strong> skills
        </span>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 p-6">
          {Array(8)
            .fill(0)
            .map((_, i) => (
              <div
                key={i}
                className="bg-[#1a2236] border border-[#253256] rounded-xl overflow-hidden animate-pulse"
              >
                <div className="h-14 bg-[#253256]" />
                <div className="p-4 pt-8 space-y-2">
                  <div className="h-3 bg-[#253256] rounded-full w-3/5" />
                  <div className="h-3 bg-[#253256] rounded-full w-2/5" />
                  <div className="h-3 bg-[#253256] rounded-full w-4/5" />
                </div>
              </div>
            ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24 text-[#4A5A7A]">
          <p className="text-lg font-medium mb-1">No profiles match</p>
          <p className="text-sm">Try adjusting your search or filters.</p>
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4 p-6">
          {filtered.map((p) => {
            const slug = slugFromUrl(p.url);
            return (
              <ProfileCard
                key={p.url}
                p={p}
                onClick={() => setSelected(p)}
                onNavigate={() => slug ? router.push(`/dashboard/linkedin/${slug}`) : setSelected(p)}
              />
            );
          })}
        </div>
      ) : (
        <div className="px-6 py-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#253256] text-left">
                <th className="px-4 py-2.5 text-[10px] font-semibold text-[#4A5A7A] uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-[#4A5A7A] uppercase tracking-wider">
                  Headline
                </th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-[#4A5A7A] uppercase tracking-wider">
                  Location
                </th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-[#4A5A7A] uppercase tracking-wider">
                  Company
                </th>
                <th className="px-4 py-2.5 text-[10px] font-semibold text-[#4A5A7A] uppercase tracking-wider">
                  Fields
                </th>
                <th className="px-4 py-2.5 w-8" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const slug = slugFromUrl(p.url);
                return (
                  <TableRow
                    key={p.url}
                    p={p}
                    onClick={() => slug ? router.push(`/dashboard/linkedin/${slug}`) : setSelected(p)}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Detail Overlay ── */}
      {selected && (
        <DetailOverlay p={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
