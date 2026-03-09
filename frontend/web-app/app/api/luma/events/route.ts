import { NextRequest, NextResponse } from "next/server";

const LUMA_BASE = "https://public-api.luma.com";

export async function GET(req: NextRequest) {
  const apiKey = req.headers.get("x-luma-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 401 });
  }

  const url = new URL("/v1/calendar/list-events", LUMA_BASE);
  // Forward supported query params
  for (const key of ["before", "after", "pagination_cursor", "pagination_limit", "sort_column", "sort_direction"]) {
    const val = req.nextUrl.searchParams.get(key);
    if (val) url.searchParams.set(key, val);
  }

  const res = await fetch(url.toString(), {
    headers: { "x-luma-api-key": apiKey },
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
