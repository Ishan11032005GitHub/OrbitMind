/** Client-safe demo metadata. Never import Prisma or other server modules here. */
export const DEMO_ACCOUNT = {
  internalEmail: "demo@stealth.local",
  displayEmail: "demoinboxiq@gmail.com",
  displayName: "InboxIQ Demo",
} as const;

export const demoSequences = [
  { name: "Meeting follow-ups", detail: "Scheduling emails · 3 steps", status: "LIVE", enrolled: 30, replies: 13, rate: "43%", next: "6 follow-ups today", hue: "cyan" },
  { name: "High-priority work", detail: "Priority inbox · 2 steps", status: "LIVE", enrolled: 35, replies: 18, rate: "51%", next: "9 follow-ups tomorrow", hue: "violet" },
  { name: "Re-engage quiet threads", detail: "No reply in 14 days · AI draft", status: "DRAFT", enrolled: 12, replies: 0, rate: "—", next: "Awaiting review", hue: "pink" },
] as const;
