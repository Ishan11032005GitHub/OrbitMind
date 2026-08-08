import { db } from "@/lib/db";

export const DEMO_ACCOUNT = {
  internalEmail: "demo@stealth.local",
  displayEmail: "demoinboxiq@gmail.com",
  displayName: "InboxIQ Demo",
};

export const demoPeople = [
  {
    name: "Ishan Tiwari",
    mail: "ishan11032005@gmail.com",
    company: "Personal network",
    type: "Work · General",
    score: 86,
    strength: "Strong",
    time: "12m ago",
    direction: "Received",
    messages: 50,
    threads: 50,
    hue: "cyan",
    categories: "29 work · 9 notifications · 5 general · 7 other",
    priorities: "21 high · 19 medium · 10 low",
    recentSubject: "1:1 this week?",
  },
  {
    name: "Ishan Tiwari · IIITG",
    mail: "ishan.tiwari23b@iiitg.ac.in",
    company: "IIIT Guwahati",
    type: "Work · Academic",
    score: 78,
    strength: "Growing",
    time: "2h 8m ago",
    direction: "Received",
    messages: 50,
    threads: 50,
    hue: "violet",
    categories: "19 work · 13 general · 8 notifications · 10 other",
    priorities: "14 high · 16 medium · 20 low",
    recentSubject: "Sprint planning — Monday 10 AM",
  },
] as const;

export const demoSequences = [
  {
    name: "Meeting follow-ups",
    detail: "Scheduling emails · 3 steps",
    status: "LIVE",
    enrolled: 30,
    replies: 13,
    rate: "43%",
    next: "6 follow-ups today",
    hue: "cyan",
  },
  {
    name: "High-priority work",
    detail: "Priority inbox · 2 steps",
    status: "LIVE",
    enrolled: 35,
    replies: 18,
    rate: "51%",
    next: "9 follow-ups tomorrow",
    hue: "violet",
  },
  {
    name: "Re-engage quiet threads",
    detail: "No reply in 14 days · AI draft",
    status: "DRAFT",
    enrolled: 12,
    replies: 0,
    rate: "—",
    next: "Awaiting review",
    hue: "pink",
  },
] as const;

const personSeeds = [
  {
    email: demoPeople[0].mail,
    displayName: demoPeople[0].name,
    category: "work",
    companyName: "Personal network",
    companyDomain: "gmail.com",
    score: 86,
    label: "Strong",
    received: 50,
  },
  {
    email: demoPeople[1].mail,
    displayName: demoPeople[1].name,
    category: "work",
    companyName: "IIIT Guwahati",
    companyDomain: "iiitg.ac.in",
    score: 78,
    label: "Growing",
    received: 50,
  },
];

const sequenceSeeds = [
  {
    name: "Meeting follow-ups",
    status: "ACTIVE" as const,
    steps: [
      {
        position: 1,
        delayMinutes: 0,
        subject: "Re: {{last_subject}}",
        body: "Hi {{first_name}}, following up on our meeting thread. Does the suggested time still work?",
      },
      {
        position: 2,
        delayMinutes: 1440,
        subject: "Re: {{last_subject}}",
        body: "Just bringing this back to the top of your inbox. I can adapt to another time if needed.",
      },
      {
        position: 3,
        delayMinutes: 4320,
        subject: "Re: {{last_subject}}",
        body: "Closing the loop for now. Feel free to send a time whenever it becomes convenient.",
      },
    ],
  },
  {
    name: "High-priority work",
    status: "ACTIVE" as const,
    steps: [
      {
        position: 1,
        delayMinutes: 0,
        subject: "Re: {{last_subject}}",
        body: "Hi {{first_name}}, I reviewed your message and wanted to confirm the next action.",
      },
      {
        position: 2,
        delayMinutes: 2880,
        subject: "Re: {{last_subject}}",
        body: "A quick follow-up so this high-priority item does not get lost.",
      },
    ],
  },
  {
    name: "Re-engage quiet threads",
    status: "DRAFT" as const,
    steps: [
      {
        position: 1,
        delayMinutes: 0,
        subject: "Checking in",
        body: "Hi {{first_name}}, it has been a while since our last conversation. How have things been?",
      },
    ],
  },
];

export async function seedDemoWorkspace(userId: string) {
  const now = Date.now();
  for (const [index, seed] of personSeeds.entries()) {
    const company = await db.company.upsert({
      where: { userId_domain: { userId, domain: seed.companyDomain } },
      update: {
        name: seed.companyName,
        confidence: 1,
        source: "inboxiq-v2-demo",
      },
      create: {
        userId,
        name: seed.companyName,
        domain: seed.companyDomain,
        confidence: 1,
        source: "inboxiq-v2-demo",
      },
    });
    await db.contact.upsert({
      where: { userId_primaryEmail: { userId, primaryEmail: seed.email } },
      update: {
        displayName: seed.displayName,
        category: seed.category,
        companyId: company.id,
        strengthScore: seed.score,
        strengthLabel: seed.label,
        receivedCount: seed.received,
        threadCount: seed.received,
        lastReceivedAt: new Date(now - (index ? 7_680_000 : 720_000)),
        lastInteractionAt: new Date(now - (index ? 7_680_000 : 720_000)),
      },
      create: {
        userId,
        primaryEmail: seed.email,
        displayName: seed.displayName,
        category: seed.category,
        companyId: company.id,
        strengthScore: seed.score,
        strengthLabel: seed.label,
        receivedCount: seed.received,
        threadCount: seed.received,
        lastReceivedAt: new Date(now - (index ? 7_680_000 : 720_000)),
        lastInteractionAt: new Date(now - (index ? 7_680_000 : 720_000)),
        strengthExplanation: {
          source: "InboxIQ-v2 demo corpus",
          receivedMessages: seed.received,
        },
      },
    });
  }

  for (const seed of sequenceSeeds) {
    let sequence = await db.sequence.findFirst({
      where: { userId, name: seed.name },
    });
    if (!sequence) {
      sequence = await db.sequence.create({
        data: {
          userId,
          name: seed.name,
          status: seed.status,
          timezone: "Asia/Kolkata",
          stopOnReply: true,
        },
      });
    } else {
      await db.sequence.update({
        where: { id: sequence.id },
        data: {
          status: seed.status,
          timezone: "Asia/Kolkata",
          stopOnReply: true,
        },
      });
    }
    await db.sequenceStep.deleteMany({ where: { sequenceId: sequence.id } });
    await db.sequenceStep.createMany({
      data: seed.steps.map((step) => ({
        ...step,
        sequenceId: sequence!.id,
        sameThread: true,
      })),
    });
  }
}
