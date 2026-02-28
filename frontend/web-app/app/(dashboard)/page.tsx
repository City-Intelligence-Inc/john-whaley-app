"use client";

import Link from "next/link";
import {
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Timer,
  Upload,
  PlayCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStats } from "@/hooks/use-applicants";

export default function DashboardPage() {
  const { stats, loading } = useStats();

  const cards = [
    { title: "Total", value: stats?.total, icon: Users, color: "text-foreground" },
    { title: "Pending", value: stats?.pending, icon: Clock, color: "text-yellow-600" },
    { title: "Accepted", value: stats?.accepted, icon: CheckCircle2, color: "text-green-600" },
    { title: "Rejected", value: stats?.rejected, icon: XCircle, color: "text-red-600" },
    { title: "Waitlisted", value: stats?.waitlisted, icon: Timer, color: "text-blue-600" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Overview of your event applicants
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className={`size-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="text-2xl font-bold">{card.value ?? 0}</div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <Button asChild className="w-full" variant="outline">
              <Link href="/upload">
                <Upload className="size-4 mr-2" />
                Upload CSV
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Button asChild className="w-full">
              <Link href="/review">
                <PlayCircle className="size-4 mr-2" />
                Start Reviewing
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Button asChild className="w-full" variant="outline">
              <Link href="/applicants">
                <Users className="size-4 mr-2" />
                View All Applicants
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
