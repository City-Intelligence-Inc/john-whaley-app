"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ApplicantCard } from "@/components/applicant-card";
import { ReviewActions } from "@/components/review-actions";
import { api, type Applicant } from "@/lib/api";

export default function ReviewPage() {
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [animating, setAnimating] = useState<"left" | "right" | "down" | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const all = await api.listApplicants();
        setApplicants(all.filter((a) => a.status === "pending"));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load applicants");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const current = applicants[currentIndex];
  const total = applicants.length;
  const reviewed = currentIndex;

  const handleAction = useCallback(
    async (status: string, direction: "left" | "right" | "down") => {
      if (!current || acting) return;
      setActing(true);
      setAnimating(direction);

      try {
        await api.batchUpdateStatus([current.applicant_id], status);
        setTimeout(() => {
          setAnimating(null);
          setCurrentIndex((i) => i + 1);
          setActing(false);
        }, 300);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update status");
        setAnimating(null);
        setActing(false);
      }
    },
    [current, acting]
  );

  const handleReject = useCallback(() => handleAction("rejected", "left"), [handleAction]);
  const handleWaitlist = useCallback(() => handleAction("waitlisted", "down"), [handleAction]);
  const handleAccept = useCallback(() => handleAction("accepted", "right"), [handleAction]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case "ArrowLeft":
          handleReject();
          break;
        case "ArrowDown":
          handleWaitlist();
          break;
        case "ArrowRight":
          handleAccept();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleReject, handleWaitlist, handleAccept]);

  const handleReviewComplete = (updated: Applicant) => {
    setApplicants((prev) =>
      prev.map((a) => (a.applicant_id === updated.applicant_id ? updated : a))
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (total === 0) {
    return (
      <div className="text-center py-24">
        <h2 className="text-2xl font-bold mb-2">No Pending Applicants</h2>
        <p className="text-muted-foreground">
          Upload a CSV to get started, or all applicants have been reviewed.
        </p>
      </div>
    );
  }

  if (currentIndex >= total) {
    return (
      <div className="text-center py-24">
        <h2 className="text-2xl font-bold mb-2">All Done!</h2>
        <p className="text-muted-foreground">
          You&apos;ve reviewed all {total} pending applicants.
        </p>
      </div>
    );
  }

  const animationClass = animating
    ? animating === "left"
      ? "animate-out slide-out-to-left fade-out duration-300"
      : animating === "right"
        ? "animate-out slide-out-to-right fade-out duration-300"
        : "animate-out slide-out-to-bottom fade-out duration-300"
    : "animate-in slide-in-from-bottom fade-in duration-300";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Review</h2>
          <span className="text-sm text-muted-foreground">
            Reviewing {reviewed + 1} of {total} pending
          </span>
        </div>
        <Progress value={(reviewed / total) * 100} />
      </div>

      <div className="text-center text-xs text-muted-foreground">
        Keyboard: ← Reject &middot; ↓ Waitlist &middot; → Accept
      </div>

      <div className={animationClass}>
        <ApplicantCard
          applicant={current}
          onReviewComplete={handleReviewComplete}
        />
      </div>

      <ReviewActions
        onReject={handleReject}
        onWaitlist={handleWaitlist}
        onAccept={handleAccept}
        disabled={acting}
      />
    </div>
  );
}
