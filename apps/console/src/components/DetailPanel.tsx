"use client";

import React, { useState } from "react";
import type { WardRisk } from "@/lib/types";
import { KeyRiskDrivers } from "@/components/KeyRiskDrivers";
import {
  bandLabel,
  formatCount,
  recommendedAction,
  riskHeadline,
  wardDisplayName,
} from "@/lib/plain-language";

interface DetailPanelProps {
  ward: WardRisk;
  onBack: () => void;
  onOpenTriggers?: () => void;
}

const BAND_COLORS: Record<string, string> = {
  severe: "#cf5049",
  high: "#df7a3a",
  moderate: "#d6a13c",
  low: "#45b083",
};

const FEATURE_LABELS: Record<string, string> = {
  precip_3day_sum: "3-Day Precipitation Forecast",
  precip_5day_sum: "5-Day Cumulative Precip",
  precip_max_daily: "Peak Single-Day Rainfall",
  discharge_ratio: "River Discharge / Historical Mean",
  discharge_trend: "Discharge Rate of Rise",
  rainfall_anomaly: "Rainfall vs Historical Baseline",
  antecedent_moisture: "Soil Saturation Estimate",
  exposure_score: "Ward Exposure (Pop & Floodplain)",
  vulnerability_score: "Ward Socio-economic Vulnerability",
  flood_plain_fraction: "Floodplain Area Coverage",
  historical_flood_frequency: "Historical Catchment Frequency",
};

export function DetailPanel({ ward, onBack, onOpenTriggers }: DetailPanelProps) {
  const [showTechnical, setShowTechnical] = useState(false);
  const color = BAND_COLORS[ward.band] || "#6aa5b5";
  const name = wardDisplayName(ward);
  const eligible = ward.score >= 75;

  const sortedFeatures = Object.entries(ward.feature_contributions).sort(
    ([, a], [, b]) => Math.abs(b) - Math.abs(a)
  );
  const maxContribution = Math.max(
    ...Object.values(ward.feature_contributions).map((v) => Math.abs(v)),
    1
  );

  return (
    <div className="detail-panel" style={{ padding: 0 }}>
      <button onClick={onBack} className="detail-back">
        ← Back to all wards
      </button>

      {/* Plain-language headline — the "so what?" for a non-technical user */}
      <div
        className="detail-headline"
        style={{ borderLeft: `4px solid ${color}` }}
      >
        <div className="detail-headline__band" style={{ color }}>
          {bandLabel(ward.band)} risk
        </div>
        <div className="detail-headline__text">{riskHeadline(ward)}</div>
      </div>

      {/* People at risk — the metric an officer actually acts on */}
      <div className="detail-people">
        <div className="detail-people__stat">
          <span className="detail-people__value">{formatCount(ward.population_at_risk)}</span>
          <span className="detail-people__label">people at risk</span>
        </div>
        <div className="detail-people__stat">
          <span className="detail-people__value">{formatCount(ward.households_eligible)}</span>
          <span className="detail-people__label">households eligible for KES 500</span>
        </div>
      </div>

      {/* Recommended action + jump to the action workflow for severe wards */}
      <div className="detail-action" style={{ borderColor: color }}>
        <div className="detail-action__text">{recommendedAction(ward)}</div>
        {eligible && onOpenTriggers && (
          <button className="detail-action__cta" onClick={onOpenTriggers}>
            Review anticipatory payout →
          </button>
        )}
      </div>

      {/* Key risk drivers in plain language */}
      <div className="detail-section">
        <div className="detail-section__title">Key risk drivers</div>
        <KeyRiskDrivers ward={ward} />
      </div>

      {/* Technical detail — hidden by default behind an explicit toggle */}
      <button
        className="detail-tech-toggle"
        onClick={() => setShowTechnical((v) => !v)}
        aria-expanded={showTechnical}
      >
        {showTechnical ? "▾ Hide technical details" : "▸ View technical details"}
      </button>

      {showTechnical && (
        <>
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "var(--radius-md)",
              padding: "16px",
              border: "1px solid var(--border-subtle)",
              margin: "12px 0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                Impact-Based Risk Score
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginTop: "4px" }}>
                <span style={{ fontSize: "36px", fontWeight: 800, fontFamily: "var(--font-mono)", color, lineHeight: 1 }}>
                  {ward.score.toFixed(1)}
                </span>
                <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>/ 100</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span className={`ward-card__band ward-card__band--${ward.band}`}>{ward.band}</span>
              <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                Trigger: {eligible ? "ELIGIBLE" : "BELOW THRESHOLD"}
              </div>
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-section__title">Explainable Factor Contributions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {sortedFeatures.map(([key, val]) => {
                const label = FEATURE_LABELS[key] || key;
                const pct = Math.min(100, (Math.abs(val) / maxContribution) * 100);
                return (
                  <div key={key} className="feature-bar">
                    <div className="feature-bar__label" title={label}>{label}</div>
                    <div className="feature-bar__track">
                      <div
                        className="feature-bar__fill"
                        style={{ width: `${pct}%`, background: val >= 10 ? color : "var(--accent-primary)" }}
                      />
                    </div>
                    <div className="feature-bar__value">{val.toFixed(1)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="detail-section">
            <div className="detail-section__title">Model Explanation &amp; Guidance</div>
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: "var(--radius-sm)",
                padding: "12px",
                fontSize: "12px",
                lineHeight: 1.5,
                borderLeft: `3px solid ${color}`,
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {ward.explanation.map((item, idx) => (
                <div key={idx} style={{ color: idx === ward.explanation.length - 1 ? "var(--text-muted)" : "var(--text-secondary)" }}>
                  • {item}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              marginTop: "16px",
              padding: "12px",
              background: "rgba(10, 14, 23, 0.5)",
              borderRadius: "var(--radius-sm)",
              fontSize: "11px",
              color: "var(--text-muted)",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div><strong>Ward ID:</strong> {ward.ward_id} · Centroid [{ward.latitude.toFixed(3)}, {ward.longitude.toFixed(3)}]</div>
            <div><strong>Model:</strong> {ward.model_version}</div>
            <div><strong>Input SHA-256:</strong> <code>{ward.inputs_hash}</code></div>
            <div><strong>Source:</strong> GloFAS, CHIRPS, Open-Meteo</div>
            <div><strong>Assessed UTC:</strong> {ward.assessed_at}</div>
          </div>
        </>
      )}

      {/* Ward-level location note kept visible for context */}
      <div className="detail-provenance">
        Location generalised to {name} ward · Sources: KMD, NDMA, GloFAS, CHIRPS,
        Open-Meteo. This is a decision-support estimate, not a certainty.
      </div>
    </div>
  );
}
