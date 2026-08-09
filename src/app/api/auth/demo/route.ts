import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { persistUserSession, SESSION_COOKIE } from "@/lib/auth/session";
import { seedInboxIqDemo } from "@/lib/demo/seed";
import { DEMO_ACCOUNT } from "@/data/demo-workspace";

export async function POST(request: Request) {
  const publicOrigin = process.env.APP_URL ?? new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(publicOrigin).origin) return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  try {
    const user = await db.user.upsert({
      where: { email: DEMO_ACCOUNT.internalEmail },
      update: { displayName: DEMO_ACCOUNT.displayName },
      create: { email: DEMO_ACCOUNT.internalEmail, displayName: DEMO_ACCOUNT.displayName },
    });
    await seedInboxIqDemo(user.id);
    const session = await persistUserSession(user.id);
    const response = NextResponse.redirect(new URL("/", publicOrigin), 303);
    response.cookies.set(SESSION_COOKIE, session.raw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: session.expiresAt,
    });
    return response;
  } catch (cause) {
    console.error("Demo session database setup failed", cause instanceof Error ? cause.message : "Unknown database error");
    return NextResponse.redirect(new URL("/login?demoError=1", publicOrigin), 303);
  }
}
