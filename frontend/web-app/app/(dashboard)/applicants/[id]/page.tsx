"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { ApplicantCard } from "@/components/applicant-card";
import { useApplicant } from "@/hooks/use-applicants";
import { api, type Applicant } from "@/lib/api";

export default function ApplicantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { applicant, loading, refresh } = useApplicant(id);
  const [deleting, setDeleting] = useState(false);

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

  const handleReviewComplete = (updated: Applicant) => {
    refresh();
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.push("/applicants")}>
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
                {deleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Applicant</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete {applicant.name || "this applicant"}? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <ApplicantCard
        applicant={applicant}
        onReviewComplete={handleReviewComplete}
      />
    </div>
  );
}
