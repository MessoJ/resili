import { describe, expect, it } from "vitest";
import { decideTrigger } from "../index.js";

const request = { triggerId: "trigger-1", wardId: "KE-039-001", riskScore: 78, leadDays: 5, requestedAt: "2026-08-20T12:00:00Z", idempotencyKey: "payout-1" };
describe("decideTrigger", () => {
  it("requires severe risk, lead time, and two distinct approvers", () => {
    expect(decideTrigger(request, [{ approverId: "a", approvedAt: request.requestedAt }, { approverId: "b", approvedAt: request.requestedAt }]).eligible).toBe(true);
    expect(decideTrigger(request, [{ approverId: "a", approvedAt: request.requestedAt }]).eligible).toBe(false);
  });
  it("creates a stable hash for an auditable decision", () => {
    const approvals = [{ approverId: "b", approvedAt: request.requestedAt }, { approverId: "a", approvedAt: request.requestedAt }];
    expect(decideTrigger(request, approvals).decisionHash).toHaveLength(64);
    expect(decideTrigger(request, approvals).decisionHash).toBe(decideTrigger(request, [...approvals].reverse()).decisionHash);
  });
});