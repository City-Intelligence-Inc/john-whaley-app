"use client";

import { use } from "react";
import { EventProvider } from "@/components/event-provider";

export default function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  return <EventProvider sessionId={sessionId}>{children}</EventProvider>;
}
