"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { WardList } from "@/components/WardList";
import { BasinSummary } from "@/components/BasinSummary";
import { DetailPanel } from "@/components/DetailPanel";
import { SmePreparednessCard } from "@/components/SmePreparednessCard";
import { TriggerPanel } from "@/components/TriggerPanel";
import { AlertTimeline } from "@/components/AlertTimeline";
import { AuditLedger } from "@/components/AuditLedger";
import { SignIn } from "@/components/SignIn";
import type { WardRisk, LedgerData, AlertData } from "@/lib/types";
import { DEMO_WARD_RISKS, DEMO_LEDGER, DEMO_ALERTS } from "@/lib/demo-data";
import { API_BASE_URL, fetchAlerts } from "@/lib/api";
import {
  subscribeSession,
  getSessionSnapshot,
  getServerSessionSnapshot,
  setCurrentSession,
  roleLabel,
  type Session,
} from "@/lib/auth";
import { wardDisplayName } from "@/lib/plain-language";

// Mapbox GL must be loaded client-side only (no SSR for maps)
const RiskMap = dynamic(() => import("@/components/RiskMap"), { ssr: false });

type TabId = "wards" | "triggers" | "alerts" | "ledger";

export default function Console() {
  const session = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot
  );
  const [wards, setWards] = useState<WardRisk[]>(DEMO_WARD_RISKS);
  const [selectedWard, setSelectedWard] = useState<WardRisk | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("wards");
  const [ledger, setLedger] = useState<LedgerData>(DEMO_LEDGER);
  const [alerts, setAlerts] = useState<AlertData[]>(DEMO_ALERTS);
  const [isLive, setIsLive] = useState<boolean>(false);
  // Initialised empty to avoid SSR/CSR hydration mismatch — the timestamp is
  // populated on the client after mount (see useEffect below).
  const [lastUpdate, setLastUpdate] = useState<string>("");

  const handleSignIn = (s: Session) => {
    setCurrentSession(s);
  };

  const handleSignOut = () => {
    setCurrentSession(null);
    setSelectedWard(null);
    setActiveTab("wards");
  };

  // Action-first behaviour: selecting a ward in the severe band jumps straight
  // to the payout workflow, the operator's actual job for that ward.
  const handleSelectWard = (ward: WardRisk | null) => {
    setSelectedWard(ward);
    if (ward && ward.score >= 75) setActiveTab("triggers");
    else setActiveTab("wards");
  };

  // Try to fetch live data from the API gateway; fall back to demo data.
  useEffect(() => {
    if (!session) return;

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
  }, [session]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "wards", label: "Ward risk" },
    { id: "triggers", label: "Take action" },
    { id: "alerts", label: "Alerts" },
    { id: "ledger", label: "History" },
  ];

  if (!session) return <SignIn onSignIn={handleSignIn} />;

  const actionCount = wards.filter((w) => w.score >= 75).length;
  const horizon = wards[0]?.forecast_horizon_days ?? 4;

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="app-header__brand">
          <span className="app-header__mark" aria-hidden="true">
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
              Lake Victoria Basin · Flood early-action command centre
            </span>
          </span>
        </div>

        <div className="app-header__status">
          <div
            className="statbar"
            title={
              isLive
                ? "Connected to the API gateway — live forecast, risk scores and history"
                : "Gateway unreachable — showing deterministic seed data"
            }
          >
            <span className="statbar__label">Forecast</span>
            <span className="statbar__value">
              <span className={`source-flag ${isLive ? "source-flag--live" : "source-flag--seed"}`} />
              {isLive ? "Live" : "Seed data"}
            </span>
          </div>
          <div className="statbar">
            <span className="statbar__label">Window</span>
            <span className="statbar__value">Next {horizon} days</span>
          </div>
          <div className="statbar">
            <span className="statbar__label">Updated</span>
            <span className="statbar__value" suppressHydrationWarning>
              {lastUpdate ? `${lastUpdate} EAT` : "—"}
            </span>
          </div>
          <div className="app-header__user">
            <div className="app-header__user-name">{session.name}</div>
            <div className="app-header__user-role">{roleLabel(session.role)}</div>
          </div>
          <button className="app-header__signout" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="map-container">
          <RiskMap
            wards={wards}
            selectedWard={selectedWard}
            onSelectWard={handleSelectWard}
          />
        </div>

        <aside className="sidebar">
          <div className="sidebar__header">
            <div className="sidebar__eyebrow">
              {selectedWard ? "Ward focus" : "Basin overview"}
            </div>
            <div className="sidebar__title">
              {selectedWard ? `${wardDisplayName(selectedWard)} Ward` : "Lake Victoria Basin"}
            </div>
            <div className="sidebar__tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`sidebar__tab ${activeTab === tab.id ? "sidebar__tab--active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                  {tab.id === "triggers" && actionCount > 0 && (
                    <span className="sidebar__tab-badge">{actionCount}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="sidebar__content">
            {activeTab === "wards" && !selectedWard && (
              <>
                <BasinSummary wards={wards} onSelectWard={handleSelectWard} />
                <WardList wards={wards} onSelectWard={handleSelectWard} />
              </>
            )}

            {activeTab === "wards" && selectedWard && (
              <>
                <DetailPanel
                  ward={selectedWard}
                  onBack={() => setSelectedWard(null)}
                  onOpenTriggers={() => setActiveTab("triggers")}
                />
                <SmePreparednessCard ward={selectedWard} />
              </>
            )}

            {activeTab === "triggers" && (
              <TriggerPanel selectedWard={selectedWard} session={session} />
            )}

            {activeTab === "alerts" && <AlertTimeline alerts={alerts} />}

            {activeTab === "ledger" && <AuditLedger ledger={ledger} />}
          </div>
        </aside>
      </main>
    </div>
  );
}
