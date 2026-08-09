import { NextRequest, NextResponse } from "next/server";
import { decryptPrivateContext, encryptPrivateContext } from "@/domain/privacy";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { createUserSession, safeEqual } from "@/lib/auth/session";
import { DEMO_ACCOUNT } from "@/data/demo-workspace";

export const runtime = "nodejs";
type OAuthState = { state: string; verifier: string; mode?: "user" | "demo"; expiresAt: number };
type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number; scope: string; token_type: string; id_token?: string };
type GoogleProfile = { sub: string; email: string; email_verified: boolean; name?: string; picture?: string };

const fail = (origin: string, reason: string) => NextResponse.redirect(new URL(`/?auth_error=${encodeURIComponent(reason)}`, origin));

export async function GET(request: NextRequest) {
  const config = env(); const code = request.nextUrl.searchParams.get("code"); const returnedState = request.nextUrl.searchParams.get("state");
  const publicOrigin = config.APP_URL;
  const packed = request.cookies.get("stealth_oauth")?.value;
  if (!code || !returnedState || !packed) return fail(publicOrigin, "missing_oauth_state");
  let oauth: OAuthState; try { oauth = decryptPrivateContext<OAuthState>(packed, config.AUTH_SECRET); } catch { return fail(publicOrigin, "invalid_oauth_state"); }
  if (oauth.expiresAt < Date.now() || !safeEqual(oauth.state, returnedState)) return fail(publicOrigin, "expired_oauth_state");

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: config.GOOGLE_CLIENT_ID, client_secret: config.GOOGLE_CLIENT_SECRET, redirect_uri: config.GOOGLE_REDIRECT_URI, grant_type: "authorization_code", code_verifier: oauth.verifier }), cache: "no-store" });
  if (!tokenResponse.ok) return fail(publicOrigin, "token_exchange_failed");
  const tokens = await tokenResponse.json() as TokenResponse;
  const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${tokens.access_token}` }, cache: "no-store" });
  if (!profileResponse.ok) return fail(publicOrigin, "profile_fetch_failed");
  const profile = await profileResponse.json() as GoogleProfile;
  if (!profile.email_verified) return fail(publicOrigin, "unverified_google_email");

  const email = profile.email.toLowerCase();
  const expectedDemoEmail = (config.DEMO_GMAIL_USER ?? DEMO_ACCOUNT.displayEmail).toLowerCase();
  if (oauth.mode === "demo" && email !== expectedDemoEmail) return fail(publicOrigin, "wrong_demo_google_account");
  const userEmail = oauth.mode === "demo" ? DEMO_ACCOUNT.internalEmail : email;
  const displayName = oauth.mode === "demo" ? DEMO_ACCOUNT.displayName : profile.name;
  const user = await db.user.upsert({ where: { email: userEmail }, update: { displayName, pictureUrl: profile.picture }, create: { email: userEmail, displayName, pictureUrl: profile.picture } });
  if (oauth.mode === "demo") {
    await db.$transaction([
      db.sequence.deleteMany({ where: { userId: user.id, name: { in: ["Meeting follow-ups", "High-priority work", "Re-engage quiet threads"] } } }),
      db.contact.deleteMany({ where: { userId: user.id, primaryEmail: { in: ["ishan11032005@gmail.com", "ishan.tiwari23b@iiitg.ac.in"] } } }),
      db.company.deleteMany({ where: { userId: user.id, source: "inboxiq-v2-demo" } }),
      db.mailbox.deleteMany({ where: { userId: user.id, provider: "demo" } }),
    ]);
  }
  const existing = await db.mailbox.findUnique({ where: { userId_provider_email: { userId: user.id, provider: "gmail", email } } });
  const accessTokenEncrypted = encryptPrivateContext({ token: tokens.access_token, scope: tokens.scope, tokenType: tokens.token_type }, config.TOKEN_ENCRYPTION_KEY);
  const refreshTokenEncrypted = tokens.refresh_token ? encryptPrivateContext({ token: tokens.refresh_token }, config.TOKEN_ENCRYPTION_KEY) : existing?.refreshTokenEncrypted;
  await db.mailbox.upsert({ where: { userId_provider_email: { userId: user.id, provider: "gmail", email } }, update: { accessTokenEncrypted, refreshTokenEncrypted, tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000), syncStatus: "pending" }, create: { userId: user.id, provider: "gmail", email, accessTokenEncrypted, refreshTokenEncrypted, tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000) } });
  await createUserSession(user.id);
  const response = NextResponse.redirect(new URL("/", publicOrigin)); response.cookies.set("stealth_oauth", "", { path: "/api/auth/google/callback", maxAge: 0 }); return response;
}
