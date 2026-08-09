import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DEMO_ACCOUNT } from "@/data/demo-workspace";

const demoSubjects = [
  ["1:1 this week?", "Can we find thirty minutes to align on the product direction and next milestones?"],
  ["Sprint planning - Monday 10 AM", "Sharing the agenda before Monday's planning session. Please add anything we missed."],
  ["Re: InboxIQ product feedback", "The relationship intelligence direction is promising. Let's discuss the next iteration."],
  ["Project review notes", "Attached are the notes and action items from our latest review."],
  ["Quick follow-up on the roadmap", "Following up with the decisions and owners from our roadmap conversation."],
  ["Demo feedback and next steps", "The demo landed well. Here are the questions and next steps we captured."],
  ["Research sync", "Can we compare findings and decide what should move into the next experiment?"],
  ["Re: Design review", "I reviewed the latest screens and left a few focused comments for the next pass."],
  ["Weekly progress update", "A concise update on completed work, open questions, and priorities for this week."],
  ["Calendar confirmation", "Confirming the time and agenda for our upcoming conversation."],
] as const;

const demoMessages = Array.from({ length: 100 }, (_, index) => {
  const academic = index % 2 === 1;
  const template = demoSubjects[index % demoSubjects.length];
  return {
    id: `demo-${index + 1}`,
    subject: index < demoSubjects.length ? template[0] : `${template[0]} - ${Math.floor(index / demoSubjects.length) + 1}`,
    snippet: template[1],
    sender: academic ? "Ishan Tiwari - IIITG" : "Ishan Tiwari",
    email: academic ? "ishan.tiwari23b@iiitg.ac.in" : "ishan11032005@gmail.com",
    direction: index % 4 === 2 ? "sent" : "received",
    occurredAt: new Date(Date.now() - (index + 1) * 43_200_000).toISOString(),
    category: academic ? "Academic" : "Work",
    priority: index % 5 === 0 ? "High" : index % 3 === 0 ? "Low" : "Medium",
  };
});

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const messages = await db.mailMessage.findMany({ where: { mailbox: { userId: user.id } }, include: { participants: true }, orderBy: { occurredAt: "desc" } });
  const storedMessages = messages.map((message) => {
    const preferredRole = message.direction === "received" ? "from" : "to";
    const participant = message.participants.find((item) => item.role === preferredRole) ?? message.participants[0];
    return { id: message.id, subject: message.subject || "(no subject)", snippet: message.snippet || "No preview available", sender: participant?.name || participant?.email || "Unknown sender", email: participant?.email || "", direction: message.direction, occurredAt: message.occurredAt, category: message.category || "Unclassified", priority: message.priority || "Normal" };
  });
  if (user.email === DEMO_ACCOUNT.internalEmail) {
    const liveMailbox = await db.mailbox.findFirst({
      where: { userId: user.id, provider: "gmail", refreshTokenEncrypted: { not: null } },
      select: { id: true },
    });
    if (liveMailbox) return NextResponse.json({ messages: storedMessages, demo: true, live: true });
    return NextResponse.json({ messages: demoMessages, demo: true, live: false });
  }
  return NextResponse.json({ messages: storedMessages });
}
