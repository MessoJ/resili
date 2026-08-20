import { createHash } from "node:crypto";

export interface TriggerRequest { triggerId: string; wardId: string; riskScore: number; leadDays: number; requestedAt: string; idempotencyKey: string; }
export interface Approval { approverId: string; approvedAt: string; }
export interface TriggerDecision { eligible: boolean; reason: string; decisionHash: string; }

export function decideTrigger(request: TriggerRequest, approvals: readonly Approval[]): TriggerDecision {
  if (!request.triggerId || !request.wardId || !request.idempotencyKey) throw new Error("Trigger identifiers are required.");
  if (!Number.isFinite(request.riskScore) || request.riskScore < 0 || request.riskScore > 100) throw new RangeError("riskScore must be between 0 and 100.");
  if (!Number.isInteger(request.leadDays) || request.leadDays < 0) throw new RangeError("leadDays must be a non-negative integer.");
  const uniqueApprovers = new Set(approvals.map(({ approverId }) => approverId)).size;
  const eligible = request.riskScore >= 75 && request.leadDays >= 3 && uniqueApprovers >= 2;
  const reason = eligible ? "Severe risk, actionable lead time, and dual approval satisfied." : "Requires severe risk (>=75), lead time (>=3 days), and two distinct approvals.";
  const decisionHash = createHash("sha256").update(JSON.stringify({ request, approvers: [...new Set(approvals.map(({ approverId }) => approverId))].sort(), eligible })).digest("hex");
  return { eligible, reason, decisionHash };
}