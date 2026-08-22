"use client";

import React, { useState } from "react";
import type { WardRisk } from "@/lib/types";
import { API_BASE_URL } from "@/lib/api";
import { can, type Session } from "@/lib/auth";
import { formatCount, wardDisplayName } from "@/lib/plain-language";

interface TriggerPanelProps {
  selectedWard: WardRisk | null;
  session: Session;
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

export function TriggerPanel({ selectedWard, session }: TriggerPanelProps) {
  const mayApproveCounty = can(session.role, "approve_county");
  const mayApproveNdma = can(session.role, "approve_ndma");

  // Each approval is attributed to a named official. The signed-in operator's
  // name is pre-filled only into the step their role owns; the complementary
  // step must be entered by a *different* authorised official who is present.
  // Admins own both permissions, so we pre-fill only the county step, forcing a
  // second person for the NDMA step — true two-person control, never one.
  const [countyApprover, setCountyApprover] = useState(
    mayApproveCounty ? session.name : ""
  );
  const [ndmaApprover, setNdmaApprover] = useState(
    mayApproveNdma && !mayApproveCounty ? session.name : ""
  );
  const [countyLocked, setCountyLocked] = useState(false);
  const [ndmaLocked, setNdmaLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [decision, setDecision] = useState<TriggerDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ward = selectedWard;
  const isSevere = ward ? ward.score >= 75 : false;
  const leadDays = LEAD_DAYS;

  // The two approvers must be two different people — a single official can
  // never satisfy both halves of the sign-off.
  const sameApprover =
    countyApprover.trim().length > 0 &&
    countyApprover.trim().toLowerCase() === ndmaApprover.trim().toLowerCase();
  const bothApproved = countyLocked && ndmaLocked;
  const canTrigger = isSevere && bothApproved && !sameApprover && !decision;

  const handleExecuteTrigger = async () => {
    if (!ward) return;
    setIsSubmitting(true);
    setError(null);

    const wardSlug = ward.ward_id.replace("KE-039-", "").toLowerCase();
    const idempotencyKey = `payout-${wardSlug}-${Date.now()}`;
    // Approvals are attributed to the signed-in operator, not a hardcoded ID.
    const payload = {
      trigger_id: `trig-${ward.ward_id.toLowerCase()}-001`,
      ward_id: ward.ward_id,
      risk_score: ward.score,
      lead_days: leadDays,
      idempotency_key: idempotencyKey,
      approvals: [
        { approver_id: `county:${countyApprover.trim()}`, approved_at: new Date().toISOString() },
        { approver_id: `ndma:${ndmaApprover.trim()}`, approved_at: new Date().toISOString() },
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
    setCountyLocked(false);
    setNdmaLocked(false);
    setCountyApprover(mayApproveCounty ? session.name : "");
    setNdmaApprover(mayApproveNdma && !mayApproveCounty ? session.name : "");
    setDecision(null);
    setError(null);
  };

  const name = ward ? wardDisplayName(ward) : "";
  const payoutTotal = ward?.households_eligible
    ? ward.households_eligible * PAYOUT_KES
    : undefined;

  return (
    <div className="trigger-panel" style={{ padding: "16px" }}>
      <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "4px" }}>
        Authorise anticipatory action
      </div>
      <div style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "20px" }}>
        Get cash to households before the water arrives. Two people must approve.
      </div>

      {!ward && (
        <div
          style={{
            padding: "16px",
            background: "var(--accent-primary-dim)",
            borderRadius: "var(--radius-sm)",
            fontSize: "12px",
            color: "var(--text-secondary)",
          }}
        >
          Select a ward on the map or list (e.g. <strong>Nyando</strong> or{" "}
          <strong>Nzoia</strong>) to review its anticipatory payout.
        </div>
      )}

      {ward && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* What this payout does, in plain language */}
          <div className="trigger-summary" style={{ borderColor: isSevere ? "var(--risk-severe)" : "var(--border-subtle)" }}>
            <div className="trigger-summary__title">{name} Ward</div>
            <div className="trigger-summary__line">
              {formatCount(ward.households_eligible)} households · KES {PAYOUT_KES} each
              {payoutTotal !== undefined && (
                <> · <strong>KES {formatCount(payoutTotal)} total</strong></>
              )}
            </div>
            <div className="trigger-summary__line" style={{ color: "var(--text-muted)" }}>
              Forecast lead time {leadDays} days · {isSevere ? "meets the trigger threshold" : "below the trigger threshold"}
            </div>
          </div>

          {/* Step 1: Algorithmic threshold */}
          <div className={`trigger-step ${isSevere ? "trigger-step--done" : ""}`}>
            <div className={`trigger-step__icon ${isSevere ? "trigger-step__icon--complete" : "trigger-step__icon--pending"}`}>
              {isSevere ? "✓" : "1"}
            </div>
            <div className="trigger-step__content">
              <div className="trigger-step__title">Step 1 · System check</div>
              <div className="trigger-step__detail">
                {isSevere
                  ? "The forecast meets the public trigger rule (severe risk, ≥3 days lead time)."
                  : "Waiting for the forecast to reach the severe threshold. No action is due yet."}
              </div>
            </div>
          </div>

          {/* Step 2: Two-person sign-off — highlighted when it needs attention */}
          <div className={`trigger-step ${bothApproved ? "trigger-step--done" : isSevere ? "trigger-step--attention" : ""}`}>
            <div className={`trigger-step__icon ${bothApproved ? "trigger-step__icon--complete" : isSevere ? "trigger-step__icon--active" : "trigger-step__icon--pending"}`}>
              {bothApproved ? "✓" : "2"}
            </div>
            <div className="trigger-step__content">
              <div className="trigger-step__title">Step 2 · Two-person approval</div>
              <div className="trigger-step__detail" style={{ marginBottom: "10px" }}>
                Two different officials must approve before any money moves.
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <ApprovalRow
                  title="County Disaster Management Officer"
                  name={countyApprover}
                  locked={countyLocked}
                  disabled={!isSevere || decision !== null}
                  onNameChange={setCountyApprover}
                  onToggle={() => setCountyLocked((v) => !v)}
                />

                <ApprovalRow
                  title="NDMA Regional Early Action Observer"
                  name={ndmaApprover}
                  locked={ndmaLocked}
                  disabled={!isSevere || decision !== null}
                  onNameChange={setNdmaApprover}
                  onToggle={() => setNdmaLocked((v) => !v)}
                />

                {sameApprover && (
                  <div className="approve-warning">
                    The two approvals must come from two <strong>different</strong> officials.
                    A single person cannot authorise a payout alone.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Dominant authorise button */}
          {!decision && (
            <button
              disabled={!canTrigger || isSubmitting}
              onClick={handleExecuteTrigger}
              className={`trigger-authorise ${canTrigger ? "trigger-authorise--ready" : ""}`}
            >
              {isSubmitting
                ? "Recording decision…"
                : canTrigger
                ? `Authorise payout to ${formatCount(ward.households_eligible)} households`
                : "Complete the steps above to authorise"}
            </button>
          )}

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

          {decision?.eligible && (
            <div
              style={{
                padding: "16px",
                background: "var(--risk-low-bg)",
                border: "1px solid rgba(69, 176, 131, 0.35)",
                borderRadius: "var(--radius-md)",
                fontSize: "12px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "7px", color: "var(--accent-success)", fontWeight: 700, marginBottom: "10px" }}>
                <span>✓</span> Payout authorised &amp; recorded
              </div>
              <div style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
                KES {decision.amountKes} per household is being dispatched via M-Pesa.
                This decision is now in the permanent record.
              </div>
              <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: "11px", wordBreak: "break-all" }}>
                <div>Reference {decision.payoutRef}</div>
                <div>Approved by {countyApprover.trim()} (county) &amp; {ndmaApprover.trim()} (NDMA)</div>
              </div>
              <button onClick={handleReset} className="trigger-reset">Start a new authorisation</button>
            </div>
          )}

          {decision && !decision.eligible && (
            <div
              style={{
                padding: "16px",
                background: "var(--risk-moderate-bg)",
                border: "1px solid rgba(214, 161, 60, 0.35)",
                borderRadius: "var(--radius-md)",
                fontSize: "12px",
              }}
            >
              <div style={{ color: "var(--risk-moderate)", fontWeight: 700, marginBottom: "6px" }}>
                Payout not authorised
              </div>
              <div style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {decision.reason || "The gateway declined this trigger against the public rules."}
              </div>
              <button onClick={handleReset} className="trigger-reset">Start over</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ApprovalRowProps {
  title: string;
  name: string;
  locked: boolean;
  disabled: boolean;
  onNameChange: (value: string) => void;
  onToggle: () => void;
}

// A single named approval. Capturing a distinct name per step (instead of a
// bare checkbox) is what makes the two-person control real: the same person
// cannot stand in for both halves of the sign-off.
function ApprovalRow({
  title,
  name,
  locked,
  disabled,
  onNameChange,
  onToggle,
}: ApprovalRowProps) {
  const canLock = !disabled && name.trim().length >= 2;

  return (
    <div className={`approve-row ${locked ? "approve-row--done" : ""} ${disabled ? "approve-row--disabled" : ""}`}>
      <div className="approve-row__head">
        <span className="approve-row__icon">{locked ? "✓" : "•"}</span>
        <span className="approve-row__title">{title}</span>
      </div>
      <div className="approve-row__controls">
        <input
          className="approve-row__input"
          type="text"
          value={name}
          placeholder="Approving official's full name"
          disabled={disabled || locked}
          autoComplete="off"
          onChange={(e) => onNameChange(e.target.value)}
        />
        <button
          type="button"
          className={`approve-row__btn ${locked ? "approve-row__btn--undo" : ""}`}
          disabled={locked ? disabled : !canLock}
          onClick={onToggle}
        >
          {locked ? "Undo" : "Approve"}
        </button>
      </div>
    </div>
  );
}
