export type RiskBand = "low" | "moderate" | "high" | "severe";

export interface WardRiskInput {
  wardId: string;
  assessedAt: string;
  forecastProbability: number;
  forecastLeadDays: number;
  riverDischargeRatio: number;
  exposureScore: number;
  vulnerabilityScore: number;
  source: string;
  modelVersion: string;
}

export interface WardRiskScore {
  wardId: string;
  assessedAt: string;
  score: number;
  band: RiskBand;
  source: string;
  modelVersion: string;
  explanation: readonly string[];
}

const SCORE_MIN = 0;
const SCORE_MAX = 100;

function assertUnitInterval(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${name} must be a finite value between 0 and 1.`);
  }
}

function assertNonNegative(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative value.`);
  }
}

export function riskBandFor(score: number): RiskBand {
  if (score >= 75) return "severe";
  if (score >= 50) return "high";
  if (score >= 25) return "moderate";
  return "low";
}

/**
 * Produces an explainable impact-based score, not a flood prediction. The
 * normalised hazard component is intentionally capped so anomalous input data
 * cannot create an unbounded decision signal.
 */
export function scoreWardRisk(input: WardRiskInput): WardRiskScore {
  assertUnitInterval(input.forecastProbability, "forecastProbability");
  assertNonNegative(input.forecastLeadDays, "forecastLeadDays");
  assertNonNegative(input.riverDischargeRatio, "riverDischargeRatio");
  assertUnitInterval(input.exposureScore, "exposureScore");
  assertUnitInterval(input.vulnerabilityScore, "vulnerabilityScore");

  const hazard = Math.min(1, input.riverDischargeRatio / 2);
  const impact = (0.45 * input.forecastProbability + 0.25 * hazard + 0.15 * input.exposureScore + 0.15 * input.vulnerabilityScore) * SCORE_MAX;
  const score = Math.round(Math.max(SCORE_MIN, Math.min(SCORE_MAX, impact)) * 10) / 10;
  const explanation = [
    `Forecast probability contributes ${(input.forecastProbability * 45).toFixed(1)} points.`,
    `River discharge ratio contributes ${(hazard * 25).toFixed(1)} points.`,
    `Exposure contributes ${(input.exposureScore * 15).toFixed(1)} points.`,
    `Vulnerability contributes ${(input.vulnerabilityScore * 15).toFixed(1)} points.`,
    `Lead time is ${input.forecastLeadDays} day(s); this score is a decision-support estimate, not a certainty.`
  ] as const;

  return { wardId: input.wardId, assessedAt: input.assessedAt, score, band: riskBandFor(score), source: input.source, modelVersion: input.modelVersion, explanation };
}