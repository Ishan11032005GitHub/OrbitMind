import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { syncGmailBatch } from "@/lib/gmail-sync";

const schema = z.object({ pageToken: z.string().max(2_000).optional(), batchSize: z.number().int().min(10).max(100).default(50) });
export async function POST(request: Request) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.email === "demo@stealth.local") return NextResponse.json({ imported: 100, nextPageToken: null, estimatedTotal: 100, complete: true, demo: true });
  const parsed = schema.safeParse(await request.json().catch(() => ({}))); if (!parsed.success) return NextResponse.json({ error: "Invalid sync request" }, { status: 400 });
  try { return NextResponse.json(await syncGmailBatch(user.id, parsed.data.pageToken, parsed.data.batchSize)); } catch (cause) { const code = cause instanceof Error ? cause.message : ""; return NextResponse.json({ error: code === "GMAIL_RECONNECT_REQUIRED" ? "Reconnect Gmail to continue syncing." : "Gmail synchronization failed." }, { status: code === "GMAIL_RECONNECT_REQUIRED" ? 401 : 502 }); }
}

