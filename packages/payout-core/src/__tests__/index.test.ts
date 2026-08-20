import { expect, it } from "vitest";
import { MockPayoutAdapter } from "../index.js";

it("queues only eligible payouts and is idempotent", () => {
  const adapter = new MockPayoutAdapter();
  const request = { idempotencyKey: "payout-1", recipientReference: "recipient-hash", amountKes: 500, triggerEligible: true };
  expect(adapter.request(request)).toEqual(adapter.request(request));
  expect(() => adapter.request({ ...request, triggerEligible: false })).toThrow("Ineligible");
});