import test from "node:test";
import assert from "node:assert/strict";
import { classifyEmail } from "./email-classification";

test("classifies urgent security email as high priority", () => {
  assert.deepEqual(
    classifyEmail("Action required: suspicious login", "Secure your account immediately"),
    { category: "Security", priority: "High" },
  );
});

test("classifies newsletters as low-priority notifications", () => {
  assert.deepEqual(
    classifyEmail("Weekly product newsletter", "Digest · unsubscribe here"),
    { category: "Notification", priority: "Low" },
  );
});

test("classifies ordinary meeting mail as medium-priority calendar activity", () => {
  assert.deepEqual(
    classifyEmail("Meeting agenda", "Can we schedule thirty minutes next week?"),
    { category: "Calendar", priority: "Medium" },
  );
});
