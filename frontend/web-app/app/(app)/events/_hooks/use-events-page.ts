"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Session, Applicant } from "@/lib/api";

const AGENTS = [
  { id: "founder_check", name: "Founder Check", description: "Validates founder quality and traction" },
  { id: "venture_validator", name: "Venture Validator", description: "Cross-validates VC/investor claims" },
  { id: "background_verify", name: "Background Verify", description: "Checks credentials and employment" },
  { id: "relevance_score", name: "Event Fit", description: "Scores relevance for AI events" },
  { id: "network_value", name: "Network Value", description: "Assesses connection and networking value" },
];

export function useEventsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [eventLoading, setEventLoading] = useState(false);
  const [search, setSearch] = useState("");

  // AI config
  const [apiKey, setApiKey] = useState("");
  const [provider, setProvider] = useState("anthropic");
  const [model, setModel] = useState("claude-sonnet-4-20250514");

  // Investigation state
  const [investigatingIds, setInvestigatingIds] = useState<Set<string>>(new Set());
  const [bulkInvestigating, setBulkInvestigating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ completed: number; total: number } | null>(null);

  // Load from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    setApiKey(localStorage.getItem("ai_api_key") || "");
    setProvider(localStorage.getItem("ai_provider") || "anthropic");
    setModel(localStorage.getItem("ai_model") || "claude-sonnet-4-20250514");
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (typeof window === "undefined" || !apiKey) return;
    localStorage.setItem("ai_api_key", apiKey);
    localStorage.setItem("ai_provider", provider);
    localStorage.setItem("ai_model", model);
  }, [apiKey, provider, model]);

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const data = await api.listSessions();
      setSessions(data);
      if (data.length > 0 && !selectedSessionId) setSelectedSessionId(data[0].session_id);
    } catch { toast.error("Failed to load events"); }
    finally { setSessionsLoading(false); }
  }, [selectedSessionId]);

  useEffect(() => { loadSessions(); }, []);

  // Load event
  const loadEvent = useCallback(async (sid: string) => {
    setEventLoading(true);
    try {
      const [s, a] = await Promise.all([api.getSession(sid), api.listApplicants(sid)]);
      setSession(s); setApplicants(a);
    } catch { toast.error("Failed to load event"); }
    finally { setEventLoading(false); }
  }, []);

  useEffect(() => { if (selectedSessionId) loadEvent(selectedSessionId); }, [selectedSessionId, loadEvent]);

  const refreshAll = useCallback(async () => {
    if (selectedSessionId) await loadEvent(selectedSessionId);
  }, [selectedSessionId, loadEvent]);

  // Session CRUD
  const createEvent = useCallback(async (name: string) => {
    const s = await api.createSession({ name, source: "manual" });
    await loadSessions();
    setSelectedSessionId(s.session_id);
    return s;
  }, [loadSessions]);

  // Status change (optimistic)
  const changeStatus = useCallback(async (id: string, status: string) => {
    setApplicants(prev => prev.map(a => a.applicant_id === id ? { ...a, status } : a));
    try { await api.updateApplicant(id, { status }); }
    catch { toast.error("Failed to update"); await refreshAll(); }
  }, [refreshAll]);

  // Investigation
  const runInvestigation = useCallback(async (applicantId: string, agentId: string) => {
    if (!apiKey) { toast.error("Enter your AI API key first"); return; }
    setInvestigatingIds(prev => new Set(prev).add(applicantId));
    try {
      const res = await api.investigateApplicant(applicantId, agentId, { api_key: apiKey, model, provider });
      // Update local state immediately
      setApplicants(prev => prev.map(a =>
        a.applicant_id === applicantId ? { ...a, [`investigation_${agentId}`]: res.result } : a
      ));
      return res.result;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Investigation failed");
    } finally {
      setInvestigatingIds(prev => { const n = new Set(prev); n.delete(applicantId); return n; });
    }
  }, [apiKey, model, provider]);

  const runBulkInvestigation = useCallback(async (agentIds: string[]) => {
    if (!apiKey) { toast.error("Enter your AI API key first"); return; }
    setBulkInvestigating(true);
    const queue = applicants.flatMap(a => agentIds.map(ag => ({ applicantId: a.applicant_id, agentId: ag })));
    setBulkProgress({ completed: 0, total: queue.length });

    for (let i = 0; i < queue.length; i++) {
      const { applicantId, agentId } = queue[i];
      try {
        const res = await api.investigateApplicant(applicantId, agentId, { api_key: apiKey, model, provider });
        setApplicants(prev => prev.map(a =>
          a.applicant_id === applicantId ? { ...a, [`investigation_${agentId}`]: res.result } : a
        ));
      } catch { /* continue on error */ }
      setBulkProgress({ completed: i + 1, total: queue.length });
    }

    setBulkInvestigating(false);
    setBulkProgress(null);
    toast.success("Bulk investigation complete");
  }, [apiKey, model, provider, applicants]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    let list = applicants;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => [a.name, a.email, a.company, a.title, a[`linkedin_headline`] as string].filter(Boolean).join(" ").toLowerCase().includes(q));
    }
    // Sort: pending first, then accepted, then waitlisted, rejected last
    const statusOrder: Record<string, number> = { pending: 0, accepted: 1, waitlisted: 2, rejected: 3 };
    return list.sort((a, b) => {
      const sa = statusOrder[a.status] ?? 1;
      const sb = statusOrder[b.status] ?? 1;
      if (sa !== sb) return sa - sb;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [applicants, search]);

  // Counts
  const accepted = applicants.filter(a => a.status === "accepted").length;
  const pending = applicants.filter(a => a.status === "pending").length;
  const total = applicants.length;

  return {
    sessions, sessionsLoading, selectedSessionId, setSelectedSessionId,
    session, applicants, eventLoading, search, setSearch,
    apiKey, setApiKey, provider, setProvider, model, setModel,
    investigatingIds, bulkInvestigating, bulkProgress,
    loadSessions, refreshAll, createEvent, changeStatus,
    runInvestigation, runBulkInvestigation,
    filtered, accepted, pending, total, agents: AGENTS,
  };
}
