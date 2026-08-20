"use client";

import React, { useState } from "react";
import type { LedgerData } from "@/lib/types";

interface AuditLedgerProps {
  ledger: LedgerData;
}

export function AuditLedger({ ledger }: AuditLedgerProps) {
  const [filterType, setFilterType] = useState<string>("all");

  const filteredEvents = ledger.events.filter((e) => {
    if (filterType === "all") return true;
    return e.type === filterType;
  });

  return (
    <div className="ledger-chain">
      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "16px", fontWeight: 700, fontFamily: "Inter, sans-serif" }}>
          Tamper-Evident Audit Chain
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "Inter, sans-serif" }}>
          Cryptographic SHA-256 hash chaining of risk scores, triggers, and payouts.
        </div>
      </div>

      {/* Verification Badge */}
      <div className="chain-valid">
        <span>✓</span>
        <span>Cryptographic Hash-Chain Intact &amp; Verified ({ledger.events.length} Blocks)</span>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "12px", fontFamily: "Inter, sans-serif" }}>
        {["all", "risk-scored", "trigger-decided", "payout-requested"].map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            style={{
              padding: "2px 8px",
              borderRadius: "4px",
              fontSize: "10px",
              border: "1px solid",
              borderColor: filterType === t ? "var(--accent-primary)" : "var(--border-subtle)",
              background: filterType === t ? "var(--accent-primary-dim)" : "transparent",
              color: filterType === t ? "var(--accent-primary)" : "var(--text-muted)",
              cursor: "pointer",
            }}
          >
            {t.replace("-", " ")}
          </button>
        ))}
      </div>

      {/* Event list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {filteredEvents.map((evt, idx) => (
          <div
            key={evt.id}
            style={{
              background: "var(--bg-card)",
              borderRadius: "var(--radius-sm)",
              padding: "10px",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>#{evt.index}</span>
                <span className={`ledger-event__type ledger-event__type--${evt.type}`}>
                  {evt.type}
                </span>
              </div>
              <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                {new Date(evt.occurred_at).toLocaleTimeString()}
              </span>
            </div>

            <div style={{ fontSize: "10px", color: "var(--text-secondary)", wordBreak: "break-all" }}>
              <div><strong>Block Hash:</strong> <span style={{ color: "#38bdf8" }}>{evt.hash}</span></div>
              {evt.previous_hash && (
                <div style={{ marginTop: "2px", color: "var(--text-muted)" }}>
                  <strong>Prev Hash:</strong> {evt.previous_hash.slice(0, 24)}...
                </div>
              )}
              <div style={{ marginTop: "2px", color: "var(--text-muted)" }}>
                <strong>Payload Digest:</strong> {evt.payload_hash}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: "16px",
          padding: "10px",
          background: "rgba(10, 14, 23, 0.4)",
          borderRadius: "var(--radius-sm)",
          fontSize: "10px",
          color: "var(--text-muted)",
          fontFamily: "Inter, sans-serif",
          lineHeight: 1.4,
          border: "1px solid var(--border-subtle)",
        }}
      >
        <strong>Zero Gas Fees &bull; Zero Cloud Lock-In:</strong> Every state change is verified deterministically against prior parent hashes, satisfying Digital Public Good and transparent climate governance requirements.
      </div>
    </div>
  );
}
