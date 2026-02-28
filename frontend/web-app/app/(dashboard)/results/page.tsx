"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
  ArrowRightLeft,
  ExternalLink,
  Linkedin,
  Mail,
  Building2,
  MapPin,
  Sparkles,
  Users,
  Brain,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { api, type Applicant } from "@/lib/api";
import { useApplicants } from "@/hooks/use-applicants";

function ApplicantRow({
  applicant,
  rank,
  onStatusChange,
}: {
  applicant: Applicant;
  rank: number;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const score = applicant.ai_score ? parseInt(applicant.ai_score) : 0;
  const scoreColor =
    score >= 70 ? "text-green-600 dark:text-green-400" :
    score >= 40 ? "text-yellow-600 dark:text-yellow-400" :
    "text-red-600 dark:text-red-400";

  return (
    <div className="border rounded-lg">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="text-sm font-mono text-muted-foreground w-6 text-right shrink-0">
          {rank}.
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{applicant.name || "Unknown"}</span>
            {applicant.title && applicant.company && (
              <span className="text-xs text-muted-foreground truncate hidden sm:inline">
                {applicant.title} @ {applicant.company}
              </span>
            )}
          </div>
        </div>
        {score > 0 && (
          <span className={`text-sm font-bold tabular-nums ${scoreColor}`}>
            {score}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-7 text-xs">
              <ArrowRightLeft className="size-3 mr-1" />
              Move
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onStatusChange(applicant.applicant_id, "accepted")}>
              <CheckCircle2 className="size-4 mr-2 text-green-500" />
              Should Attend
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange(applicant.applicant_id, "waitlisted")}>
              <Clock className="size-4 mr-2 text-yellow-500" />
              Move to Waitlist
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onStatusChange(applicant.applicant_id, "rejected")}>
              <XCircle className="size-4 mr-2 text-red-500" />
              Reject
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {expanded ? (
          <ChevronUp className="size-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground shrink-0" />
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t bg-muted/30">
          <div className="grid gap-2 text-sm ml-9">
            {applicant.email && (
              <div className="flex items-center gap-2">
                <Mail className="size-3.5 text-muted-foreground" />
                <a href={`mailto:${applicant.email}`} className="hover:underline">
                  {applicant.email}
                </a>
              </div>
            )}
            {applicant.linkedin_url && (
              <div className="flex items-center gap-2">
                <Linkedin className="size-3.5 text-muted-foreground" />
                <a
                  href={applicant.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center gap-1 text-blue-600 dark:text-blue-400"
                >
                  LinkedIn Profile
                  <ExternalLink className="size-3" />
                </a>
              </div>
            )}
            {applicant.company && (
              <div className="flex items-center gap-2">
                <Building2 className="size-3.5 text-muted-foreground" />
                <span>{applicant.title ? `${applicant.title} @ ${applicant.company}` : applicant.company}</span>
              </div>
            )}
            {applicant.location && (
              <div className="flex items-center gap-2">
                <MapPin className="size-3.5 text-muted-foreground" />
                <span>{applicant.location}</span>
              </div>
            )}
            {applicant.ai_reasoning && (
              <div className="flex items-start gap-2 mt-1">
                <Sparkles className="size-3.5 text-muted-foreground mt-0.5" />
                <p className="text-muted-foreground italic">{applicant.ai_reasoning}</p>
              </div>
            )}
            <div className="mt-1">
              <Link
                href={`/applicants/${applicant.applicant_id}`}
                className="text-xs text-primary hover:underline"
              >
                View full profile →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResultSection({
  title,
  icon: Icon,
  iconColor,
  applicants,
  onStatusChange,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  applicants: Applicant[];
  onStatusChange: (id: string, status: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  // Sort by AI score descending
  const sorted = useMemo(
    () =>
      [...applicants].sort((a, b) => {
        const sa = a.ai_score ? parseInt(a.ai_score) : 0;
        const sb = b.ai_score ? parseInt(b.ai_score) : 0;
        return sb - sa;
      }),
    [applicants]
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center gap-2 cursor-pointer group mb-3">
          <Icon className={`size-5 ${iconColor}`} />
          <h3 className="text-lg font-semibold">{title}</h3>
          <Badge variant="secondary" className="ml-1">
            {applicants.length}
          </Badge>
          <div className="flex-1" />
          {open ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-2 mb-6">
          {sorted.map((a, i) => (
            <ApplicantRow
              key={a.applicant_id}
              applicant={a}
              rank={i + 1}
              onStatusChange={onStatusChange}
            />
          ))}
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No applicants in this category
            </p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function ResultsPage() {
  const { applicants, loading, refresh } = useApplicants();

  const accepted = useMemo(
    () => applicants.filter((a) => a.status === "accepted"),
    [applicants]
  );
  const waitlisted = useMemo(
    () => applicants.filter((a) => a.status === "waitlisted"),
    [applicants]
  );
  const rejected = useMemo(
    () => applicants.filter((a) => a.status === "rejected"),
    [applicants]
  );
  const pending = useMemo(
    () => applicants.filter((a) => a.status === "pending"),
    [applicants]
  );

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await api.updateApplicant(id, { status });
      toast.success(`Moved to ${status}`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (applicants.length === 0) {
    return (
      <div className="max-w-3xl mx-auto text-center py-24 space-y-4">
        <Users className="size-12 text-muted-foreground mx-auto" />
        <h2 className="text-2xl font-bold">No Applicants Yet</h2>
        <p className="text-muted-foreground">Upload applicants and run AI analysis first.</p>
        <Button asChild>
          <Link href="/upload">Upload Applicants</Link>
        </Button>
      </div>
    );
  }

  const hasAnalysis = applicants.some((a) => a.ai_score);

  if (!hasAnalysis) {
    return (
      <div className="max-w-3xl mx-auto text-center py-24 space-y-4">
        <Brain className="size-12 text-muted-foreground mx-auto" />
        <h2 className="text-2xl font-bold">Analysis Not Run Yet</h2>
        <p className="text-muted-foreground">
          You have {applicants.length} applicants. Run AI analysis to rank and categorize them.
        </p>
        <Button asChild>
          <Link href="/analyze">Run AI Analysis</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analysis Results</h2>
          <p className="text-muted-foreground">
            Based on our analysis, we&apos;ve identified the most promising candidates.
            Use the &quot;Move&quot; button to reclassify anyone.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/analyze">Re-analyze</Link>
        </Button>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="py-3">
          <div className="flex items-center justify-around text-center text-sm">
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{accepted.length}</div>
              <div className="text-muted-foreground">Should Attend</div>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{waitlisted.length}</div>
              <div className="text-muted-foreground">Waitlisted</div>
            </div>
            <Separator orientation="vertical" className="h-10" />
            <div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{rejected.length}</div>
              <div className="text-muted-foreground">Rejected</div>
            </div>
            {pending.length > 0 && (
              <>
                <Separator orientation="vertical" className="h-10" />
                <div>
                  <div className="text-2xl font-bold text-muted-foreground">{pending.length}</div>
                  <div className="text-muted-foreground">Pending</div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <ResultSection
        title="Should Attend"
        icon={CheckCircle2}
        iconColor="text-green-500"
        applicants={accepted}
        onStatusChange={handleStatusChange}
      />

      <ResultSection
        title="Waitlist"
        icon={Clock}
        iconColor="text-yellow-500"
        applicants={waitlisted}
        onStatusChange={handleStatusChange}
      />

      <ResultSection
        title="Rejected"
        icon={XCircle}
        iconColor="text-red-500"
        applicants={rejected}
        onStatusChange={handleStatusChange}
        defaultOpen={false}
      />

      {pending.length > 0 && (
        <ResultSection
          title="Pending (Not Yet Analyzed)"
          icon={Users}
          iconColor="text-muted-foreground"
          applicants={pending}
          onStatusChange={handleStatusChange}
          defaultOpen={false}
        />
      )}
    </div>
  );
}
