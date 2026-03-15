"use client";

import React from "react";
import { EventProvider } from "@/components/event-provider";

export default function EventLayout({
  params,
  children,
}: {
  params: Promise<{ sessionId: string }>;
  children: React.ReactNode;
}) {
  const { sessionId } = React.use(params);

  return <EventProvider sessionId={sessionId}>{children}</EventProvider>;
}
