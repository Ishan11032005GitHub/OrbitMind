import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { safeEqual } from "@/lib/auth/session";
import { processDueDeliveries } from "@/lib/sequence-worker";

async function run(request: Request) {
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const config = env(); const expected = config.CRON_SECRET ?? config.AUTH_SECRET;
  if (!provided || !safeEqual(provided, expected)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (config.ENABLE_SEQUENCE_SENDING !== "true") return NextResponse.json({ disabled: true, message: "Sequence sending is disabled." });
  return NextResponse.json(await processDueDeliveries());
}
export const POST = run;
export const GET = run;
