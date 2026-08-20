export interface WardRisk {
  ward_id: string;
  score: number;
  band: "low" | "moderate" | "high" | "severe";
  probability: number;
  feature_contributions: Record<string, number>;
  model_version: string;
  explanation: string[];
  assessed_at: string;
  inputs_hash: string;
  source: string;
  latitude: number;
  longitude: number;
}

export interface LedgerEvent {
  id: string;
  occurred_at: string;
  type: "risk-scored" | "trigger-decided" | "payout-requested";
  payload_hash: string;
  previous_hash: string;
  hash: string;
  index: number;
}

export interface LedgerData {
  events: LedgerEvent[];
  count: number;
  chain_valid: boolean;
  verified_at: string;
}

export interface AlertData {
  identifier: string;
  sender: string;
  sent: string;
  status: string;
  severity: string;
  event: string;
  description: string;
  instruction: string;
  area_desc: string;
  expires: string;
}

export interface TriggerRecord {
  trigger_id: string;
  ward_id: string;
  risk_score: number;
  lead_days: number;
  eligible: boolean;
  reason: string;
  decision_hash: string;
  idempotency_key: string;
  approvals: { approver_id: string; approved_at: string }[];
  decided_at: string;
}
