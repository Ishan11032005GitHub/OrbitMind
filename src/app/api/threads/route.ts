import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url); const email = url.searchParams.get("email")?.trim().toLowerCase(); const query = url.searchParams.get("q")?.trim();
  const mailboxes = await db.mailbox.findMany({ where: { userId: user.id }, select: { id: true } });
  const threads = await db.mailThread.findMany({ where: { mailboxId: { in: mailboxes.map((item) => item.id) }, ...(query ? { subject: { contains: query, mode: "insensitive" } } : {}), ...(email ? { messages: { some: { participants: { some: { email } } } } } : {}) }, orderBy: { lastMessageAt: "desc" }, take: 30, include: { messages: { orderBy: { occurredAt: "desc" }, take: 1, include: { participants: true } } } });
  return NextResponse.json({ threads: threads.map((thread) => ({ id: thread.providerId, subject: thread.subject || "(no subject)", lastMessageAt: thread.lastMessageAt, snippet: thread.messages[0]?.snippet || "", participants: [...new Set(thread.messages[0]?.participants.map((item) => item.email) ?? [])] })) });
}

