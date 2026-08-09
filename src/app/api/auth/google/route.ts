import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { encryptPrivateContext } from "@/domain/privacy";

export const runtime = "nodejs";
const scopes = ["openid", "email", "profile", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"];

export async function GET(request: Request) {
  const config = env();
  const mode = new URL(request.url).searchParams.get("mode") === "demo" ? "demo" : "user";
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const stateCookie = encryptPrivateContext({ state, verifier, mode, expiresAt: Date.now() + 10 * 60_000 }, config.AUTH_SECRET);
  const params = new URLSearchParams({ client_id: config.GOOGLE_CLIENT_ID, redirect_uri: config.GOOGLE_REDIRECT_URI, response_type: "code", scope: scopes.join(" "), access_type: "offline", prompt: "consent", include_granted_scopes: "true", state, code_challenge: challenge, code_challenge_method: "S256" });
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  response.cookies.set("stealth_oauth", stateCookie, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/auth/google/callback", maxAge: 600 });
  return response;
}
