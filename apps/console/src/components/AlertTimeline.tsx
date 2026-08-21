"use client";

import React, { useState } from "react";
import type { AlertData } from "@/lib/types";

interface AlertTimelineProps {
  alerts: AlertData[];
}

export function AlertTimeline({ alerts }: AlertTimelineProps) {
  const [showXml, setShowXml] = useState<string | null>(null);

  const generateCapXml = (alert: AlertData) => {
    return `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>${alert.identifier}</identifier>
  <sender>${alert.sender}</sender>
  <sent>${alert.sent}</sent>
  <status>${alert.status}</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <category>Met</category>
    <event>${alert.event}</event>
    <urgency>Expected</urgency>
    <severity>${alert.severity}</severity>
    <certainty>Likely</certainty>
    <description>${alert.description}</description>
    <instruction>${alert.instruction}</instruction>
    <expires>${alert.expires}</expires>
    <area>
      <areaDesc>${alert.area_desc}</areaDesc>
    </area>
  </info>
</alert>`;
  };

  return (
    <div className="alert-timeline">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <div style={{ fontSize: "16px", fontWeight: 700 }}>CAP 1.2 Alert Feed</div>
          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
            Standardized Common Alerting Protocol (WMO/NDMA compliant)
          </div>
        </div>
        <span
          style={{
            padding: "2px 8px",
            background: "var(--accent-primary-dim)",
            color: "var(--accent-primary)",
            borderRadius: "9999px",
            fontSize: "11px",
            fontWeight: 600,
          }}
        >
          {alerts.length} Active
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {alerts.map((alert) => {
          const isSevere = alert.severity.toLowerCase() === "severe";
          const isXmlOpen = showXml === alert.identifier;

          return (
            <div
              key={alert.identifier}
              className={`alert-item ${isSevere ? "alert-item--severe" : "alert-item--moderate"}`}
            >
              <div className="alert-item__time">
                {new Date(alert.sent).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>

              <div className="alert-item__content">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div className="alert-item__title">{alert.event}</div>
                  <span
                    style={{
                      fontSize: "10px",
                      textTransform: "uppercase",
                      fontWeight: 700,
                      color: isSevere ? "var(--risk-severe)" : "var(--risk-moderate)",
                    }}
                  >
                    {alert.severity}
                  </span>
                </div>

                <div className="alert-item__body" style={{ marginTop: "4px" }}>
                  {alert.description}
                </div>

                <div
                  style={{
                    marginTop: "8px",
                    padding: "6px 8px",
                    background: "rgba(10, 14, 23, 0.6)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "11px",
                    color: "var(--text-muted)",
                  }}
                >
                  <strong>Instruction:</strong> {alert.instruction}
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "8px",
                    fontSize: "10px",
                    color: "var(--text-muted)",
                  }}
                >
                  <span>Area: {alert.area_desc}</span>
                  <button
                    onClick={() => setShowXml(isXmlOpen ? null : alert.identifier)}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "4px",
                      padding: "2px 6px",
                      color: "var(--accent-primary)",
                      cursor: "pointer",
                      fontSize: "10px",
                    }}
                  >
                    {isXmlOpen ? "Hide CAP XML" : "View CAP XML"}
                  </button>
                </div>

                {isXmlOpen && (
                  <pre
                    style={{
                      marginTop: "8px",
                      padding: "8px",
                      background: "#050811",
                      borderRadius: "4px",
                      fontFamily: "JetBrains Mono, monospace",
                      fontSize: "10px",
                      color: "#38bdf8",
                      overflowX: "auto",
                      whiteSpace: "pre-wrap",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    {generateCapXml(alert)}
                  </pre>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
