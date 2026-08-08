import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { processDueDeliveries } from "@/lib/sequence-worker";
import { safeEqual } from "@/lib/auth/session";

export async function POST(request: Request) {
  const config = env(); if (!config.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  const authorization = request.headers.get("authorization") ?? ""; const expected = `Bearer ${config.CRON_SECRET}`;
  if (!safeEqual(authorization, expected)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (config.ENABLE_SEQUENCE_SENDING !== "true") return NextResponse.json({ disabled: true, message: "Sequence sending is disabled." });
  return NextResponse.json(await processDueDeliveries());
}

