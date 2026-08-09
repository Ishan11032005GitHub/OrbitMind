import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "stealth_session";
const SESSION_DAYS = 30;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function persistUserSession(userId: string) {
  const raw = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({ data: { tokenHash: digest(raw), userId, expiresAt } });
  return { raw, expiresAt };
}

export async function createUserSession(userId: string) {
  const { raw, expiresAt } = await persistUserSession(userId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, raw, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: expiresAt });
}

export async function currentUser() {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const session = await db.session.findUnique({ where: { tokenHash: digest(raw) }, include: { user: true } });
    if (!session || session.expiresAt <= new Date()) return null;
    return session.user;
  } catch (cause) {
    console.error("Session database lookup failed", cause instanceof Error ? cause.message : "Unknown database error");
    return null;
  }
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function revokeCurrentSession() {
  const jar = await cookies(); const raw = jar.get(SESSION_COOKIE)?.value;
  if (raw) await db.session.deleteMany({ where: { tokenHash: digest(raw) } });
  jar.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

export function safeEqual(left: string, right: string) {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
