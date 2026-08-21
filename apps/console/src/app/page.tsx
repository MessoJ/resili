"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { WardList } from "@/components/WardList";
import { BasinSummary } from "@/components/BasinSummary";
import { DetailPanel } from "@/components/DetailPanel";
import { SmePreparednessCard } from "@/components/SmePreparednessCard";
import { TriggerPanel } from "@/components/TriggerPanel";
import { AlertTimeline } from "@/components/AlertTimeline";
import { AuditLedger } from "@/components/AuditLedger";
import type { WardRisk, LedgerData, AlertData } from "@/lib/types";
import { DEMO_WARD_RISKS, DEMO_LEDGER, DEMO_ALERTS } from "@/lib/demo-data";
import { API_BASE_URL, fetchAlerts } from "@/lib/api";

// Mapbox GL must be loaded client-side only (no SSR for maps)
const RiskMap = dynamic(() => import("@/components/RiskMap"), { ssr: false });

type TabId = "wards" | "triggers" | "alerts" | "ledger";

export default function Console() {
  const [wards, setWards] = useState<WardRisk[]>(DEMO_WARD_RISKS);
  const [selectedWard, setSelectedWard] = useState<WardRisk | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("wards");
  const [ledger, setLedger] = useState<LedgerData>(DEMO_LEDGER);
  const [alerts, setAlerts] = useState<AlertData[]>(DEMO_ALERTS);
  const [isLive, setIsLive] = useState<boolean>(false);
  // Initialised empty to avoid SSR/CSR hydration mismatch — the timestamp is
  // populated on the client after mount (see useEffect below).
  const [lastUpdate, setLastUpdate] = useState<string>("");

  // Try to fetch live data from the API gateway; fall back to demo data.
  // The gateway proxies live ward risk from the Python ML service and
  // serves the audit ledger, so a single reachable gateway lights up the
  // whole console. If any call fails we keep the deterministic fixtures.
  useEffect(() => {
    async function fetchData() {
      let anyLive = false;

      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/wards/risk/all`);
        if (response.ok) {
          const data = await response.json();
          if (data.features && data.features.length > 0) {
            const liveWards: WardRisk[] = data.features.map(
              (f: { properties: WardRisk; geometry: { coordinates: number[] } | null }) => ({
                ...f.properties,
                latitude: f.geometry?.coordinates?.[1] ?? 0,
                longitude: f.geometry?.coordinates?.[0] ?? 0,
              })
            );
            setWards(liveWards);
            anyLive = true;
          }
        }
      } catch {
        // Ward risk endpoint unavailable — keep demo ward data.
      }

      try {
        const ledgerResp = await fetch(`${API_BASE_URL}/api/v1/ledger`);
        if (ledgerResp.ok) {
          const ledgerData = (await ledgerResp.json()) as LedgerData;
          if (ledgerData.events && ledgerData.events.length > 0) {
            setLedger(ledgerData);
            anyLive = true;
          }
        }
      } catch {
        // Ledger endpoint unavailable — keep demo ledger.
      }

      // Live CAP alert feed from the gateway; falls back to seed alerts.
      const liveAlerts = await fetchAlerts();
      if (liveAlerts) {
        setAlerts(liveAlerts);
        anyLive = true;
      }

      setIsLive(anyLive);
      setLastUpdate(
        new Date().toLocaleTimeString("en-KE", { timeZone: "Africa/Nairobi" })
      );
    }

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every 60s
    return () => clearInterval(interval);
  }, []);

  const tabs: { id: TabId; label: string }[] = [
    { id: "wards", label: "Ward Risk" },
    { id: "triggers", label: "Triggers" },
    { id: "alerts", label: "Alerts" },
    { id: "ledger", label: "Audit" },
  ];

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__mark" aria-hidden="true">
            {/* Bespoke basin waterline mark */}
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M4 16 Q14 9 24 16" />
              <path d="M6.5 11.5 Q14 6.5 21.5 11.5" opacity="0.6" />
              <path d="M9 20.5 Q14 16.5 19 20.5" opacity="0.4" />
              <circle cx="14" cy="22" r="1.3" fill="currentColor" stroke="none" />
            </svg>
          </span>
          <span className="app-header__wordmark">
            <span className="app-header__title">resili</span>
            <span className="app-header__subtitle">
              Lake Victoria Basin · Climate Risk Intelligence
            </span>
          </span>
        </div>

        <div className="app-header__status">
          <div
            className="statbar"
            title={
              isLive
                ? "Connected to the API gateway — live ML risk scores, ledger and alerts"
                : "Gateway unreachable — showing deterministic seed data"
            }
          >
            <span className="statbar__label">Source</span>
            <span className="statbar__value">
              <span className={`source-flag ${isLive ? "source-flag--live" : "source-flag--seed"}`} />
              {isLive ? "API gateway" : "Seed data"}
            </span>
          </div>
          <div className="statbar">
            <span className="statbar__label">Model</span>
            <span className="statbar__value">risk-ml-v0.1.0</span>
          </div>
          <div className="statbar">
            <span className="statbar__label">Last sync</span>
            <span className="statbar__value" suppressHydrationWarning>
              {lastUpdate ? `${lastUpdate} EAT` : "—"}
            </span>
          </div>
          <div className="statbar">
            <span className="statbar__label">Coverage</span>
            <span className="statbar__value">{wards.length} wards</span>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="map-container">
          <RiskMap
            wards={wards}
            selectedWard={selectedWard}
            onSelectWard={setSelectedWard}
          />
        </div>

        <aside className="sidebar">
          <div className="sidebar__header">
            <div className="sidebar__eyebrow">
              {selectedWard ? "Ward focus" : "Basin overview"}
            </div>
            <div className="sidebar__title">
              {selectedWard
                ? `${selectedWard.ward_id.replace("KE-039-", "").charAt(0)}${selectedWard.ward_id.replace("KE-039-", "").slice(1).toLowerCase()} Ward`
                : "Lake Victoria Basin"}
            </div>
            <div className="sidebar__tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`sidebar__tab ${activeTab === tab.id ? "sidebar__tab--active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar__content">
            {activeTab === "wards" && !selectedWard && (
              <>
                <BasinSummary wards={wards} onSelectWard={setSelectedWard} />
                <WardList
                  wards={wards}
                  onSelectWard={setSelectedWard}
                />
              </>
            )}

            {activeTab === "wards" && selectedWard && (
              <>
                <DetailPanel
                  ward={selectedWard}
                  onBack={() => setSelectedWard(null)}
                />
                <SmePreparednessCard ward={selectedWard} />
              </>
            )}

            {activeTab === "triggers" && (
              <TriggerPanel selectedWard={selectedWard} />
            )}

            {activeTab === "alerts" && (
              <AlertTimeline alerts={alerts} />
            )}

            {activeTab === "ledger" && (
              <AuditLedger ledger={ledger} />
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
