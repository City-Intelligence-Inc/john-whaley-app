"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { api } from "@/lib/api";
import type { Session, Applicant, Stats } from "@/lib/api";

interface EventContextValue {
  sessionId: string;
  session: Session | null;
  applicants: Applicant[];
  stats: Stats | null;
  loading: boolean;
  error: string | null;
  refreshApplicants: () => Promise<void>;
  refreshStats: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const EventContext = createContext<EventContextValue | null>(null);

export function EventProvider({
  sessionId,
  children,
}: {
  sessionId: string;
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshApplicants = useCallback(async () => {
    try {
      const data = await api.listApplicants(sessionId);
      setApplicants(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch applicants");
    }
  }, [sessionId]);

  const refreshStats = useCallback(async () => {
    try {
      const data = await api.getStats(sessionId);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch stats");
    }
  }, [sessionId]);

  const refreshAll = useCallback(async () => {
    setError(null);
    try {
      const [sessionData, applicantsData, statsData] = await Promise.all([
        api.getSession(sessionId),
        api.listApplicants(sessionId),
        api.getStats(sessionId),
      ]);
      setSession(sessionData);
      setApplicants(applicantsData);
      setStats(statsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch event data");
    }
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [sessionData, applicantsData, statsData] = await Promise.all([
          api.getSession(sessionId),
          api.listApplicants(sessionId),
          api.getStats(sessionId),
        ]);
        if (cancelled) return;
        setSession(sessionData);
        setApplicants(applicantsData);
        setStats(statsData);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to fetch event data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
    <EventContext.Provider
      value={{
        sessionId,
        session,
        applicants,
        stats,
        loading,
        error,
        refreshApplicants,
        refreshStats,
        refreshAll,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

export function useEvent() {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error("useEvent must be used within EventProvider");
  return ctx;
}
