import test from "node:test";
import assert from "node:assert/strict";
import { buildRawEmail } from "./gmail";

test("builds a Gmail RFC message with multiple To, CC, and BCC recipients", () => {
  const raw = buildRawEmail({ from: "me@example.com", to: ["one@example.com", "two@example.com"], cc: ["copy@example.com"], bcc: ["hidden@example.com"], subject: "Hello", body: "Message body" });
  const decoded = Buffer.from(raw, "base64url").toString("utf8");
  assert.match(decoded, /To: one@example\.com, two@example\.com/);
  assert.match(decoded, /Cc: copy@example\.com/);
  assert.match(decoded, /Bcc: hidden@example\.com/);
  assert.match(decoded, /Subject: Hello/);
  assert.match(decoded, /\r\n\r\nMessage body$/);
});

test("prevents header injection", () => {
  const raw = buildRawEmail({ from: "me@example.com", to: ["one@example.com"], cc: [], bcc: [], subject: "Safe\r\nBcc: attacker@example.com", body: "Body" });
  const decoded = Buffer.from(raw, "base64url").toString("utf8");
  assert.doesNotMatch(decoded, /\r\nBcc: attacker/);
});
