import { describe, expect, it } from "vitest";
import { riskBandFor, scoreWardRisk } from "../index.js";

describe("scoreWardRisk", () => {
  const ward = {
    wardId: "KE-039-001",
    assessedAt: "2026-08-20T12:00:00Z",
    forecastProbability: 0.8,
    forecastLeadDays: 5,
    riverDischargeRatio: 1.8,
    exposureScore: 0.7,
    vulnerabilityScore: 0.6,
    source: "deterministic-demo-fixture",
    modelVersion: "risk-v0.1.0"
  };

  it("calculates a bounded, explainable impact-based score", () => {
    const result = scoreWardRisk(ward);
    expect(result).toMatchObject({ wardId: ward.wardId, score: 78, band: "severe", source: ward.source });
    expect(result.explanation).toHaveLength(5);
  });

  it("rejects malformed normalised inputs", () => {
    expect(() => scoreWardRisk({ ...ward, exposureScore: 1.01 })).toThrow(RangeError);
  });

  it("assigns stable risk bands at each boundary", () => {
    expect([0, 24.9, 25, 49.9, 50, 74.9, 75].map(riskBandFor)).toEqual([
      "low", "low", "moderate", "moderate", "high", "high", "severe"
    ]);
  });
});