"use client";

import React from "react";
import type { WardRisk } from "@/lib/types";

interface DetailPanelProps {
  ward: WardRisk;
  onBack: () => void;
}

const BAND_COLORS: Record<string, string> = {
  severe: "#ef4444",
  high: "#f97316",
  moderate: "#f59e0b",
  low: "#10b981",
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

export function DetailPanel({ ward, onBack }: DetailPanelProps) {
  const color = BAND_COLORS[ward.band] || "#3b82f6";
  const cleanName = ward.ward_id.replace("KE-039-", "");

  const sortedFeatures = Object.entries(ward.feature_contributions).sort(
    ([, a], [, b]) => Math.abs(b) - Math.abs(a)
  );

  const maxContribution = Math.max(
    ...Object.values(ward.feature_contributions).map((v) => Math.abs(v)),
    1
  );

  return (
    <div className="detail-panel" style={{ padding: 0 }}>
      {/* Back button */}
      <button
        onClick={onBack}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "transparent",
          border: "none",
          color: "var(--accent-primary)",
          fontSize: "12px",
          fontWeight: 600,
          cursor: "pointer",
          marginBottom: "16px",
          padding: 0,
        }}
      >
        ← Back to all wards
      </button>

      {/* Ward Header */}
      <div style={{ marginBottom: "16px" }}>
        <div style={{ fontSize: "18px", fontWeight: 800 }}>{cleanName} Ward</div>
        <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
          HDX P-Code: {ward.ward_id} • Centroid: [{ward.latitude.toFixed(3)}, {ward.longitude.toFixed(3)}]
        </div>
      </div>

      {/* Big Score Card */}
      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: "var(--radius-md)",
          padding: "16px",
          border: "1px solid var(--border-subtle)",
          marginBottom: "20px",
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
            <span
              style={{
                fontSize: "36px",
                fontWeight: 800,
                fontFamily: "JetBrains Mono, monospace",
                color,
                lineHeight: 1,
              }}
            >
              {ward.score.toFixed(1)}
            </span>
            <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>/ 100</span>
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <span className={`ward-card__band ward-card__band--${ward.band}`}>
            {ward.band}
          </span>
          <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
            Trigger: {ward.score >= 75 ? "ELIGIBLE" : "BELOW THRESHOLD"}
          </div>
        </div>
      </div>

      {/* Feature Contributions Section (Explainability) */}
      <div className="detail-section">
        <div className="detail-section__title">Explainable Factor Contributions</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {sortedFeatures.map(([key, val]) => {
            const label = FEATURE_LABELS[key] || key;
            const pct = Math.min(100, (Math.abs(val) / maxContribution) * 100);

            return (
              <div key={key} className="feature-bar">
                <div className="feature-bar__label" title={label}>
                  {label}
                </div>
                <div className="feature-bar__track">
                  <div
                    className="feature-bar__fill"
                    style={{
                      width: `${pct}%`,
                      background: val >= 10 ? color : "var(--accent-primary)",
                    }}
                  />
                </div>
                <div className="feature-bar__value">
                  {val.toFixed(1)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Natural Language Decision Support */}
      <div className="detail-section">
        <div className="detail-section__title">Model Explanation & Guidance</div>
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

      {/* Provenance & Safety Meta */}
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
        <div><strong>Model:</strong> {ward.model_version}</div>
        <div><strong>Input SHA-256:</strong> <code>{ward.inputs_hash}</code></div>
        <div><strong>Source:</strong> GloFAS, CHIRPS, Open-Meteo</div>
        <div><strong>Assessed UTC:</strong> {ward.assessed_at}</div>
      </div>
    </div>
  );
}
