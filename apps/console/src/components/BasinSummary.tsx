"use client";

import React, { useMemo } from "react";
import type { WardRisk } from "@/lib/types";

interface BasinSummaryProps {
  wards: WardRisk[];
  onSelectWard: (ward: WardRisk) => void;
}

type Band = "severe" | "high" | "moderate" | "low";

const BAND_ORDER: Band[] = ["severe", "high", "moderate", "low"];
const BAND_VAR: Record<Band, string> = {
  severe: "var(--risk-severe)",
  high: "var(--risk-high)",
  moderate: "var(--risk-moderate)",
  low: "var(--risk-low)",
};

// BasinSummary is the "at a glance" readout shown above the ward list when no
// single ward is in focus. It answers the county duty officer's first three
// questions — how bad is it right now, where is worst, and is anything in the
// action window — without them scanning every card. It derives everything from
// the same live ward payload the rest of the console consumes; nothing here is
// hardcoded.
export function BasinSummary({ wards, onSelectWard }: BasinSummaryProps) {
  const stats = useMemo(() => {
    const total = wards.length || 1;
    const counts: Record<Band, number> = { severe: 0, high: 0, moderate: 0, low: 0 };
    for (const w of wards) {
      counts[w.band as Band] = (counts[w.band as Band] ?? 0) + 1;
    }
    const mean =
      wards.reduce((sum, w) => sum + w.score, 0) / (wards.length || 1);
    const peak = wards.reduce<WardRisk | null>(
      (top, w) => (top === null || w.score > top.score ? w : top),
      null
    );
    // Wards in the anticipatory-action window: severe band is the trigger
    // threshold (score >= 75), the same rule the gateway enforces.
    const actionable = wards.filter((w) => w.score >= 75).length;
    return { total, counts, mean, peak, actionable };
  }, [wards]);

  if (wards.length === 0) return null;

  const { total, counts, mean, peak, actionable } = stats;
  const cleanPeak = peak ? peak.ward_id.replace("KE-039-", "") : "—";

  return (
    <section className="basin-summary" aria-label="Basin overview">
      <div className="basin-summary__grid">
        <div className="basin-summary__stat">
          <span className="basin-summary__stat-label">Mean risk index</span>
          <span className="basin-summary__stat-value">{mean.toFixed(1)}</span>
        </div>
        <div className="basin-summary__stat">
          <span className="basin-summary__stat-label">In action window</span>
          <span
            className="basin-summary__stat-value"
            style={{ color: actionable > 0 ? "var(--risk-severe)" : "var(--text-primary)" }}
          >
            {actionable}
            <span className="basin-summary__stat-suffix">/{total}</span>
          </span>
        </div>
      </div>

      {peak && (
        <button
          className="basin-summary__peak"
          onClick={() => onSelectWard(peak)}
          style={{ "--spine": BAND_VAR[peak.band as Band] } as React.CSSProperties}
        >
          <span className="basin-summary__peak-label">Highest right now</span>
          <span className="basin-summary__peak-name">{cleanPeak} Ward</span>
          <span
            className="basin-summary__peak-score"
            style={{ color: BAND_VAR[peak.band as Band] }}
          >
            {peak.score.toFixed(1)}
          </span>
        </button>
      )}

      <div className="basin-summary__dist" role="img"
        aria-label={`Risk distribution across ${total} wards`}>
        {BAND_ORDER.map((band) => {
          const n = counts[band];
          if (n === 0) return null;
          return (
            <span
              key={band}
              className="basin-summary__dist-seg"
              style={{
                flexGrow: n,
                background: BAND_VAR[band],
              }}
              title={`${n} ${band}`}
            />
          );
        })}
      </div>
      <div className="basin-summary__legend">
        {BAND_ORDER.map((band) => (
          <span key={band} className="basin-summary__legend-item">
            <span
              className="basin-summary__legend-dot"
              style={{ background: BAND_VAR[band] }}
            />
            {counts[band]} {band}
          </span>
        ))}
      </div>
    </section>
  );
}
