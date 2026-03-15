"use client";

import {
  CheckCircle2,
  Clock,
  XCircle,
  Mail,
  Linkedin,
  Building2,
  MapPin,
  ExternalLink,
  Users,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { Applicant } from "@/lib/api";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function scoreColorClass(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-yellow-600";
  return "text-red-600";
}

/** Keys already rendered in dedicated sections -- skip in "All Fields". */
const SKIP_KEYS = new Set([
  "applicant_id",
  "session_id",
  "name",
  "email",
  "status",
  "ai_score",
  "ai_reasoning",
  "ai_review",
  "company",
  "title",
  "location",
  "linkedin_url",
  "attendee_type",
  "attendee_type_detail",
  "panel_votes",
  "accepting_judges",
]);

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

export interface ApplicantDetailSheetProps {
  applicant: Applicant | null;
  /**
   * Called when the user clicks Accept / Waitlist / Reject.
   * Can accept either (id, status) or just (status) -- both are supported.
   */
  onStatusChange: (idOrStatus: string, status?: string) => void;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function ApplicantDetailSheet({
  applicant,
  onStatusChange,
  onClose,
}: ApplicantDetailSheetProps) {
  if (!applicant) return null;

  const score = applicant.ai_score ? parseInt(applicant.ai_score) : 0;
  const scc = scoreColorClass(score);

  const name =
    applicant.name ||
    applicant.email ||
    (applicant.title && applicant.company
      ? `${applicant.title} @ ${applicant.company}`
      : null) ||
    applicant.company ||
    "Unknown";

  const subtitle =
    applicant.title && applicant.company
      ? `${applicant.title} @ ${applicant.company}`
      : applicant.title || applicant.company || undefined;

  const changeStatus = (status: string) => {
    onStatusChange(applicant.applicant_id, status);
  };

  const extraFields = Object.entries(applicant)
    .filter(([k]) => !SKIP_KEYS.has(k))
    .filter(([, v]) => v != null && String(v).trim() !== "");

  return (
    <Sheet
      open={!!applicant}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">{name}</SheetTitle>
          {subtitle && (
            <SheetDescription className="text-base">
              {subtitle}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="space-y-5 px-4 pb-6">
          {/* ── Score + Status + Type ── */}
          <div className="flex items-center gap-3 flex-wrap">
            {score > 0 && (
              <span className={`text-3xl font-bold tabular-nums ${scc}`}>
                {score}
              </span>
            )}
            <Badge
              variant={
                applicant.status === "accepted"
                  ? "default"
                  : applicant.status === "rejected"
                    ? "destructive"
                    : "secondary"
              }
              className="text-sm"
            >
              {applicant.status.charAt(0).toUpperCase() +
                applicant.status.slice(1)}
            </Badge>
            {applicant.attendee_type && (
              <Badge variant="outline" className="text-sm">
                {applicant.attendee_type_detail || applicant.attendee_type}
              </Badge>
            )}
          </div>

          {/* ── Status actions ── */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={
                applicant.status === "accepted" ? "default" : "outline"
              }
              onClick={() => changeStatus("accepted")}
              className="text-sm"
            >
              <CheckCircle2 className="size-4 mr-1 text-green-500" />
              Accept
            </Button>
            <Button
              size="sm"
              variant={
                applicant.status === "waitlisted" ? "default" : "outline"
              }
              onClick={() => changeStatus("waitlisted")}
              className="text-sm"
            >
              <Clock className="size-4 mr-1 text-yellow-500" />
              Waitlist
            </Button>
            <Button
              size="sm"
              variant={
                applicant.status === "rejected" ? "default" : "outline"
              }
              onClick={() => changeStatus("rejected")}
              className="text-sm"
            >
              <XCircle className="size-4 mr-1 text-red-500" />
              Reject
            </Button>
          </div>

          <Separator />

          {/* ── Contact info ── */}
          <div className="grid gap-2.5 text-base">
            {applicant.email && (
              <div className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground shrink-0" />
                <a
                  href={`mailto:${applicant.email}`}
                  className="hover:underline truncate"
                >
                  {applicant.email}
                </a>
              </div>
            )}
            {applicant.linkedin_url && (
              <div className="flex items-center gap-2">
                <Linkedin className="size-4 text-muted-foreground shrink-0" />
                <a
                  href={applicant.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center gap-1 text-blue-600 dark:text-blue-400"
                >
                  LinkedIn Profile
                  <ExternalLink className="size-3.5" />
                </a>
              </div>
            )}
            {applicant.company && (
              <div className="flex items-center gap-2">
                <Building2 className="size-4 text-muted-foreground shrink-0" />
                <span>
                  {applicant.title
                    ? `${applicant.title} @ ${applicant.company}`
                    : applicant.company}
                </span>
              </div>
            )}
            {applicant.location && (
              <div className="flex items-center gap-2">
                <MapPin className="size-4 text-muted-foreground shrink-0" />
                <span>{applicant.location}</span>
              </div>
            )}
          </div>

          {/* ── Panel votes ── */}
          {applicant.panel_votes && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  Panel Decision
                </h4>
                <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Users className="size-4 text-primary shrink-0" />
                    <span className="text-sm font-medium">
                      {String(applicant.panel_votes)} judges accepted
                    </span>
                  </div>
                  {applicant.accepting_judges && (
                    <p className="text-xs text-muted-foreground pl-6">
                      {String(applicant.accepting_judges)}
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── AI assessment ── */}
          {applicant.ai_reasoning && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  AI Assessment
                </h4>
                <div className="rounded-lg bg-muted/50 p-4">
                  <div className="flex items-start gap-2">
                    <Sparkles className="size-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-base leading-relaxed">
                      {applicant.ai_reasoning}
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── All extra fields ── */}
          {extraFields.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  All Fields
                </h4>
                <div className="grid gap-1.5 text-sm">
                  {extraFields.map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-muted-foreground font-medium min-w-[120px] shrink-0">
                        {k.replace(/_/g, " ")}:
                      </span>
                      <span className="break-words">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
