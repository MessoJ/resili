import { createHash } from "node:crypto";

export interface LedgerEvent { id: string; occurredAt: string; type: "risk-scored" | "trigger-decided" | "payout-requested"; payloadHash: string; previousHash: string | null; hash: string; }

export function appendEvent(events: readonly LedgerEvent[], input: Omit<LedgerEvent, "previousHash" | "hash">): LedgerEvent {
  if (!input.id || !input.payloadHash || !Number.isFinite(Date.parse(input.occurredAt))) throw new Error("Ledger event requires an id, ISO date, and payload hash.");
  const previousHash = events.at(-1)?.hash ?? null;
  const hash = createHash("sha256").update(JSON.stringify({ ...input, previousHash })).digest("hex");
  return { ...input, previousHash, hash };
}

export function verifyChain(events: readonly LedgerEvent[]): boolean {
  return events.every((event, index) => {
    const previousHash = index === 0 ? null : events[index - 1]?.hash ?? null;
    const hash = createHash("sha256").update(JSON.stringify({ id: event.id, occurredAt: event.occurredAt, type: event.type, payloadHash: event.payloadHash, previousHash })).digest("hex");
    return event.previousHash === previousHash && event.hash === hash;
  });
}