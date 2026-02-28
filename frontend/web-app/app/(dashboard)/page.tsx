"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Timer,
  Upload,
  Brain,
  ListChecks,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useStats } from "@/hooks/use-applicants";
import { api } from "@/lib/api";

export default function DashboardPage() {
  const { stats, loading, refresh } = useStats();
  const [clearing, setClearing] = useState(false);

  const handleClearAll = async () => {
    console.log("[Dashboard] Clear Database clicked");
    setClearing(true);
    try {
      const result = await api.deleteAllApplicants();
      toast.success(`Cleared ${result.deleted} applicants from database`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear database");
    } finally {
      setClearing(false);
    }
  };

  const statCards = [
    { title: "Total", value: stats?.total, icon: Users, color: "text-foreground" },
    { title: "Pending", value: stats?.pending, icon: Clock, color: "text-yellow-500" },
    { title: "Accepted", value: stats?.accepted, icon: CheckCircle2, color: "text-green-500" },
    { title: "Rejected", value: stats?.rejected, icon: XCircle, color: "text-red-500" },
    { title: "Waitlisted", value: stats?.waitlisted, icon: Timer, color: "text-blue-500" },
  ];

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Manage and review your event applicants
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={clearing || stats?.total === 0}>
              <Trash2 className="size-4 mr-2" />
              {clearing ? "Clearing..." : "Clear Database"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="size-5 text-destructive" />
                Clear Entire Database
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all {stats?.total || 0} applicants and their reviews.
                This action cannot be undone. Are you sure you want to start from scratch?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearAll}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Yes, Delete Everything
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`size-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-3xl font-bold">{card.value ?? 0}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="size-4" />
              Step 1: Upload
            </CardTitle>
            <CardDescription>Upload a CSV of applicants or add them manually</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/upload">Upload Applicants</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Brain className="size-4" />
              Step 2: Analyze
            </CardTitle>
            <CardDescription>Set your criteria and let AI rank all applicants</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" variant={stats?.total ? "default" : "secondary"} disabled={!stats?.total}>
              <Link href="/analyze">Run AI Analysis</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="size-4" />
              Step 3: Review
            </CardTitle>
            <CardDescription>Review ranked results: accept, waitlist, or reject</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full" variant="outline">
              <Link href="/results">View Results</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
