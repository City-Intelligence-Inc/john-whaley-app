"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Profile {
  url: string;
  name?: string;
  headline?: string;
  photo_url?: string;
  location?: string;
  connections?: string;
  company?: string;
  education?: string;
  scraped_at?: string;
  error?: string;
}

function proxyPhoto(url?: string) {
  if (!url) return null;
  return `${API}/linkedin/proxy-image?url=${encodeURIComponent(url)}`;
}

function initials(name?: string) {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function handleFromUrl(url: string) {
  const m = url.match(/linkedin\.com\/(?:in|company)\/([^/?#]+)/);
  return m ? m[1].replace(/-/g, " ") : url;
}

function timeAgo(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Avatar({ p }: { p: Profile }) {
  const photo = proxyPhoto(p.photo_url);
  const name = p.name || handleFromUrl(p.url);
  return (
    <div className="w-9 h-9 rounded-full overflow-hidden bg-[#0a66c2] flex-shrink-0 flex items-center justify-center">
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt="" className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      ) : (
        <span className="text-white font-bold text-xs">{initials(name)}</span>
      )}
    </div>
  );
}

function ProfileCard({ p }: { p: Profile }) {
  const ok = !p.error;
  const name = ok ? (p.name || handleFromUrl(p.url)) : handleFromUrl(p.url);
  const photo = proxyPhoto(p.photo_url);

  return (
    <div className="bg-[#1a1a24] border border-[#2a2a38] rounded-xl overflow-hidden hover:border-[#0a66c2] transition-colors">
      <div className="h-12 bg-gradient-to-r from-[#0a66c2] to-[#083d7a] relative">
        <div className="absolute -bottom-5 left-3 w-11 h-11 rounded-full border-2 border-[#1a1a24] overflow-hidden bg-[#0a66c2]">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white font-bold text-sm">
              {initials(name)}
            </div>
          )}
        </div>
      </div>

      <div className="pt-7 px-3 pb-2">
        <div className="font-semibold text-sm text-white truncate">{name}</div>
        {ok ? (
          <div className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
            {p.headline || <span className="text-slate-600">No headline</span>}
          </div>
        ) : (
          <div className="text-xs text-red-400 mt-0.5">{
            /999|rate/i.test(p.error || "") ? "Rate limited" :
            /redirect/i.test(p.error || "") ? "Auth required" : "Failed"
          }</div>
        )}

        {ok && (
          <div className="mt-2 space-y-1">
            {p.location && (
              <div className="flex gap-1.5 text-[11px] text-slate-500">
                <span>📍</span><span className="truncate">{p.location}</span>
              </div>
            )}
            {p.company && (
              <div className="flex gap-1.5 text-[11px] text-slate-500">
                <span>🏢</span><span className="truncate">{p.company}</span>
              </div>
            )}
            {p.education && (
              <div className="flex gap-1.5 text-[11px] text-slate-500">
                <span>🎓</span><span className="truncate">{p.education}</span>
              </div>
            )}
            {p.connections && (
              <div className="flex gap-1.5 text-[11px] text-slate-500">
                <span>🔗</span><span>{p.connections} connections</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-3 pb-3 pt-1 flex items-center justify-between border-t border-[#1e1e2a] mt-2">
        <a href={p.url} target="_blank" rel="noreferrer"
          className="text-[11px] text-[#0a66c2] font-medium hover:underline">
          View ↗
        </a>
        <span className="text-[10px] text-slate-600">{timeAgo(p.scraped_at)}</span>
      </div>
    </div>
  );
}

function TableView({ profiles }: { profiles: Profile[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-[#2a2a38] text-left">
            <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-8">#</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Name</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Headline</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Company</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Education</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Location</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Connections</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Scraped</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p, idx) => {
            const name = p.name || handleFromUrl(p.url);
            const ok = !p.error;
            return (
              <tr key={p.url} className="border-b border-[#1e1e2a] hover:bg-[#1a1a24] transition-colors">
                <td className="px-4 py-2.5 text-slate-600 text-xs">{idx + 1}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar p={p} />
                    <div className="min-w-0">
                      <a href={p.url} target="_blank" rel="noreferrer"
                        className="text-white font-medium hover:text-[#0a66c2] transition-colors truncate block max-w-[160px]">
                        {name}
                      </a>
                      {!ok && <span className="text-[10px] text-red-400">Failed</span>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-slate-300 max-w-[220px]">
                  <span className="line-clamp-2 text-xs leading-relaxed">{p.headline || <span className="text-slate-600">—</span>}</span>
                </td>
                <td className="px-4 py-2.5 text-slate-400 text-xs max-w-[140px]">
                  <span className="truncate block">{p.company || <span className="text-slate-600">—</span>}</span>
                </td>
                <td className="px-4 py-2.5 text-slate-400 text-xs max-w-[140px]">
                  <span className="truncate block">{p.education || <span className="text-slate-600">—</span>}</span>
                </td>
                <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">{p.location || <span className="text-slate-600">—</span>}</td>
                <td className="px-4 py-2.5 text-slate-400 text-xs whitespace-nowrap">{p.connections ? `${p.connections}` : <span className="text-slate-600">—</span>}</td>
                <td className="px-4 py-2.5 text-slate-600 text-xs whitespace-nowrap">{timeAgo(p.scraped_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function LinkedInPage() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "ok" | "err">("ok");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"cards" | "table">("table");

  const [enrichOpen, setEnrichOpen] = useState(false);
  const [liAt, setLiAt] = useState("");
  const [csvUrls, setCsvUrls] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [scraping, setScraping] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const jobRef = useRef<string | null>(null);

  const loadDatabase = useCallback(async () => {
    try {
      const r = await fetch(`${API}/linkedin/database`);
      const d = await r.json();
      setProfiles(d.items || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDatabase(); }, [loadDatabase]);

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

    const body = JSON.stringify({ urls: csvUrls, li_at: liAt || undefined, max_retries: 1 });
    let jobId: string;
    try {
      const r = await fetch(`${API}/linkedin/enrich`, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      const d = await r.json();
      jobId = d.job_id;
      jobRef.current = jobId;
    } catch (e) {
      console.error(e);
      setScraping(false);
      return;
    }

    const resp = await fetch(`${API}/linkedin/stream/${jobId}`);
    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let eventType = "";

    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("event: ")) { eventType = line.slice(7).trim(); }
          else if (line.startsWith("data: ")) {
            try {
              const result = JSON.parse(line.slice(6));
              if (eventType === "done") break;
              setProfiles((prev) => {
                const exists = prev.findIndex((p) => p.url === result.url);
                if (exists >= 0) {
                  const updated = [...prev];
                  updated[exists] = result;
                  return updated;
                }
                return [result, ...prev];
              });
              setProgress((p) => ({ ...p, done: p.done + 1 }));
            } catch {}
            eventType = "";
          }
        }
      }
    };

    await pump();
    setScraping(false);
    loadDatabase();
  }

  const visible = profiles.filter((p) => {
    if (filter === "ok" && p.error) return false;
    if (filter === "err" && !p.error) return false;
    if (search) {
      const s = [p.name, p.headline, p.location, p.company, p.education].filter(Boolean).join(" ").toLowerCase();
      if (!s.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const okCount = profiles.filter((p) => !p.error).length;
  const errCount = profiles.length - okCount;

  return (
    <div className="min-h-screen bg-[#0f0f13] text-slate-200 -m-6 sm:-m-8">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#16161d] border-b border-[#2a2a38] px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-white">LinkedIn Database</h1>
          <p className="text-xs text-slate-500 mt-0.5">{profiles.length} profiles · {okCount} enriched · {errCount} failed</p>
        </div>
        <div className="flex gap-2 items-center">
          {scraping && (
            <span className="text-xs text-slate-400">{progress.done}/{progress.total} scraped</span>
          )}
          <button
            onClick={() => setEnrichOpen(!enrichOpen)}
            className="rounded-lg px-4 py-2 text-sm font-semibold bg-[#0a66c2] text-white hover:bg-[#0952a0] transition-colors"
          >
            + Enrich New
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {scraping && (
        <div className="h-1 bg-[#2a2a38]">
          <div
            className="h-1 bg-gradient-to-r from-[#0a66c2] to-cyan-400 transition-all duration-300"
            style={{ width: `${progress.total ? Math.round(progress.done / progress.total * 100) : 0}%` }}
          />
        </div>
      )}

      {/* Enrich panel */}
      {enrichOpen && (
        <div className="bg-[#1a1a24] border-b border-[#2a2a38] px-6 py-4 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">CSV File</label>
            <label className="flex items-center gap-2 cursor-pointer border border-dashed border-[#2a2a38] hover:border-[#0a66c2] rounded-lg px-4 py-2.5 transition-colors">
              <input type="file" accept=".csv" className="hidden" onChange={(e) => e.target.files?.[0] && onCsvFile(e.target.files[0])} />
              <span className="text-sm text-slate-500">{fileName || "Choose CSV…"}</span>
              {csvUrls.length > 0 && <span className="text-xs text-green-400 ml-auto">{csvUrls.length} URLs</span>}
            </label>
          </div>
          <div className="flex-1 min-w-[260px]">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">li_at Cookie (optional)</label>
            <input
              type="password"
              placeholder="Paste li_at for full headlines + photos…"
              value={liAt}
              onChange={(e) => setLiAt(e.target.value)}
              className="w-full rounded-lg border border-[#2a2a38] bg-[#0f0f13] px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:border-[#0a66c2] font-mono"
            />
          </div>
          <button
            onClick={startEnrich}
            disabled={!csvUrls.length || scraping}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold bg-[#0a66c2] text-white hover:bg-[#0952a0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {scraping ? "Scraping…" : "Start"}
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="px-6 py-3 flex gap-3 items-center flex-wrap border-b border-[#1e1e2a]">
        <div className="flex gap-1.5">
          {([["all", `All ${profiles.length}`], ["ok", `Enriched ${okCount}`], ["err", `Failed ${errCount}`]] as const).map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filter === f ? "bg-[#0a66c2] border-[#0a66c2] text-white" : "border-[#2a2a38] text-slate-500 hover:border-[#0a66c2]"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* View toggle */}
        <div className="flex gap-1 ml-2 bg-[#1a1a24] border border-[#2a2a38] rounded-lg p-0.5">
          {(["table", "cards"] as const).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                view === v ? "bg-[#0a66c2] text-white" : "text-slate-500 hover:text-slate-300"
              }`}>
              {v === "table" ? "⊞ Table" : "⊟ Cards"}
            </button>
          ))}
        </div>

        <input
          type="text"
          placeholder="Search name, headline, company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto rounded-full border border-[#2a2a38] bg-[#1a1a24] px-4 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-[#0a66c2] w-56"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 p-6">
          {Array(12).fill(0).map((_, i) => (
            <div key={i} className="bg-[#1a1a24] border border-[#2a2a38] rounded-xl overflow-hidden animate-pulse">
              <div className="h-12 bg-[#2a2a38]" />
              <div className="p-3 pt-7 space-y-2">
                <div className="h-3 bg-[#2a2a38] rounded-full w-3/5" />
                <div className="h-3 bg-[#2a2a38] rounded-full w-2/5" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-24 text-slate-600 text-sm">
          {profiles.length === 0 ? "No profiles yet — enrich some LinkedIn URLs to get started." : "No profiles match."}
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3 p-6">
          {visible.map((p) => <ProfileCard key={p.url} p={p} />)}
        </div>
      ) : (
        <div className="px-6 py-4">
          <TableView profiles={visible} />
        </div>
      )}
    </div>
  );
}
