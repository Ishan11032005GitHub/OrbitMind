import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { classifyEmail } from "@/domain/email-classification";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const messages = await db.mailMessage.findMany({ where: { mailbox: { userId: user.id, provider: "gmail" } }, include: { participants: true }, orderBy: { occurredAt: "desc" } });
  const storedMessages = messages.map((message) => {
    const preferredRole = message.direction === "received" ? "from" : "to";
    const participant = message.participants.find((item) => item.role === preferredRole) ?? message.participants[0];
    const classification = classifyEmail(message.subject ?? "", message.snippet ?? "");
    return { id: message.id, subject: message.subject || "(no subject)", snippet: message.snippet || "No preview available", sender: participant?.name || participant?.email || "Unknown sender", email: participant?.email || "", direction: message.direction, occurredAt: message.occurredAt, category: message.category || classification.category, priority: message.priority || classification.priority };
  });
  return NextResponse.json({ messages: storedMessages });
}
