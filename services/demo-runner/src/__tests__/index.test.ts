import { expect, it } from "vitest";
import { runDemonstration } from "../index.js";

it("runs the deterministic, non-settling anticipatory-action path", () => {
  expect(runDemonstration()).toEqual({ eligible: true, payoutId: "mock-1", ledgerValid: true });
});