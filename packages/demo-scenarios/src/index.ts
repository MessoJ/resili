import { scoreWardRisk, type WardRiskInput } from "@resili/risk-core";
import { decideTrigger, type Approval, type TriggerDecision } from "@resili/trigger-core";

export const nyandoDemoInput: WardRiskInput = { wardId: "DEMO-NYANDO-001", assessedAt: "2026-08-20T12:00:00Z", forecastProbability: 0.8, forecastLeadDays: 5, riverDischargeRatio: 1.8, exposureScore: 0.7, vulnerabilityScore: 0.6, source: "deterministic-demo-fixture", modelVersion: "risk-v0.1.0" };

export function runNyandoDemo(approvals: readonly Approval[]): TriggerDecision {
  const risk = scoreWardRisk(nyandoDemoInput);
  return decideTrigger({ triggerId: "demo-nyando-trigger-001", wardId: risk.wardId, riskScore: risk.score, leadDays: nyandoDemoInput.forecastLeadDays, requestedAt: risk.assessedAt, idempotencyKey: "demo-nyando-payout-001" }, approvals);
}