"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trash2,
  Loader2,
  ExternalLink,
  Linkedin,
  Mail,
  Building2,
  Briefcase,
  MapPin,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/status-badge";
import { useApplicant } from "@/hooks/use-applicants";
import { api, type Applicant, type ReviewRequest } from "@/lib/api";

export default function ApplicantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { applicant, loading, refresh } = useApplicant(id);
  const [deleting, setDeleting] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const handleStatusChange = async (status: string) => {
    try {
      await api.updateApplicant(id, { status });
      toast.success(`Status updated to ${status}`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteApplicant(id);
      toast.success("Applicant deleted");
      router.push("/applicants");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
      setDeleting(false);
    }
  };

  const handleReview = async () => {
    const apiKey = localStorage.getItem("ai_api_key");
    const provider = localStorage.getItem("ai_provider") || "anthropic";
    const model = localStorage.getItem("ai_model") || "claude-sonnet-4-20250514";
    if (!apiKey) {
      toast.error("Configure your AI API key in Settings first");
      return;
    }
    setReviewing(true);
    try {
      const settings = await api.getPromptSettings();
      const data: ReviewRequest = {
        api_key: apiKey,
        model,
        provider,
        prompt: settings.default_prompt,
        criteria: settings.criteria,
      };
      await api.reviewApplicant(id, data);
      toast.success("AI review complete");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Review failed");
    } finally {
      setReviewing(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!applicant) {
    return (
      <div className="text-center py-24">
        <h2 className="text-2xl font-bold mb-2">Applicant Not Found</h2>
        <Button variant="outline" onClick={() => router.push("/applicants")}>
          Back to Applicants
        </Button>
      </div>
    );
  }

  const standardFields = new Set([
    "applicant_id", "name", "email", "linkedin_url", "company",
    "title", "location", "status", "ai_review", "ai_score",
    "ai_reasoning", "social_platform",
  ]);
  const extraFields = Object.entries(applicant).filter(
    ([k, v]) => !standardFields.has(k) && v
  );

  const score = applicant.ai_score ? parseInt(applicant.ai_score) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="size-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          <Select value={applicant.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="waitlisted">Waitlisted</SelectItem>
            </SelectContent>
          </Select>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon" disabled={deleting}>
                {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Applicant</AlertDialogTitle>
                <AlertDialogDescription>
                  Permanently delete {applicant.name || "this applicant"}? This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card>
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
            <div className="flex items-center gap-2">
              {score !== null && (
                <Badge variant="outline" className="text-base font-bold tabular-nums">
                  Score: {score}
                </Badge>
              )}
              <StatusBadge status={applicant.status} />
            </div>
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
                  className="hover:underline flex items-center gap-1 text-blue-600 dark:text-blue-400"
                >
                  LinkedIn Profile <ExternalLink className="size-3" />
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

          {(applicant.ai_reasoning || applicant.ai_review) && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-1">
                  <Sparkles className="size-4" />
                  AI Assessment
                </p>
                {applicant.ai_reasoning && (
                  <p className="text-sm text-muted-foreground mb-2">{applicant.ai_reasoning}</p>
                )}
                {applicant.ai_review && (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{applicant.ai_review}</p>
                )}
              </div>
            </>
          )}

          <Separator />
          <Button variant="outline" className="w-full" onClick={handleReview} disabled={reviewing}>
            {reviewing ? (
              <><Loader2 className="size-4 mr-2 animate-spin" /> Running AI Review...</>
            ) : (
              <><Sparkles className="size-4 mr-2" /> Run Individual AI Review</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
