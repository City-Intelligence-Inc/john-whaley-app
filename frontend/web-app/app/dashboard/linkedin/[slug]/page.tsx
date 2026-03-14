"use client";

import { useEffect, useState, use } from "react";
import { useAuth } from "@clerk/nextjs";
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

export default function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const r = await fetch(`${API}/linkedin/database`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const d = await r.json();
        const items: Profile[] = d.items || [];
        // Match by slug in URL
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
  }, [slug, getToken]);

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
          {/* Avatar */}
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
          <a
            href={profile.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[#488CFF] hover:underline ml-auto"
          >
            <ExternalLink className="w-4 h-4" /> LinkedIn
          </a>
          {profile.scraped_at && (
            <span className="flex items-center gap-1.5 text-xs text-[#4A5A7A]">
              <Calendar className="w-3.5 h-3.5" /> {profile.scraped_at.slice(0, 10)}
            </span>
          )}
        </div>

        {/* Sections */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-12">
          {activeSections.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.key}
                className={`bg-[#1a2236] border border-[#253256] rounded-xl p-5 ${
                  s.full ? "md:col-span-2" : ""
                }`}
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
      </div>
    </div>
  );
}
