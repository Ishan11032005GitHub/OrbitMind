import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { DEMO_ACCOUNT } from "@/data/demo-workspace";

const demoMessages = [
  { id: "demo-1", subject: "1:1 this week?", snippet: "Can we find thirty minutes to align on the product direction and next milestones?", sender: "Ishan Tiwari", email: "ishan11032005@gmail.com", direction: "received", occurredAt: new Date(Date.now() - 43_200_000).toISOString(), category: "Work", priority: "High" },
  { id: "demo-2", subject: "Sprint planning — Monday 10 AM", snippet: "Sharing the agenda before Monday's planning session. Please add anything we missed.", sender: "Ishan Tiwari · IIITG", email: "ishan.tiwari23b@iiitg.ac.in", direction: "received", occurredAt: new Date(Date.now() - 50_580_000).toISOString(), category: "Academic", priority: "Medium" },
  { id: "demo-3", subject: "Re: InboxIQ product feedback", snippet: "The relationship intelligence direction is promising. Let's discuss the next iteration.", sender: "Ishan Tiwari", email: "ishan11032005@gmail.com", direction: "sent", occurredAt: new Date(Date.now() - 86_400_000).toISOString(), category: "Work", priority: "High" },
  { id: "demo-4", subject: "Project review notes", snippet: "Attached are the notes and action items from our latest review.", sender: "Ishan Tiwari · IIITG", email: "ishan.tiwari23b@iiitg.ac.in", direction: "received", occurredAt: new Date(Date.now() - 172_800_000).toISOString(), category: "Academic", priority: "Low" },
];

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.email === DEMO_ACCOUNT.internalEmail) return NextResponse.json({ messages: demoMessages, demo: true });
  const messages = await db.mailMessage.findMany({ where: { mailbox: { userId: user.id } }, include: { participants: true }, orderBy: { occurredAt: "desc" } });
  return NextResponse.json({ messages: messages.map((message) => {
    const preferredRole = message.direction === "received" ? "from" : "to";
    const participant = message.participants.find((item) => item.role === preferredRole) ?? message.participants[0];
    return { id: message.id, subject: message.subject || "(no subject)", snippet: message.snippet || "No preview available", sender: participant?.name || participant?.email || "Unknown sender", email: participant?.email || "", direction: message.direction, occurredAt: message.occurredAt, category: message.category || "Unclassified", priority: message.priority || "Normal" };
  }) });
}
