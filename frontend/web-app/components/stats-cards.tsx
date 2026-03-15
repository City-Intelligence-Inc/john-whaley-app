"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { Stats, Applicant } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

export interface StatsCardsProps {
  stats: Stats | null;
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  applicants: Applicant[];
}

/* ------------------------------------------------------------------ */
/*  Config                                                            */
/* ------------------------------------------------------------------ */

interface CardDef {
  label: string;
  filter: string;
  color: string;
}

const CARDS: CardDef[] = [
  { label: "Total", filter: "all", color: "text-foreground" },
  { label: "Accepted", filter: "accepted", color: "text-emerald-400" },
  { label: "Waitlisted", filter: "waitlisted", color: "text-amber-400" },
  { label: "Rejected", filter: "rejected", color: "text-red-400" },
  { label: "Pending", filter: "pending", color: "text-muted-foreground" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function StatsCards({
  stats,
  activeFilter,
  onFilterChange,
  applicants,
}: StatsCardsProps) {
  const counts = useMemo(() => {
    const accepted = applicants.filter((a) => a.status === "accepted").length;
    const waitlisted = applicants.filter(
      (a) => a.status === "waitlisted",
    ).length;
    const rejected = applicants.filter((a) => a.status === "rejected").length;
    const pending = applicants.filter((a) => a.status === "pending").length;

    return {
      all: stats?.total ?? applicants.length,
      accepted,
      waitlisted,
      rejected,
      pending,
    };
  }, [stats, applicants]);

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-3">
      {CARDS.map(({ label, filter, color }) => (
        <Card
          key={filter}
          className={`cursor-pointer transition-colors hover:bg-muted/50 ${
            activeFilter === filter ? "ring-1 ring-gold/60" : ""
          }`}
          onClick={() => onFilterChange(filter)}
        >
          <CardContent className="py-4 text-center">
            <div className={`text-3xl font-bold tabular-nums ${color}`}>
              {counts[filter as keyof typeof counts] ?? 0}
            </div>
            <div className="text-sm text-muted-foreground mt-1">{label}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
