import test from "node:test";
import assert from "node:assert/strict";
import { parseAddresses } from "./gmail-sync";

test("parses named and plain Gmail address lists", () => {
  assert.deepEqual(parseAddresses('"Maya Chen" <maya@example.com>, arjun@example.org'), [
    { name: "Maya Chen", email: "maya@example.com" },
    { name: "arjun", email: "arjun@example.org" },
  ]);
});

test("drops malformed participant addresses", () => {
  assert.deepEqual(parseAddresses("not-an-email, valid@example.com"), [{ name: "valid", email: "valid@example.com" }]);
});
