import { expect, it } from "vitest";
import { estimateComputeFootprint } from "../index.js";

it("reports a reproducible estimate without overstating precision", () => {
  expect(estimateComputeFootprint({ inferenceCount: 100, wattHoursPerInference: 0.5, gridGramsCo2ePerKwh: 100 })).toEqual({ wattHours: 50, gramsCo2e: 5 });
});