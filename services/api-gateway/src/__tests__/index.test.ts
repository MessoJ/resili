import { expect, it } from "vitest";
import { RiskReadApi } from "../index.js";

it("only exposes the public risk projection", () => {
  const api = new RiskReadApi();
  const inputsHash = "a".repeat(64);
  api.publish({ wardId: "DEMO-NYANDO-001", assessedAt: "2026-08-20T12:00:00Z", score: 78, band: "severe", modelVersion: "risk-v0.1.0", inputsHash });
  expect(api.publicRiskGeoJson(inputsHash).features).toHaveLength(1);
});