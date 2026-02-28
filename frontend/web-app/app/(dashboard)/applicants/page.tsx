"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { ApplicantTable } from "@/components/applicant-table";
import { useApplicants } from "@/hooks/use-applicants";

const statusFilters = ["all", "pending", "accepted", "rejected", "waitlisted"];

export default function ApplicantsPage() {
  const { applicants, loading, refresh } = useApplicants();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return applicants.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          a.name?.toLowerCase().includes(q) ||
          a.email?.toLowerCase().includes(q) ||
          a.company?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [applicants, statusFilter, search]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Applicants</h2>
        <p className="text-muted-foreground">
          {applicants.length} total applicants
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            {statusFilters.map((s) => (
              <TabsTrigger key={s} value={s} className="capitalize">
                {s}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <ApplicantTable applicants={filtered} onRefresh={refresh} />
      )}
    </div>
  );
}
