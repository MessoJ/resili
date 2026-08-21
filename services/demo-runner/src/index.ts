import { runNyandoDemo } from "@resili/demo-scenarios";
import { appendEvent, verifyChain, type LedgerEvent } from "@resili/ledger-core";
import { MockPayoutAdapter } from "@resili/payout-core";

export function runDemonstration(): { eligible: boolean; payoutId: string | null; ledgerValid: boolean } {
  const decision = runNyandoDemo([{ approverId: "county-officer", approvedAt: "2026-08-20T12:01:00Z" }, { approverId: "ndma-observer", approvedAt: "2026-08-20T12:02:00Z" }]);
  const events: LedgerEvent[] = [];
  events.push(appendEvent(events, { id: "demo-decision", occurredAt: "2026-08-20T12:02:00Z", type: "trigger-decided", payloadHash: decision.decisionHash }));
  if (!decision.eligible) return { eligible: false, payoutId: null, ledgerValid: verifyChain(events) };
  const receipt = new MockPayoutAdapter().request({ idempotencyKey: "demo-nyando-payout-001", recipientReference: "demo-recipient-hash", amountKes: 500, triggerEligible: true });
  events.push(appendEvent(events, { id: receipt.payoutId, occurredAt: "2026-08-20T12:03:00Z", type: "payout-requested", payloadHash: receipt.payoutId }));
  return { eligible: true, payoutId: receipt.payoutId, ledgerValid: verifyChain(events) };
}