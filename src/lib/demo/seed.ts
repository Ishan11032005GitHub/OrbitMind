import { db } from "@/lib/db";
import { configureLiveDemoMailbox } from "@/lib/demo/gmail";

const DEMO_EMAIL = "demoinboxiq@gmail.com";
const senders = [
  {
    email: "ishan11032005@gmail.com",
    name: "Ishan Tiwari",
    company: "Personal network",
    domain: "gmail.com",
    category: "Work · General",
    score: 86,
    strength: "Strong",
    minutesAgo: 12,
  },
  {
    email: "ishan.tiwari23b@iiitg.ac.in",
    name: "Ishan Tiwari · IIITG",
    company: "IIIT Guwahati",
    domain: "iiitg.ac.in",
    category: "Work · Academic",
    score: 78,
    strength: "Growing",
    minutesAgo: 128,
  },
];

export async function seedInboxIqDemo(userId: string) {
  const now = Date.now();
  await configureLiveDemoMailbox(userId);
  const liveMailbox = await db.mailbox.findFirst({
    where: { userId, provider: "gmail", refreshTokenEncrypted: { not: null } },
    select: { id: true },
  });
  if (liveMailbox) return;
  await db.mailbox.upsert({
    where: {
      userId_provider_email: { userId, provider: "demo", email: DEMO_EMAIL },
    },
    update: { syncStatus: "synced", lastSyncedAt: new Date() },
    create: {
      userId,
      provider: "demo",
      email: DEMO_EMAIL,
      syncStatus: "synced",
      lastSyncedAt: new Date(),
    },
  });

  for (const sender of senders) {
    const company = await db.company.upsert({
      where: { userId_domain: { userId, domain: sender.domain } },
      update: { name: sender.company },
      create: {
        userId,
        name: sender.company,
        domain: sender.domain,
        confidence: 1,
        source: "inboxiq-v2-demo",
      },
    });
    const lastInteractionAt = new Date(now - sender.minutesAgo * 60_000);
    await db.contact.upsert({
      where: { userId_primaryEmail: { userId, primaryEmail: sender.email } },
      update: {
        displayName: sender.name,
        companyId: company.id,
        category: sender.category,
        receivedCount: 50,
        threadCount: 50,
        lastReceivedAt: lastInteractionAt,
        lastInteractionAt,
        strengthScore: sender.score,
        strengthLabel: sender.strength,
      },
      create: {
        userId,
        primaryEmail: sender.email,
        displayName: sender.name,
        companyId: company.id,
        category: sender.category,
        receivedCount: 50,
        threadCount: 50,
        lastReceivedAt: lastInteractionAt,
        lastInteractionAt,
        strengthScore: sender.score,
        strengthLabel: sender.strength,
        strengthExplanation: { source: "InboxIQ-v2 demo corpus", messages: 50 },
      },
    });
  }

  if ((await db.sequence.count({ where: { userId } })) === 0) {
    await db.sequence.create({
      data: {
        userId,
        name: "Meeting follow-ups",
        status: "ACTIVE",
        timezone: "Asia/Kolkata",
        steps: {
          create: [
            {
              position: 1,
              delayMinutes: 0,
              subject: "Re: {{last_subject}}",
              body: "Hi {{first_name}}, following up on our meeting thread. Does the suggested time still work?",
              sameThread: true,
            },
            {
              position: 2,
              delayMinutes: 1440,
              subject: null,
              body: "Just bringing this back to the top of your inbox.",
              sameThread: true,
            },
            {
              position: 3,
              delayMinutes: 4320,
              subject: null,
              body: "Closing the loop for now. Send a time whenever convenient.",
              sameThread: true,
            },
          ],
        },
      },
    });
    await db.sequence.create({
      data: {
        userId,
        name: "High-priority work",
        status: "ACTIVE",
        timezone: "Asia/Kolkata",
        steps: {
          create: [
            {
              position: 1,
              delayMinutes: 0,
              subject: "Re: {{last_subject}}",
              body: "I reviewed your message and wanted to confirm the next action.",
              sameThread: true,
            },
            {
              position: 2,
              delayMinutes: 2880,
              subject: null,
              body: "A quick follow-up so this high-priority item does not get lost.",
              sameThread: true,
            },
          ],
        },
      },
    });
    await db.sequence.create({
      data: {
        userId,
        name: "Re-engage quiet threads",
        status: "DRAFT",
        timezone: "Asia/Kolkata",
        steps: {
          create: [
            {
              position: 1,
              delayMinutes: 0,
              subject: "Checking in",
              body: "It has been a while since our last conversation. How have things been?",
              sameThread: true,
            },
          ],
        },
      },
    });
  }
}
