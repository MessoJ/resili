"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { WardList } from "@/components/WardList";
import { DetailPanel } from "@/components/DetailPanel";
import { TriggerPanel } from "@/components/TriggerPanel";
import { AlertTimeline } from "@/components/AlertTimeline";
import { AuditLedger } from "@/components/AuditLedger";
import type { WardRisk, LedgerData, AlertData } from "@/lib/types";
import { DEMO_WARD_RISKS, DEMO_LEDGER, DEMO_ALERTS } from "@/lib/demo-data";

// Leaflet must be loaded client-side only (no SSR for maps)
const RiskMap = dynamic(() => import("@/components/RiskMap"), { ssr: false });

// Base URL of the Go API gateway. Configurable via env so the console can
// point at a staging/prod gateway without a code change; defaults to local.
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

type TabId = "wards" | "triggers" | "alerts" | "ledger";

export default function CommandCentre() {
  const [wards, setWards] = useState<WardRisk[]>(DEMO_WARD_RISKS);
  const [selectedWard, setSelectedWard] = useState<WardRisk | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("wards");
  const [ledger, setLedger] = useState<LedgerData>(DEMO_LEDGER);
  const [alerts] = useState<AlertData[]>(DEMO_ALERTS);
  const [isLive, setIsLive] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<string>(
    new Date().toLocaleTimeString("en-KE", { timeZone: "Africa/Nairobi" })
  );

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
          <div className="app-header__logo">R</div>
          <div>
            <div className="app-header__title">resili Console</div>
            <div className="app-header__subtitle">
              Lake Victoria Basin — Climate Risk Intelligence
            </div>
          </div>
        </div>

        <div className="app-header__status">
          <div
            className="status-indicator"
            title={
              isLive
                ? "Connected to the API gateway — live ML risk scores"
                : "Gateway unreachable — showing deterministic demo data"
            }
          >
            <span
              className="status-dot"
              style={{ background: isLive ? "#10b981" : "#f59e0b" }}
            />
            {isLive ? "Live data" : "Demo data"}
          </div>
          <div className="status-indicator">
            Model: risk-ml-v0.1.0
          </div>
          <div className="status-indicator">
            Last update: {lastUpdate}
          </div>
          <div className="status-indicator">
            {wards.length} wards monitored
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
            <div className="sidebar__title">
              {selectedWard ? selectedWard.ward_id.split("-").pop() : "Overview"}
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
              <WardList
                wards={wards}
                onSelectWard={setSelectedWard}
              />
            )}

            {activeTab === "wards" && selectedWard && (
              <DetailPanel
                ward={selectedWard}
                onBack={() => setSelectedWard(null)}
              />
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
