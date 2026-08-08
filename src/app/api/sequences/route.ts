import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { currentUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";

const stepSchema = z.object({
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(50_000),
  scheduledAt: z.string().datetime(),
});
const recipientList = z.array(z.string().trim().email().transform((value) => value.toLowerCase())).max(100);

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  to: recipientList.refine((items) => items.length > 0, "Add at least one To recipient."),
  cc: recipientList.default([]),
  bcc: recipientList.default([]),
  threadMode: z.enum(["new", "existing"]),
  threadId: z.string().trim().max(500).optional(),
  timezone: z.string().trim().min(1).max(100),
  steps: z.array(stepSchema).min(1).max(100),
}).superRefine((value, context) => {
  if (value.threadMode === "existing" && !value.threadId) context.addIssue({ code: "custom", path: ["threadId"], message: "Choose or enter a thread." });
  const times = value.steps.map((step) => Date.parse(step.scheduledAt));
  if (times.some((time) => !Number.isFinite(time) || time <= Date.now())) context.addIssue({ code: "custom", path: ["steps"], message: "Every scheduled time must be in the future." });
  if (times.some((time, index) => index > 0 && time <= times[index - 1])) context.addIssue({ code: "custom", path: ["steps"], message: "Sequence steps must be scheduled in chronological order." });
});

export async function GET() {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sequences = await db.sequence.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, include: { steps: { orderBy: { position: "asc" } }, enrollments: { include: { deliveries: true } } } });
  return NextResponse.json({ sequences: sequences.map((sequence) => { const deliveries = sequence.enrollments.flatMap((item) => item.deliveries); const next = deliveries.filter((item) => item.status === "PENDING").sort((a,b) => a.scheduledFor.getTime()-b.scheduledFor.getTime())[0]; return { id: sequence.id, name: sequence.name, status: sequence.status, timezone: sequence.timezone, stepCount: sequence.steps.length, enrolled: sequence.enrollments.length, replied: sequence.enrollments.filter((item) => item.status === "REPLIED").length, sent: deliveries.filter((item) => item.status === "SENT").length, nextRunAt: next?.scheduledFor ?? null }; }) });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rate = rateLimit(`sequence-create:${user.id}`, 15, 60_000); if (!rate.allowed) return NextResponse.json({ error: "Too many sequence requests." }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid sequence" }, { status: 400 });

  const input = parsed.data;
  const sendingEnabled = env().ENABLE_SEQUENCE_SENDING === "true" && user.email !== "demo@stealth.local";
  const scheduled = input.steps.map((step) => new Date(step.scheduledAt));
  const result = await db.$transaction(async (tx) => {
    const contacts = await Promise.all(input.to.map((recipientEmail) => tx.contact.upsert({
      where: { userId_primaryEmail: { userId: user.id, primaryEmail: recipientEmail } },
      update: {},
      create: { userId: user.id, primaryEmail: recipientEmail, displayName: recipientEmail.split("@")[0], category: "Sequence recipient" },
    })));
    const sequence = await tx.sequence.create({
      data: {
        userId: user.id,
        name: input.name,
        status: sendingEnabled ? "ACTIVE" : "DRAFT",
        timezone: input.timezone,
        stopOnReply: true,
        steps: { create: input.steps.map((step, index) => ({
          position: index + 1,
          delayMinutes: index === 0 ? 0 : Math.round((scheduled[index].getTime() - scheduled[index - 1].getTime()) / 60_000),
          subject: step.subject,
          body: step.body,
          sameThread: input.threadMode === "existing" || index > 0,
        })) },
      },
      include: { steps: { orderBy: { position: "asc" } } },
    });
    for (const contact of contacts) {
      const enrollment = await tx.enrollment.create({ data: { sequenceId: sequence.id, contactId: contact.id, status: sendingEnabled ? "ACTIVE" : "PAUSED", nextRunAt: scheduled[0] } });
      await tx.delivery.createMany({ data: sequence.steps.map((step, index) => ({ enrollmentId: enrollment.id, stepId: step.id, idempotencyKey: randomUUID(), status: "PENDING", scheduledFor: scheduled[index] })) });
      await tx.intelligenceRecord.create({ data: { userId: user.id, contactId: contact.id, kind: "sequence-addressing", version: "1", evidence: { sequenceId: sequence.id, mode: input.threadMode, providerThreadId: input.threadId || null, to: [contact.primaryEmail], cc: input.cc, bcc: input.bcc } } });
    }
    return sequence;
  });

  return NextResponse.json({ id: result.id, name: result.name, stepCount: result.steps.length, recipientCount: input.to.length, sendingEnabled, status: result.status }, { status: 201 });
}
