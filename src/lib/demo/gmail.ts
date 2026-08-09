import { Buffer } from "node:buffer";
import { encryptPrivateContext } from "@/domain/privacy";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

type DemoGoogleCredentials = {
  token?: string;
  access_token?: string;
  refresh_token?: string;
  expiry?: string;
  expiry_date?: number;
  scope?: string | string[];
  token_type?: string;
  client_id?: string;
  client_secret?: string;
};

function parseCredentials(raw: string): DemoGoogleCredentials {
  try {
    return JSON.parse(raw) as DemoGoogleCredentials;
  } catch {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as DemoGoogleCredentials;
  }
}

export async function configureLiveDemoMailbox(userId: string) {
  const raw = process.env.DEMO_GOOGLE_CREDENTIALS?.trim();
  if (!raw) return false;

  const credentials = parseCredentials(raw);
  const accessToken = credentials.token ?? credentials.access_token ?? "";
  if (!credentials.refresh_token && !accessToken) {
    throw new Error("DEMO_GOOGLE_CREDENTIALS has no access or refresh token");
  }

  const config = env();
  const email = (process.env.DEMO_GMAIL_USER || "demoinboxiq@gmail.com").trim().toLowerCase();
  const expiry = credentials.expiry_date
    ? new Date(credentials.expiry_date)
    : credentials.expiry
      ? new Date(credentials.expiry)
      : new Date(accessToken ? Date.now() + 45 * 60_000 : 0);

  await db.mailbox.upsert({
    where: { userId_provider_email: { userId, provider: "gmail", email } },
    update: {
      accessTokenEncrypted: encryptPrivateContext(
        {
          token: accessToken,
          scope: Array.isArray(credentials.scope) ? credentials.scope.join(" ") : credentials.scope,
          tokenType: credentials.token_type,
        },
        config.TOKEN_ENCRYPTION_KEY,
      ),
      refreshTokenEncrypted: credentials.refresh_token
        ? encryptPrivateContext(
            {
              token: credentials.refresh_token,
              clientId: credentials.client_id,
              clientSecret: credentials.client_secret,
            },
            config.TOKEN_ENCRYPTION_KEY,
          )
        : undefined,
      tokenExpiresAt: expiry,
      syncStatus: "pending",
    },
    create: {
      userId,
      provider: "gmail",
      email,
      accessTokenEncrypted: encryptPrivateContext(
        {
          token: accessToken,
          scope: Array.isArray(credentials.scope) ? credentials.scope.join(" ") : credentials.scope,
          tokenType: credentials.token_type,
        },
        config.TOKEN_ENCRYPTION_KEY,
      ),
      refreshTokenEncrypted: credentials.refresh_token
        ? encryptPrivateContext(
            {
              token: credentials.refresh_token,
              clientId: credentials.client_id,
              clientSecret: credentials.client_secret,
            },
            config.TOKEN_ENCRYPTION_KEY,
          )
        : undefined,
      tokenExpiresAt: expiry,
      syncStatus: "pending",
    },
  });
  return true;
}
