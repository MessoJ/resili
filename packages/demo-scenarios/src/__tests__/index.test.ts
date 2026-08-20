import { expect, it } from "vitest";
import { runNyandoDemo } from "../index.js";

it("demonstrates an eligible anticipatory-action decision with dual approval", () => {
  const decision = runNyandoDemo([{ approverId: "county-officer", approvedAt: "2026-08-20T12:01:00Z" }, { approverId: "ndma-observer", approvedAt: "2026-08-20T12:02:00Z" }]);
  expect(decision.eligible).toBe(true);
  expect(decision.decisionHash).toHaveLength(64);
});