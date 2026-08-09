import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { preciseRelativeTime } from "@/domain/relationship";
import { classifyEmail } from "@/domain/email-classification";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [contacts, sequences, mailbox, messages, threadCount] = await Promise.all([
    db.contact.findMany({ where: { userId: user.id }, include: { company: true }, orderBy: { lastInteractionAt: "desc" }, take: 500 }),
    db.sequence.findMany({ where: { userId: user.id }, include: { steps: true, enrollments: { include: { deliveries: true } } }, orderBy: { updatedAt: "desc" }, take: 100 }),
    db.mailbox.findFirst({ where: { userId: user.id, provider: "gmail" }, orderBy: { updatedAt: "desc" }, select: { provider: true, email: true, syncStatus: true, lastSyncedAt: true } }),
    db.mailMessage.findMany({ where: { mailbox: { userId: user.id, provider: "gmail" } }, select: { direction: true, category: true, priority: true, subject: true, snippet: true } }),
    db.mailThread.count({ where: { mailbox: { userId: user.id, provider: "gmail" } } }),
  ]);

  const analyzedMessages = messages.map((message) => {
    const fallback = classifyEmail(message.subject ?? "", message.snippet ?? "");
    return {
      direction: message.direction,
      category: message.category ?? fallback.category,
      priority: message.priority ?? fallback.priority,
    };
  });
  const categoryCounts = analyzedMessages.reduce<Record<string, number>>((counts, message) => {
    counts[message.category] = (counts[message.category] ?? 0) + 1;
    return counts;
  }, {});
  const metrics = {
    people: contacts.length,
    messages: analyzedMessages.length,
    conversations: analyzedMessages.length,
    threads: threadCount,
    received: analyzedMessages.filter((message) => message.direction === "received").length,
    sent: analyzedMessages.filter((message) => message.direction === "sent").length,
    strong: contacts.filter((contact) => contact.strengthScore >= 75).length,
    attention: contacts.filter((contact) => contact.strengthScore < 45).length,
    highPriority: analyzedMessages.filter((message) => message.priority === "High").length,
    categories: categoryCounts,
  };
  const hues = ["cyan", "violet", "pink", "amber"];

  return NextResponse.json({
    mailbox,
    metrics,
    metricDefinitions: {
      people: "Unique external email addresses mapped from Gmail participants.",
      messages: "Individual Gmail messages imported into OrbitMind.",
      threads: "Unique Gmail conversation threads containing those messages.",
      received: "Imported messages whose sender is outside the connected mailbox.",
      sent: "Imported messages sent by the connected mailbox.",
      strong: "Relationships with an email-derived health score of 75 or higher.",
      attention: "Relationships with an email-derived health score below 45.",
      highPriority: "Important/starred Gmail messages or messages containing urgent or security signals.",
    },
    people: contacts.map((contact, index) => ({
      name: contact.displayName,
      mail: contact.primaryEmail,
      company: contact.company?.name ?? "Independent",
      type: contact.category,
      score: contact.strengthScore,
      strength: contact.strengthLabel,
      time: contact.lastInteractionAt ? preciseRelativeTime(contact.lastInteractionAt) : "No contact",
      direction: contact.lastReceivedAt && (!contact.lastSentAt || contact.lastReceivedAt > contact.lastSentAt) ? "Received" : "Sent",
      messages: contact.sentCount + contact.receivedCount,
      sent: contact.sentCount,
      received: contact.receivedCount,
      threads: contact.threadCount,
      scoreFactors: Array.isArray(contact.strengthExplanation)
        ? contact.strengthExplanation
        : typeof contact.strengthExplanation === "object" && contact.strengthExplanation && "factors" in contact.strengthExplanation
          ? (contact.strengthExplanation as { factors?: unknown }).factors
          : contact.strengthExplanation,
      hue: hues[index % hues.length],
    })),
    sequences: sequences.map((sequence, index) => {
      const deliveries = sequence.enrollments.flatMap((enrollment) => enrollment.deliveries);
      const sent = deliveries.filter((delivery) => delivery.status === "SENT").length;
      const replies = sequence.enrollments.filter((enrollment) => enrollment.status === "REPLIED").length;
      const nextDelivery = deliveries.find((delivery) => delivery.status === "PENDING");
      return {
        name: sequence.name,
        detail: `${sequence.enrollments.length} recipients · ${sequence.steps.length} steps`,
        status: sequence.status === "ACTIVE" ? "LIVE" : sequence.status,
        enrolled: sequence.enrollments.length,
        replies,
        rate: sequence.enrollments.length ? `${Math.round((replies / sequence.enrollments.length) * 100)}%` : "—",
        next: nextDelivery?.scheduledFor ? `Next ${preciseRelativeTime(nextDelivery.scheduledFor)}` : sent ? `${sent} sent` : "No pending sends",
        hue: hues[index % hues.length],
      };
    }),
  });
}
