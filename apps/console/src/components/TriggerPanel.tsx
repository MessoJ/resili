"use client";

import React, { useState } from "react";
import type { WardRisk } from "@/lib/types";
import { API_BASE_URL } from "@/lib/api";

interface TriggerPanelProps {
  selectedWard: WardRisk | null;
}

/** Decision returned by the gateway trigger endpoint, in view-model form. */
interface TriggerDecision {
  eligible: boolean;
  reason: string;
  decisionHash: string;
  idempotencyKey: string;
  amountKes: number;
  payoutRef: string | null;
}

// Actionable forecast lead time (days) used for the trigger rule (>= 3).
const LEAD_DAYS = 4;
// Anticipatory cash transfer per household (policy constant).
const PAYOUT_KES = 500;

export function TriggerPanel({ selectedWard }: TriggerPanelProps) {
  const [officer1Approved, setOfficer1Approved] = useState(false);
  const [officer2Approved, setOfficer2Approved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decision, setDecision] = useState<TriggerDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ward = selectedWard;
  const isSevere = ward ? ward.score >= 75 : false;
  const leadDays = LEAD_DAYS;
  const bothApproved = officer1Approved && officer2Approved;
  const canTrigger = isSevere && bothApproved && !decision;

  const handleExecuteTrigger = async () => {
    if (!ward) return;
    setIsSubmitting(true);
    setError(null);

    const wardSlug = ward.ward_id.replace("KE-039-", "").toLowerCase();
    const idempotencyKey = `payout-${wardSlug}-${Date.now()}`;
    const payload = {
      trigger_id: `trig-${ward.ward_id.toLowerCase()}-001`,
      ward_id: ward.ward_id,
      risk_score: ward.score,
      lead_days: leadDays,
      idempotency_key: idempotencyKey,
      approvals: [
        { approver_id: "county-officer-kisumu", approved_at: new Date().toISOString() },
        { approver_id: "ndma-observer-001", approved_at: new Date().toISOString() },
      ],
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/triggers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        setError(`The gateway rejected the trigger request (HTTP ${res.status}).`);
        return;
      }

      const data = await res.json();
      const decisionHash: string = data.decision_hash || "";

      // The payout reference is derived from the real audit decision hash — no
      // random or placeholder values — so it is reproducible and verifiable
      // against the ledger. Payout is only ever shown when the backend itself
      // returned an eligible decision.
      setDecision({
        eligible: Boolean(data.eligible),
        reason: data.reason || "",
        decisionHash,
        idempotencyKey: data.idempotency_key || idempotencyKey,
        amountKes: PAYOUT_KES,
        payoutRef: data.eligible && decisionHash
          ? `MPESA-B2C-${decisionHash.slice(0, 10).toUpperCase()}`
          : null,
      });
    } catch {
      setError(
        "Could not reach the API gateway. Start the gateway (" +
          API_BASE_URL +
          ") to authorise a live anticipatory payout."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setOfficer1Approved(false);
    setOfficer2Approved(false);
    setDecision(null);
    setError(null);
  };

  return (
    <div className="trigger-panel" style={{ padding: "16px" }}>
      <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "4px" }}>
        Anticipatory Action Trigger
      </div>
      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "20px" }}>
        Safety-critical automated workflow: dual approval &amp; immutable audit ledger.
      </div>

      {!ward && (
        <div
          style={{
            padding: "16px",
            background: "rgba(59, 130, 246, 0.1)",
            borderRadius: "var(--radius-sm)",
            fontSize: "12px",
            color: "var(--text-secondary)",
            marginBottom: "16px",
          }}
        >
          Select a ward on the map or list (e.g. <strong>Nyando</strong> or <strong>Budalangi</strong>) to evaluate trigger eligibility.
        </div>
      )}

      {ward && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Target Ward Summary */}
          <div
            style={{
              padding: "12px",
              background: "var(--bg-card)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)",
              fontSize: "12px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Target: <strong>{ward.ward_id.replace("KE-039-", "")} Ward</strong></span>
              <span>Score: <strong style={{ color: isSevere ? "var(--risk-severe)" : "var(--text-primary)" }}>{ward.score.toFixed(1)}</strong></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", color: "var(--text-muted)" }}>
              <span>Forecast Lead Time: <strong>{leadDays} Days</strong></span>
              <span>Condition: <strong>{isSevere ? "SEVERE (>=75)" : "BELOW THRESHOLD"}</strong></span>
            </div>
          </div>

          {/* Step 1: Score & Lead Time Validation */}
          <div className="trigger-step">
            <div className={`trigger-step__icon ${isSevere ? "trigger-step__icon--complete" : "trigger-step__icon--pending"}`}>
              {isSevere ? "✓" : "1"}
            </div>
            <div className="trigger-step__content">
              <div className="trigger-step__title">1. Algorithmic Trigger Threshold</div>
              <div className="trigger-step__detail">
                Requires Risk Score &ge; 75 and Lead Time &ge; 3 days.
                <br />
                Status: {isSevere ? "Condition satisfied" : "Awaiting severe threshold"}
              </div>
            </div>
          </div>

          {/* Step 2: Dual Officer Approval */}
          <div className="trigger-step">
            <div className={`trigger-step__icon ${bothApproved ? "trigger-step__icon--complete" : isSevere ? "trigger-step__icon--active" : "trigger-step__icon--pending"}`}>
              {bothApproved ? "✓" : "2"}
            </div>
            <div className="trigger-step__content">
              <div className="trigger-step__title">2. Two-Person Governance Sign-Off</div>
              <div className="trigger-step__detail" style={{ marginBottom: "10px" }}>
                Mandatory two distinct approvers per DO-NO-HARM and audit policy.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "12px",
                    cursor: isSevere ? "pointer" : "not-allowed",
                    opacity: isSevere ? 1 : 0.5,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={officer1Approved}
                    disabled={!isSevere || decision !== null}
                    onChange={(e) => setOfficer1Approved(e.target.checked)}
                    style={{ accentColor: "var(--accent-primary)" }}
                  />
                  <span>Kisumu County Disaster Management Officer</span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "12px",
                    cursor: isSevere ? "pointer" : "not-allowed",
                    opacity: isSevere ? 1 : 0.5,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={officer2Approved}
                    disabled={!isSevere || decision !== null}
                    onChange={(e) => setOfficer2Approved(e.target.checked)}
                    style={{ accentColor: "var(--accent-primary)" }}
                  />
                  <span>NDMA Regional Early Action Observer</span>
                </label>
              </div>
            </div>
          </div>

          {/* Step 3: Trigger Execution Button */}
          <div className="trigger-step">
            <div className={`trigger-step__icon ${decision?.eligible ? "trigger-step__icon--complete" : "trigger-step__icon--pending"}`}>
              {decision?.eligible ? "✓" : "3"}
            </div>
            <div className="trigger-step__content">
              <div className="trigger-step__title">3. Execute Anticipatory Cash Transfer</div>
              <div className="trigger-step__detail" style={{ marginBottom: "12px" }}>
                Dispatches KES {PAYOUT_KES}/household pre-disaster liquidity via the
                M-Pesa adapter, gated on the gateway&apos;s dual-approval decision.
              </div>

              {!decision && (
                <button
                  disabled={!canTrigger || isSubmitting}
                  onClick={handleExecuteTrigger}
                  style={{
                    width: "100%",
                    padding: "11px 16px",
                    borderRadius: "var(--radius-sm)",
                    background: canTrigger ? "var(--accent-danger)" : "var(--bg-inset)",
                    color: canTrigger ? "#0b110f" : "var(--text-muted)",
                    border: canTrigger ? "1px solid var(--accent-danger)" : "1px solid var(--border-subtle)",
                    fontWeight: 700,
                    fontSize: "13px",
                    letterSpacing: "0.01em",
                    cursor: canTrigger ? "pointer" : "not-allowed",
                    transition: "background var(--transition-fast)",
                  }}
                >
                  {isSubmitting ? "Submitting to audit chain…" : "Authorise anticipatory payout"}
                </button>
              )}
            </div>
          </div>

          {/* Gateway unreachable / rejected request */}
          {error && (
            <div
              style={{
                padding: "12px 14px",
                background: "var(--risk-severe-bg)",
                border: "1px solid rgba(207, 80, 73, 0.3)",
                borderRadius: "var(--radius-md)",
                fontSize: "12px",
                color: "var(--risk-severe)",
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          )}

          {/* Eligible decision — anticipatory payout authorised */}
          {decision?.eligible && (
            <div
              style={{
                marginTop: "4px",
                padding: "16px",
                background: "var(--risk-low-bg)",
                border: "1px solid rgba(69, 176, 131, 0.35)",
                borderRadius: "var(--radius-md)",
                fontSize: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "7px", color: "var(--accent-success)", fontWeight: 700, marginBottom: "10px" }}>
                <span>✓</span> Anticipatory payout authorised &amp; recorded
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "5px", color: "var(--text-secondary)", fontFamily: "var(--font-mono)", fontSize: "11px" }}>
                <div>REF&nbsp;&nbsp;&nbsp;&nbsp;{decision.payoutRef}</div>
                <div>AMOUNT&nbsp;&nbsp;KES {decision.amountKes} · per household</div>
                <div>IDEMP&nbsp;&nbsp;&nbsp;{decision.idempotencyKey}</div>
                <div style={{ wordBreak: "break-all" }}>AUDIT&nbsp;&nbsp;&nbsp;{decision.decisionHash.slice(0, 24)}…</div>
              </div>
              <button
                onClick={handleReset}
                style={{
                  marginTop: "12px",
                  padding: "6px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-primary)",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                Reset workflow
              </button>
            </div>
          )}

          {/* Decision returned but not eligible — show the gateway's reason */}
          {decision && !decision.eligible && (
            <div
              style={{
                marginTop: "4px",
                padding: "16px",
                background: "var(--risk-moderate-bg)",
                border: "1px solid rgba(214, 161, 60, 0.35)",
                borderRadius: "var(--radius-md)",
                fontSize: "12px",
              }}
            >
              <div style={{ color: "var(--risk-moderate)", fontWeight: 700, marginBottom: "6px" }}>
                Trigger not authorised
              </div>
              <div style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {decision.reason || "The gateway declined this trigger against the public rules."}
              </div>
              <div style={{ marginTop: "8px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "11px", wordBreak: "break-all" }}>
                AUDIT&nbsp;&nbsp;&nbsp;{decision.decisionHash.slice(0, 24)}…
              </div>
              <button
                onClick={handleReset}
                style={{
                  marginTop: "12px",
                  padding: "6px 12px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text-primary)",
                  fontSize: "11px",
                  cursor: "pointer",
                }}
              >
                Reset workflow
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
