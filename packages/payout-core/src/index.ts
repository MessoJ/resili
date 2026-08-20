export interface PayoutRequest { idempotencyKey: string; recipientReference: string; amountKes: number; triggerEligible: boolean; }
export interface PayoutReceipt { payoutId: string; status: "queued"; idempotencyKey: string; }

export class MockPayoutAdapter {
  readonly #receipts = new Map<string, PayoutReceipt>();

  request(request: PayoutRequest): PayoutReceipt {
    if (!request.triggerEligible) throw new Error("Ineligible triggers cannot request payouts.");
    if (!request.idempotencyKey || !request.recipientReference) throw new Error("Payout idempotency and recipient references are required.");
    if (!Number.isInteger(request.amountKes) || request.amountKes <= 0) throw new RangeError("Payout amount must be a positive whole number of Kenyan shillings.");
    const existing = this.#receipts.get(request.idempotencyKey);
    if (existing) return existing;
    const receipt = { payoutId: `mock-${this.#receipts.size + 1}`, status: "queued" as const, idempotencyKey: request.idempotencyKey };
    this.#receipts.set(request.idempotencyKey, receipt);
    return receipt;
  }
}