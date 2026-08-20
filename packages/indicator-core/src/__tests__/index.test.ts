import { expect, it } from "vitest";
import { sendaiTargetG } from "../index.js";

it("produces machine-readable warning-reach evidence", () => {
  expect(sendaiTargetG([{ wardId: "DEMO-NYANDO-001", population: 1000, delivered: 800, failed: 20 }])).toEqual({ code: "Sendai-G", reached: 800, population: 1000, proportion: 0.8 });
});