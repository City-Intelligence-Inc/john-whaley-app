"use client";

import { useState } from "react";
import {
  ExternalLink,
  Linkedin,
  MapPin,
  Building2,
  Briefcase,
  Mail,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/status-badge";
import { api, type Applicant, type ReviewRequest } from "@/lib/api";

interface ApplicantCardProps {
  applicant: Applicant;
  onReviewComplete?: (updated: Applicant) => void;
  showActions?: boolean;
}

function getAIConfig(): { api_key: string; model: string; provider: string } | null {
  if (typeof window === "undefined") return null;
  const key = localStorage.getItem("ai_api_key");
  const provider = localStorage.getItem("ai_provider") || "anthropic";
  const model = localStorage.getItem("ai_model") || "claude-sonnet-4-20250514";
  if (!key) return null;
  return { api_key: key, model, provider };
}

export function ApplicantCard({ applicant, onReviewComplete, showActions = true }: ApplicantCardProps) {
  const [reviewing, setReviewing] = useState(false);

  const handleReview = async () => {
    const config = getAIConfig();
    if (!config) {
      toast.error("Please configure your AI API key in Settings first");
      return;
    }

    setReviewing(true);
    try {
      const settings = await api.getPromptSettings();
      const reviewData: ReviewRequest = {
        ...config,
        prompt: settings.default_prompt,
        criteria: settings.criteria,
      };
      const updated = await api.reviewApplicant(applicant.applicant_id, reviewData);
      onReviewComplete?.(updated);
      toast.success("AI review completed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Review failed");
    } finally {
      setReviewing(false);
    }
  };

  // Gather extra fields (not standard ones)
  const standardFields = new Set([
    "applicant_id", "name", "email", "linkedin_url", "company",
    "title", "location", "status", "ai_review",
  ]);
  const extraFields = Object.entries(applicant).filter(
    ([k, v]) => !standardFields.has(k) && v
  );

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-xl">{applicant.name || "Unknown"}</CardTitle>
            {applicant.title && applicant.company && (
              <p className="text-sm text-muted-foreground mt-1">
                {applicant.title} @ {applicant.company}
              </p>
            )}
          </div>
          <StatusBadge status={applicant.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          {applicant.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="size-4 text-muted-foreground" />
              <a href={`mailto:${applicant.email}`} className="hover:underline">
                {applicant.email}
              </a>
            </div>
          )}
          {applicant.linkedin_url && (
            <div className="flex items-center gap-2 text-sm">
              <Linkedin className="size-4 text-muted-foreground" />
              <a
                href={applicant.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline flex items-center gap-1"
              >
                LinkedIn Profile
                <ExternalLink className="size-3" />
              </a>
            </div>
          )}
          {applicant.company && (
            <div className="flex items-center gap-2 text-sm">
              <Building2 className="size-4 text-muted-foreground" />
              <span>{applicant.company}</span>
            </div>
          )}
          {applicant.title && (
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="size-4 text-muted-foreground" />
              <span>{applicant.title}</span>
            </div>
          )}
          {applicant.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="size-4 text-muted-foreground" />
              <span>{applicant.location}</span>
            </div>
          )}
        </div>

        {extraFields.length > 0 && (
          <>
            <Separator />
            <div className="grid gap-2">
              {extraFields.map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 text-sm">
                  <span className="font-medium text-muted-foreground min-w-[100px]">
                    {key.replace(/_/g, " ")}:
                  </span>
                  <span>{String(value)}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {applicant.ai_review && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-1">
                <Sparkles className="size-4" />
                AI Review
              </p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {applicant.ai_review}
              </p>
            </div>
          </>
        )}

        {showActions && (
          <>
            <Separator />
            <Button
              variant="outline"
              className="w-full"
              onClick={handleReview}
              disabled={reviewing}
            >
              {reviewing ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Running AI Review...
                </>
              ) : (
                <>
                  <Sparkles className="size-4 mr-2" />
                  {applicant.ai_review ? "Re-run AI Review" : "Run AI Review"}
                </>
              )}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
