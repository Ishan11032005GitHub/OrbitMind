import { decryptPrivateContext, encryptPrivateContext } from "@/domain/privacy";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

type AccessPayload = { token: string; scope?: string; tokenType?: string };
type RefreshPayload = { token: string; clientId?: string; clientSecret?: string };

export async function gmailAccessToken(userId: string) {
  const mailbox = await db.mailbox.findFirst({ where: { userId, provider: "gmail" }, orderBy: { updatedAt: "desc" } });
  if (!mailbox?.accessTokenEncrypted) throw new Error("GMAIL_NOT_CONNECTED");
  const config = env();
  const current = decryptPrivateContext<AccessPayload>(mailbox.accessTokenEncrypted, config.TOKEN_ENCRYPTION_KEY);
  if (!mailbox.tokenExpiresAt || mailbox.tokenExpiresAt.getTime() > Date.now() + 60_000) return { mailbox, token: current.token };
  if (!mailbox.refreshTokenEncrypted) throw new Error("GMAIL_RECONNECT_REQUIRED");
  const refresh = decryptPrivateContext<RefreshPayload>(mailbox.refreshTokenEncrypted, config.TOKEN_ENCRYPTION_KEY);
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: refresh.clientId || config.GOOGLE_CLIENT_ID, client_secret: refresh.clientSecret || config.GOOGLE_CLIENT_SECRET, refresh_token: refresh.token, grant_type: "refresh_token" }), cache: "no-store" });
  if (!response.ok) throw new Error("GMAIL_RECONNECT_REQUIRED");
  const tokens = await response.json() as { access_token: string; expires_in: number; scope?: string; token_type?: string };
  await db.mailbox.update({ where: { id: mailbox.id }, data: { accessTokenEncrypted: encryptPrivateContext({ token: tokens.access_token, scope: tokens.scope, tokenType: tokens.token_type }, config.TOKEN_ENCRYPTION_KEY), tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000) } });
  return { mailbox, token: tokens.access_token };
}

const cleanHeader = (value: string) => value.replace(/[\r\n]+/g, " ").trim();
export function buildRawEmail(input: { from: string; to: string[]; cc: string[]; bcc: string[]; subject: string; body: string }) {
  const headers = [
    `From: ${cleanHeader(input.from)}`,
    `To: ${input.to.map(cleanHeader).join(", ")}`,
    ...(input.cc.length ? [`Cc: ${input.cc.map(cleanHeader).join(", ")}`] : []),
    ...(input.bcc.length ? [`Bcc: ${input.bcc.map(cleanHeader).join(", ")}`] : []),
    `Subject: ${cleanHeader(input.subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.body,
  ].join("\r\n");
  return Buffer.from(headers, "utf8").toString("base64url");
}

export async function sendGmailMessage(input: { userId: string; to: string[]; cc?: string[]; bcc?: string[]; subject: string; body: string; threadId?: string }) {
  const { mailbox, token } = await gmailAccessToken(input.userId);
  const raw = buildRawEmail({ from: mailbox.email, to: input.to, cc: input.cc ?? [], bcc: input.bcc ?? [], subject: input.subject, body: input.body });
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify({ raw, ...(input.threadId ? { threadId: input.threadId } : {}) }), cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 401 ? "GMAIL_RECONNECT_REQUIRED" : `GMAIL_SEND_${response.status}`);
  return { ...(await response.json() as { id: string; threadId: string }), mailbox };
}
