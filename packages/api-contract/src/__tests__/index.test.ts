import { expect, it } from "vitest";
import { toRiskGeoJson } from "../index.js";

it("provides non-PII public risk data in GeoJSON shape", () => {
  expect(toRiskGeoJson([{ wardId: "DEMO-NYANDO-001", assessedAt: "2026-08-20T12:00:00Z", score: 78, band: "severe", modelVersion: "risk-v0.1.0", inputsHash: "a".repeat(64) }]).features[0]?.properties.wardId).toBe("DEMO-NYANDO-001");
});