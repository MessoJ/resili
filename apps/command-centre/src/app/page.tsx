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

type TabId = "wards" | "triggers" | "alerts" | "ledger";

export default function CommandCentre() {
  const [wards, setWards] = useState<WardRisk[]>(DEMO_WARD_RISKS);
  const [selectedWard, setSelectedWard] = useState<WardRisk | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("wards");
  const [ledger, setLedger] = useState<LedgerData>(DEMO_LEDGER);
  const [alerts, setAlerts] = useState<AlertData[]>(DEMO_ALERTS);
  const [lastUpdate, setLastUpdate] = useState<string>(
    new Date().toLocaleTimeString("en-KE", { timeZone: "Africa/Nairobi" })
  );

  // Try to fetch live data from the API gateway; fall back to demo data
  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("http://localhost:8080/api/v1/wards/risk/all");
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
          }
        }
      } catch {
        // API unavailable — use demo data (already set)
      }
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
            <div className="app-header__title">Rezili Operations Console</div>
            <div className="app-header__subtitle">
              Lake Victoria Basin — Climate Risk Intelligence
            </div>
          </div>
        </div>

        <div className="app-header__status">
          <div className="status-indicator">
            <span className="status-dot" />
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
