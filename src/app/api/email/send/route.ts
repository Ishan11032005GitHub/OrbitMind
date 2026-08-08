import { NextResponse } from "next/server";
import { z } from "zod";
import { encryptPrivateContext, fingerprint } from "@/domain/privacy";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { buildRawEmail, gmailAccessToken } from "@/lib/gmail";
import { rateLimit } from "@/lib/rate-limit";

const email = z.string().trim().email().transform((value) => value.toLowerCase());
const schema = z.object({
  to: z.array(email).min(1).max(50),
  cc: z.array(email).max(50).default([]),
  bcc: z.array(email).max(50).default([]),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(100_000),
  threadId: z.string().trim().max(500).optional(),
});

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rate = rateLimit(`email-send:${user.id}`, 30, 60_000); if (!rate.allowed) return NextResponse.json({ error: "Too many send requests. Try again shortly." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid email" }, { status: 400 });
  const input = parsed.data;
  const unique = new Set<string>();
  const dedupe = (values: string[]) => values.filter((value) => !unique.has(value) && unique.add(value));
  const to = dedupe(input.to), cc = dedupe(input.cc), bcc = dedupe(input.bcc);

  if (user.email === "demo@stealth.local") return NextResponse.json({ ok: true, simulated: true, message: `Demo send simulated for ${to.length + cc.length + bcc.length} recipients.` });
  try {
    const { mailbox, token } = await gmailAccessToken(user.id);
    const raw = buildRawEmail({ from: mailbox.email, to, cc, bcc, subject: input.subject, body: input.body });
    const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ raw, ...(input.threadId ? { threadId: input.threadId } : {}) }), cache: "no-store" });
    if (!response.ok) {
      const details = await response.text();
      console.error("Gmail send failed", response.status, details.slice(0, 300));
      return NextResponse.json({ error: response.status === 401 ? "Reconnect Gmail and try again." : "Gmail could not send this message." }, { status: 502 });
    }
    const sent = await response.json() as { id: string; threadId: string };
    const occurredAt = new Date();
    const thread = await db.mailThread.upsert({ where: { mailboxId_providerId: { mailboxId: mailbox.id, providerId: sent.threadId } }, update: { subject: input.subject, lastMessageAt: occurredAt }, create: { mailboxId: mailbox.id, providerId: sent.threadId, subject: input.subject, lastMessageAt: occurredAt } });
    const message = await db.mailMessage.upsert({ where: { mailboxId_providerId: { mailboxId: mailbox.id, providerId: sent.id } }, update: {}, create: { mailboxId: mailbox.id, threadId: thread.id, providerId: sent.id, direction: "sent", subject: input.subject, snippet: input.body.slice(0, 240), bodyEncrypted: encryptPrivateContext({ body: input.body }, env().PRIVATE_CONTEXT_ENCRYPTION_KEY), bodyFingerprint: fingerprint(input.body, user.id), occurredAt } });
    const participants = [{ email: mailbox.email, role: "from" }, ...to.map((value) => ({ email: value, role: "to" })), ...cc.map((value) => ({ email: value, role: "cc" })), ...bcc.map((value) => ({ email: value, role: "bcc" }))];
    await db.messageParticipant.createMany({ data: participants.map((participant) => ({ messageId: message.id, ...participant })), skipDuplicates: true });
    for (const recipient of [...to, ...cc, ...bcc]) await db.contact.upsert({ where: { userId_primaryEmail: { userId: user.id, primaryEmail: recipient } }, update: { sentCount: { increment: 1 }, lastSentAt: occurredAt, lastInteractionAt: occurredAt }, create: { userId: user.id, primaryEmail: recipient, displayName: recipient.split("@")[0], category: "Email recipient", sentCount: 1, threadCount: 1, lastSentAt: occurredAt, lastInteractionAt: occurredAt } });
    return NextResponse.json({ ok: true, id: sent.id, threadId: sent.threadId });
  } catch (cause) {
    const code = cause instanceof Error ? cause.message : "";
    if (code === "GMAIL_NOT_CONNECTED") return NextResponse.json({ error: "Connect Gmail before sending email." }, { status: 409 });
    if (code === "GMAIL_RECONNECT_REQUIRED") return NextResponse.json({ error: "Reconnect Gmail and grant email access." }, { status: 401 });
    console.error("Email send failed", cause);
    return NextResponse.json({ error: "Email could not be sent." }, { status: 500 });
  }
}
