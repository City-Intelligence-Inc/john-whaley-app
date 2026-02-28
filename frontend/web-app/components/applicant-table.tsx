"use client";

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/status-badge";
import { api, type Applicant } from "@/lib/api";

interface ApplicantTableProps {
  applicants: Applicant[];
  onRefresh: () => void;
}

export function ApplicantTable({ applicants, onRefresh }: ApplicantTableProps) {
  const [updating, setUpdating] = useState<string | null>(null);

  const handleStatusChange = async (id: string, status: string) => {
    console.log("[ApplicantTable] Status change clicked:", id, "->", status);
    setUpdating(id);
    try {
      await api.updateApplicant(id, { status });
      toast.success(`Status updated to ${status}`);
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (id: string) => {
    console.log("[ApplicantTable] Delete clicked:", id);
    try {
      await api.deleteApplicant(id);
      toast.success("Applicant deleted");
      onRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  if (applicants.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No applicants found
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {applicants.map((applicant) => (
            <TableRow key={applicant.applicant_id}>
              <TableCell className="font-medium">
                <Link
                  href={`/applicants/${applicant.applicant_id}`}
                  className="hover:underline"
                >
                  {applicant.name || "—"}
                </Link>
              </TableCell>
              <TableCell>{applicant.email || "—"}</TableCell>
              <TableCell>{applicant.company || "—"}</TableCell>
              <TableCell>{applicant.title || "—"}</TableCell>
              <TableCell>{applicant.location || "—"}</TableCell>
              <TableCell>
                <StatusBadge status={applicant.status} />
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={updating === applicant.applicant_id}
                    >
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link href={`/applicants/${applicant.applicant_id}`}>
                        <ExternalLink className="size-4 mr-2" />
                        View Details
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleStatusChange(applicant.applicant_id, "accepted")}>
                      Accept
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange(applicant.applicant_id, "rejected")}>
                      Reject
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange(applicant.applicant_id, "waitlisted")}>
                      Waitlist
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange(applicant.applicant_id, "pending")}>
                      Reset to Pending
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={() => handleDelete(applicant.applicant_id)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
