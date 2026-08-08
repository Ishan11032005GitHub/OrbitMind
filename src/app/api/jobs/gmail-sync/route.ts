import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/auth/session";
import { syncGmail } from "@/lib/gmail-sync";

async function run(request: Request) {
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? ""; const config = env();
  if (!provided || !safeEqual(provided, config.CRON_SECRET ?? config.AUTH_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const mailboxes = await db.mailbox.findMany({ where: { provider: "gmail", refreshTokenEncrypted: { not: null } }, orderBy: { lastSyncedAt: { sort: "asc", nulls: "first" } }, take: 5, select: { userId: true } });
  const results = [];
  for (const mailbox of mailboxes) { try { results.push({ userId: mailbox.userId, ok: true, ...(await syncGmail(mailbox.userId, 100)) }); } catch { results.push({ userId: mailbox.userId, ok: false }); } }
  return NextResponse.json({ processed: results.length, results });
}
export const GET = run;
export const POST = run;

