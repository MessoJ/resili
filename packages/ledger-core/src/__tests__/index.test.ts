import { expect, it } from "vitest";
import { appendEvent, verifyChain } from "../index.js";

it("links audit events and detects tampering", () => {
  const first = appendEvent([], { id: "risk-1", occurredAt: "2026-08-20T12:00:00Z", type: "risk-scored", payloadHash: "a".repeat(64) });
  const events = [first, appendEvent([first], { id: "decision-1", occurredAt: "2026-08-20T12:01:00Z", type: "trigger-decided", payloadHash: "b".repeat(64) })];
  expect(verifyChain(events)).toBe(true);
  expect(verifyChain([{ ...events[0], payloadHash: "c".repeat(64) }, events[1]])).toBe(false);
});