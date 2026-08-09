import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { preciseRelativeTime } from "@/domain/relationship";

export async function GET() {
  const user = await currentUser(); if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [contacts, sequences, mailbox, messageCount] = await Promise.all([
    db.contact.findMany({ where: { userId: user.id }, include: { company: true }, orderBy: { lastInteractionAt: "desc" }, take: 500 }),
    db.sequence.findMany({ where: { userId: user.id }, include: { steps: true, enrollments: { include: { deliveries: true } } }, orderBy: { updatedAt: "desc" }, take: 100 }),
    db.mailbox.findFirst({ where: { userId: user.id, provider: "gmail" }, orderBy: { updatedAt: "desc" }, select: { provider: true, email: true, syncStatus: true, lastSyncedAt: true } }),
    db.mailMessage.count({ where: { mailbox: { userId: user.id } } }),
  ]);
  const hues = ["cyan", "violet", "pink", "amber"];
  return NextResponse.json({
    mailbox,
    metrics: { people: contacts.length, conversations: messageCount, strong: contacts.filter((contact) => contact.strengthScore >= 75).length, attention: contacts.filter((contact) => contact.strengthScore < 45).length },
    people: contacts.map((contact, index) => ({ name: contact.displayName, mail: contact.primaryEmail, company: contact.company?.name ?? "Independent", type: contact.category, score: contact.strengthScore, strength: contact.strengthLabel, time: contact.lastInteractionAt ? preciseRelativeTime(contact.lastInteractionAt) : "No contact", direction: contact.lastReceivedAt && (!contact.lastSentAt || contact.lastReceivedAt > contact.lastSentAt) ? "Received" : "Sent", messages: contact.sentCount + contact.receivedCount, threads: contact.threadCount, hue: hues[index % hues.length] })),
    sequences: sequences.map((sequence, index) => { const deliveries = sequence.enrollments.flatMap((enrollment) => enrollment.deliveries); const sent = deliveries.filter((delivery) => delivery.status === "SENT").length; const replies = sequence.enrollments.filter((enrollment) => enrollment.status === "REPLIED").length; return { name: sequence.name, detail: `${sequence.enrollments.length} recipients · ${sequence.steps.length} steps`, status: sequence.status === "ACTIVE" ? "LIVE" : sequence.status, enrolled: sequence.enrollments.length, replies, rate: sequence.enrollments.length ? `${Math.round(replies / sequence.enrollments.length * 100)}%` : "—", next: deliveries.find((delivery) => delivery.status === "PENDING")?.scheduledFor ? `Next ${preciseRelativeTime(deliveries.find((delivery) => delivery.status === "PENDING")!.scheduledFor)}` : sent ? `${sent} sent` : "No pending sends", hue: hues[index % hues.length] }; }),
  });
}
