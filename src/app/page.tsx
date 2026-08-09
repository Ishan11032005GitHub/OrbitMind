import { redirect } from "next/navigation";
import Dashboard from "@/components/dashboard";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { preciseRelativeTime } from "@/domain/relationship";
import { DEMO_ACCOUNT } from "@/data/demo-workspace";

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const connectedMailbox = await db.mailbox.findFirst({
    where: { userId: user.id, provider: "gmail", accessTokenEncrypted: { not: null } },
    select: { id: true },
  });
  if (!connectedMailbox)
    redirect(user.email === DEMO_ACCOUNT.internalEmail ? "/api/auth/google?mode=demo" : "/api/auth/google");
  const [contacts, storedSequences] = await Promise.all([
    db.contact.findMany({
      where: { userId: user.id },
      include: { company: true },
      orderBy: { lastInteractionAt: "desc" },
      take: 100,
    }),
    db.sequence.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: { steps: true, enrollments: true },
    }),
  ]);
  const hues = ["cyan", "violet", "pink", "amber"];
  const initialPeople = contacts.map((contact, index) => ({
    name: contact.displayName,
    mail: contact.primaryEmail,
    company: contact.company?.name ?? "Independent",
    type: contact.category,
    score: contact.strengthScore,
    strength: contact.strengthLabel,
    time: contact.lastInteractionAt
      ? preciseRelativeTime(contact.lastInteractionAt)
      : "No contact",
    direction:
      contact.lastReceivedAt &&
      (!contact.lastSentAt || contact.lastReceivedAt > contact.lastSentAt)
        ? "Received"
        : "Sent",
    messages: contact.sentCount + contact.receivedCount,
    threads: contact.threadCount,
    hue: hues[index % hues.length],
  }));
  const initialSequences = storedSequences.map((sequence, index) => ({
    name: sequence.name,
    detail: `${sequence.enrollments.length} recipients · ${sequence.steps.length} steps`,
    status: sequence.status === "ACTIVE" ? "LIVE" : sequence.status,
    enrolled: sequence.enrollments.length,
    replies: sequence.enrollments.filter((item) => item.status === "REPLIED")
      .length,
    rate: sequence.enrollments.length
      ? `${Math.round((sequence.enrollments.filter((item) => item.status === "REPLIED").length / sequence.enrollments.length) * 100)}%`
      : "—",
    next:
      sequence.status === "ACTIVE"
        ? "Delivery schedule active"
        : "Awaiting activation",
    hue: ["cyan", "violet", "pink", "amber"][index % 4],
  }));
  return (
    <Dashboard
      user={{
        name: user.displayName,
        email: user.email,
        avatarUrl: user.pictureUrl,
      }}
      initialPeople={initialPeople}
      initialSequences={initialSequences}
    />
  );
}
