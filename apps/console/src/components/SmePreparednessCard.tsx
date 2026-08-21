"use client";

import React, { useState } from "react";
import type { WardRisk } from "@/lib/types";

/**
 * SME Climate Preparedness Card.
 *
 * Displays actionable, tickable preparedness recommendations for local
 * businesses (e.g. shops in Ahero town, agro-dealers, smallholder fish
 * traders) based on the ward's current flood risk score, plus a copy-ready
 * community SMS broadcast template.
 *
 * Advisories are decision-support only: the copy always points recipients to
 * official KMD/NDMA directives and never impersonates an official warning
 * (climate-safety guardrail).
 */

interface SmePreparednessCardProps {
  ward: WardRisk | null;
}

export function SmePreparednessCard({ ward }: SmePreparednessCardProps) {
  // Tracks which checklist items the operator has ticked off. Keyed by the
  // item's index so a user can work through the list during an activation.
  const [checkedItems, setCheckedItems] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);

  const toggleItem = (idx: number) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  if (!ward) {
    return (
      <div style={{ padding: "16px", color: "var(--text-muted)", fontSize: "12px" }}>
        Select a ward to view SME business continuity recommendations.
      </div>
    );
  }

  const isSevere = ward.score >= 75;

  // Advisory checklist items based on severity
  const checklist = isSevere
    ? [
        "Elevate critical inventory & grain bags at least 1 metre off ground",
        "Back up digital records and disconnect low-lying electrical equipment",
        "Move livestock & mobile assets to designated sub-county high grounds",
        "Verify anticipatory M-Pesa liquidity transfer receipt for emergency supplies",
      ]
    : [
        "Monitor 3-day precipitation forecast & KMD county radio updates",
        "Inspect local drainage culverts near storefront / warehouse",
        "Keep emergency contact list for Nyando sub-county disaster desk handy",
      ];

  const smsSummary = `[resili SME ADVISORY - ${ward.ward_id.replace("KE-039-", "")}] Risk Score: ${ward.score.toFixed(1)} (${ward.band.toUpperCase()}). Action: ${checklist[0]}. Follow official KMD/NDMA directives.`;

  const handleCopySms = async () => {
    try {
      await navigator.clipboard.writeText(smsSummary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — leave the template
      // visible so the operator can copy it manually.
      setCopied(false);
    }
  };

  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: "var(--radius-md)",
        padding: "16px",
        border: "1px solid var(--border-subtle)",
        marginTop: "16px",
      }}
    >
      <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "4px" }}>
        SME Climate Preparedness &bull; {ward.ward_id.replace("KE-039-", "")}
      </div>
      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "12px" }}>
        Actionable business continuity checklist for local agri-business &amp; shops.
      </div>

      {/* Checklist items */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
        {checklist.map((item, idx) => {
          const checked = checkedItems.has(idx);
          return (
            <label
              key={idx}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                fontSize: "12px",
                color: checked ? "var(--text-muted)" : "var(--text-secondary)",
                cursor: "pointer",
                textDecoration: checked ? "line-through" : "none",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleItem(idx)}
                style={{ marginTop: "3px", accentColor: "var(--accent-primary)" }}
              />
              <span>{item}</span>
            </label>
          );
        })}
      </div>

      {/* SMS Dissemination preview */}
      <div
        style={{
          padding: "10px",
          background: "rgba(10, 14, 23, 0.6)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px", textTransform: "uppercase" }}>
          Community Broadcast SMS Template
        </div>
        <div style={{ fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--accent-primary)", marginBottom: "8px", lineHeight: 1.5 }}>
          {smsSummary}
        </div>
        <button
          onClick={handleCopySms}
          style={{
            padding: "4px 10px",
            fontSize: "11px",
            borderRadius: "4px",
            background: copied ? "var(--accent-success)" : "var(--accent-primary-dim)",
            color: copied ? "#ffffff" : "var(--accent-primary)",
            border: "1px solid var(--border-subtle)",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {copied ? "✓ Copied to Clipboard" : "Copy SMS Broadcast"}
        </button>
      </div>
    </div>
  );
}
