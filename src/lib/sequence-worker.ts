import { db } from "@/lib/db";
import { sendGmailMessage } from "@/lib/gmail";

type Addressing = { mode?: "new" | "existing"; providerThreadId?: string | null; cc?: string[]; bcc?: string[] };
const providerParts = (value?: string | null) => { const [messageId, threadId] = value?.split("|") ?? []; return { messageId, threadId }; };

export async function processDueDeliveries(limit = 25) {
  const due = await db.delivery.findMany({ where: { status: "PENDING", scheduledFor: { lte: new Date() }, enrollment: { status: "ACTIVE", sequence: { status: "ACTIVE" } } }, orderBy: { scheduledFor: "asc" }, take: Math.min(100, limit), include: { step: true, enrollment: { include: { contact: true, sequence: true } } } });
  const results = { claimed: 0, sent: 0, failed: 0, skipped: 0 };
  for (const delivery of due) {
    const claimed = await db.delivery.updateMany({ where: { id: delivery.id, status: "PENDING" }, data: { status: "CLAIMED", attemptCount: { increment: 1 } } });
    if (!claimed.count) continue; results.claimed++;
    try {
      const sequence = delivery.enrollment.sequence;
      const addressingRecord = await db.intelligenceRecord.findFirst({ where: { userId: sequence.userId, kind: "sequence-addressing", evidence: { path: ["to"], array_contains: delivery.enrollment.contact.primaryEmail } }, orderBy: { createdAt: "desc" } });
      const addressing = (addressingRecord?.evidence ?? {}) as Addressing;
      const previous = await db.delivery.findFirst({ where: { enrollmentId: delivery.enrollmentId, status: "SENT", providerId: { not: null } }, orderBy: { sentAt: "desc" } });
      const threadId = addressing.mode === "existing" ? addressing.providerThreadId ?? undefined : providerParts(previous?.providerId).threadId;
      const sent = await sendGmailMessage({ userId: sequence.userId, to: [delivery.enrollment.contact.primaryEmail], cc: addressing.cc ?? [], bcc: addressing.bcc ?? [], subject: delivery.step.subject || "", body: delivery.step.body, threadId });
      await db.delivery.update({ where: { id: delivery.id }, data: { status: "SENT", sentAt: new Date(), providerId: `${sent.id}|${sent.threadId}`, error: null } });
      const next = await db.delivery.findFirst({ where: { enrollmentId: delivery.enrollmentId, status: "PENDING" }, orderBy: { scheduledFor: "asc" } });
      await db.enrollment.update({ where: { id: delivery.enrollmentId }, data: { currentStep: { increment: 1 }, nextRunAt: next?.scheduledFor ?? null, status: next ? "ACTIVE" : "COMPLETED" } });
      results.sent++;
    } catch (cause) {
      const error = cause instanceof Error ? cause.message.slice(0, 500) : "Unknown delivery error"; const terminal = delivery.attemptCount + 1 >= 3;
      await db.delivery.update({ where: { id: delivery.id }, data: { status: terminal ? "FAILED" : "PENDING", error } });
      if (terminal) await db.enrollment.update({ where: { id: delivery.enrollmentId }, data: { status: "FAILED" } });
      results.failed++;
    }
  }
  return results;
}

export async function stopSequencesForReply(userId: string, providerThreadId: string, repliedAt: Date) {
  const sent = await db.delivery.findMany({ where: { status: "SENT", providerId: { endsWith: `|${providerThreadId}` }, enrollment: { sequence: { userId, stopOnReply: true }, status: "ACTIVE" } }, select: { enrollmentId: true } });
  const enrollmentIds = [...new Set(sent.map((item) => item.enrollmentId))]; if (!enrollmentIds.length) return 0;
  await db.$transaction([db.enrollment.updateMany({ where: { id: { in: enrollmentIds } }, data: { status: "REPLIED", repliedAt, nextRunAt: null } }), db.delivery.updateMany({ where: { enrollmentId: { in: enrollmentIds }, status: "PENDING" }, data: { status: "CANCELLED", error: "Reply received" } })]);
  return enrollmentIds.length;
}

