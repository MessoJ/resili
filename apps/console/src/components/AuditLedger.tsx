"use client";

import React, { useState } from "react";
import type { LedgerData, LedgerEvent } from "@/lib/types";

interface AuditLedgerProps {
  ledger: LedgerData;
}

/** Plain-English summary for each ledger event type. */
const EVENT_PLAIN: Record<LedgerEvent["type"], { label: string; detail: string; dot: string }> = {
  "risk-scored": {
    label: "Risk scored by system",
    detail: "The model assessed ward flood risk from the latest forecast.",
    dot: "var(--accent-primary)",
  },
  "trigger-decided": {
    label: "Trigger decision recorded",
    detail: "The public trigger rule was evaluated against the risk score.",
    dot: "var(--risk-moderate)",
  },
  "payout-requested": {
    label: "Anticipatory payout requested",
    detail: "A dual-approved cash transfer was submitted for dispatch.",
    dot: "var(--risk-low)",
  },
};

export function AuditLedger({ ledger }: AuditLedgerProps) {
  const [devMode, setDevMode] = useState(false);

  return (
    <div className="ledger-chain">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        <div>
          <div style={{ fontSize: "16px", fontWeight: 700 }}>Decision history</div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Every risk score, trigger and payout, in order — a permanent record.
          </div>
        </div>
      </div>

      {/* Verification banner — plain language, reflects the real chain_valid flag */}
      <div className={`chain-status ${ledger.chain_valid ? "chain-status--valid" : "chain-status--invalid"}`}>
        <span>{ledger.chain_valid ? "✓" : "✕"}</span>
        <span>
          {ledger.chain_valid
            ? `Record verified & unaltered (${ledger.events.length} entries)`
            : `Record verification FAILED (${ledger.events.length} entries) — do not action`}
        </span>
      </div>

      {/* Developer-mode toggle — hides cryptographic detail by default */}
      <label className="audit-devtoggle">
        <input
          type="checkbox"
          checked={devMode}
          onChange={(e) => setDevMode(e.target.checked)}
        />
        <span>View technical audit data (developer mode)</span>
      </label>

      {/* Plain-language timeline */}
      <div className="audit-timeline">
        {ledger.events.map((evt) => {
          const meta = EVENT_PLAIN[evt.type];
          return (
            <div key={evt.id} className="audit-entry">
              <span className="audit-entry__dot" style={{ background: meta?.dot ?? "var(--text-muted)" }} />
              <div className="audit-entry__body">
                <div className="audit-entry__head">
                  <span className="audit-entry__label">{meta?.label ?? evt.type}</span>
                  <span className="audit-entry__time">
                    {new Date(evt.occurred_at).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}
                  </span>
                </div>
                <div className="audit-entry__detail">{meta?.detail ?? ""}</div>

                {devMode && (
                  <div className="audit-entry__tech">
                    <div><strong>Block #{evt.index}</strong></div>
                    <div>Hash: <span style={{ color: "var(--accent-primary)" }}>{evt.hash}</span></div>
                    {evt.previous_hash && <div>Prev: {evt.previous_hash.slice(0, 24)}…</div>}
                    <div>Payload digest: {evt.payload_hash}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {devMode && (
        <div
          style={{
            marginTop: "16px",
            padding: "10px 12px",
            background: "var(--bg-inset)",
            borderRadius: "var(--radius-sm)",
            fontSize: "10px",
            color: "var(--text-muted)",
            lineHeight: 1.5,
            border: "1px solid var(--border-subtle)",
          }}
        >
          Each entry hashes its payload together with the previous entry&apos;s
          hash (SHA-256), so any retro-active edit breaks the chain and is
          detectable. Verification is deterministic and self-hosted — no external
          chain or gas fees — per the Digital Public Good transparency
          requirements.
        </div>
      )}
    </div>
  );
}
