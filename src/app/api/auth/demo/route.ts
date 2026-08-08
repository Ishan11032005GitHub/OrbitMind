import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createUserSession } from "@/lib/auth/session";
import { seedInboxIqDemo } from "@/lib/demo/seed";
import { DEMO_ACCOUNT } from "@/data/demo-workspace";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const user = await db.user.upsert({
      where: { email: DEMO_ACCOUNT.internalEmail },
      update: { displayName: DEMO_ACCOUNT.displayName },
      create: { email: DEMO_ACCOUNT.internalEmail, displayName: DEMO_ACCOUNT.displayName },
    });
    await seedInboxIqDemo(user.id);
    await createUserSession(user.id);
    return NextResponse.redirect(new URL("/", request.url), 303);
  } catch (cause) {
    console.error("Demo session database setup failed", cause instanceof Error ? cause.message : "Unknown database error");
    return NextResponse.redirect(new URL("/login?demoError=1", request.url), 303);
  }
}
