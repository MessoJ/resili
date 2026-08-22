"use client";

import React, { useState } from "react";
import type { WardRisk } from "@/lib/types";
import { bandLabel, formatCount, wardDisplayName } from "@/lib/plain-language";

interface WardListProps {
  wards: WardRisk[];
  onSelectWard: (ward: WardRisk) => void;
}

const BAND_COLORS: Record<string, string> = {
  severe: "#cf5049",
  high: "#df7a3a",
  moderate: "#d6a13c",
  low: "#45b083",
};

export function WardList({ wards, onSelectWard }: WardListProps) {
  const [filter, setFilter] = useState<string>("all");

  const filteredWards = wards.filter((w) => {
    if (filter === "all") return true;
    return w.band === filter;
  });

  return (
    <div>
      {/* Risk Filter Chips */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "16px", flexWrap: "wrap" }}>
        {["all", "severe", "high", "moderate", "low"].map((b) => (
          <button
            key={b}
            onClick={() => setFilter(b)}
            style={{
              padding: "4px 10px",
              borderRadius: "9999px",
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "capitalize",
              border: "1px solid",
              borderColor: filter === b ? "var(--accent-primary)" : "var(--border-subtle)",
              background: filter === b ? "var(--accent-primary-dim)" : "var(--bg-card)",
              color: filter === b ? "var(--accent-primary)" : "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            {b} {b !== "all" && `(${wards.filter((w) => w.band === b).length})`}
          </button>
        ))}
      </div>

      {/* Ward Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {filteredWards.map((ward) => {
          const color = BAND_COLORS[ward.band] || "#6aa5b5";
          const cleanName = wardDisplayName(ward);

          return (
            <div
              key={ward.ward_id}
              className="ward-card"
              onClick={() => onSelectWard(ward)}
              style={{ "--spine": color } as React.CSSProperties}
            >
              <div className="ward-card__header">
                <div>
                  <div className="ward-card__name">{cleanName} Ward</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                    {formatCount(ward.population_at_risk)} people at risk
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span className={`ward-card__band ward-card__band--${ward.band}`}>
                    {bandLabel(ward.band)}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="ward-card__bar">
                <div
                  className="ward-card__bar-fill"
                  style={{
                    width: `${Math.min(100, ward.score)}%`,
                    background: color,
                  }}
                />
              </div>

              {/* Plain-language action signal */}
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{formatCount(ward.households_eligible)} households eligible</span>
                <span style={{ color: ward.score >= 75 ? "var(--risk-severe)" : "var(--text-muted)", fontWeight: 600 }}>
                  {ward.score >= 75 ? "Action needed" : "Monitoring"}
                </span>
              </div>
            </div>
          );
        })}

        {filteredWards.length === 0 && (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)" }}>
            No wards found matching the &quot;{filter}&quot; filter.
          </div>
        )}
      </div>
    </div>
  );
}
