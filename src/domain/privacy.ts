import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export type RetentionPolicy = { rawBodyDays: number; retainAttachments: boolean; allowExternalAI: boolean; maxModelContextChars: number };
export const DEFAULT_POLICY: RetentionPolicy = { rawBodyDays: 7, retainAttachments: false, allowExternalAI: false, maxModelContextChars: 12_000 };

export function fingerprint(value: string, tenantSalt: string) {
  return createHash("sha256").update(`${tenantSalt}:${value.trim().toLowerCase()}`).digest("hex");
}

export function redactSensitiveText(text: string) {
  const rules: [RegExp, string][] = [
    [/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[EMAIL]"],
    [/\b(?:\+?\d[\d\s().-]{8,}\d)\b/g, "[PHONE]"],
    [/\b(?:\d[ -]*?){13,19}\b/g, "[PAYMENT_CARD]"],
    [/\b(?:api[_ -]?key|password|otp|secret)\s*[:=]\s*\S+/gi, "[SECRET]"],
    [/\b\d{3}-\d{2}-\d{4}\b/g, "[GOVERNMENT_ID]"],
  ];
  return rules.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text);
}

export function minimizeForAI(input: { subject: string; body: string; participants: string[] }, policy = DEFAULT_POLICY) {
  if (!policy.allowExternalAI) return { allowed: false as const, reason: "External AI processing is disabled by policy." };
  const normalized = redactSensitiveText(input.body)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, policy.maxModelContextChars);
  return { allowed: true as const, payload: { subject: redactSensitiveText(input.subject).slice(0, 300), body: normalized, participantCount: input.participants.length } };
}

function keyFromSecret(secret: string) { return createHash("sha256").update(secret).digest(); }
export function encryptPrivateContext(value: unknown, secret: string) {
  if (secret.length < 24) throw new Error("Encryption secret must contain at least 24 characters.");
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", keyFromSecret(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}
export function decryptPrivateContext<T>(token: string, secret: string): T {
  const [version, iv, tag, ciphertext] = token.split("."); if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Invalid encrypted context.");
  const decipher = createDecipheriv("aes-256-gcm", keyFromSecret(secret), Buffer.from(iv, "base64url")); decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8")) as T;
}

export function shouldPurgeRawBody(occurredAt: Date, policy = DEFAULT_POLICY, now = new Date()) {
  return now.getTime() - occurredAt.getTime() > policy.rawBodyDays * 86_400_000;
}
