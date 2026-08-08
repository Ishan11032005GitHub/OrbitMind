import assert from "node:assert/strict";
import test from "node:test";
import { preciseRelativeTime, scoreRelationship } from "./relationship";
const now = new Date("2026-08-07T12:00:00Z");
test("recent reciprocal relationships score higher", () => {
  const strong = scoreRelationship({ sentCount: 24, receivedCount: 22, threadCount: 9, lastInteractionAt: new Date("2026-08-06T12:00:00Z"), replyRate: .9 }, now);
  const weak = scoreRelationship({ sentCount: 0, receivedCount: 12, threadCount: 1, lastInteractionAt: new Date("2025-08-06T12:00:00Z"), automatedRatio: .8 }, now);
  assert.ok(strong.score > weak.score); assert.equal(strong.label, "Strong");
});
test("relative time is precise", () => assert.equal(preciseRelativeTime(new Date("2026-08-06T09:57:55Z"), now), "1 day 2 hours ago"));
