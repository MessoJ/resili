"use client";

import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { WardRisk } from "@/lib/types";

interface RiskMapProps {
  wards: WardRisk[];
  selectedWard: WardRisk | null;
  onSelectWard: (ward: WardRisk) => void;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

const BAND_COLORS: Record<string, string> = {
  severe: "#ef4444",
  high: "#f97316",
  moderate: "#f59e0b",
  low: "#10b981",
};

export default function RiskMap({
  wards,
  selectedWard,
  onSelectWard,
}: RiskMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  useEffect(() => {
    if (!mapContainer.current) return;
    if (!MAPBOX_TOKEN) return; // No token — render the setup hint instead.

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [34.5, -0.1], // Centered around Lake Victoria Basin (Kisumu / Winam Gulf)
      zoom: 8.8,
      attributionControl: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");

    mapRef.current = map;

    return () => {
      map.remove();
    };
  }, []);

  // Update markers and view when wards or selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    wards.forEach((ward) => {
      if (!ward.latitude || !ward.longitude) return;

      const isSelected = selectedWard?.ward_id === ward.ward_id;
      const color = BAND_COLORS[ward.band] || "#3b82f6";

      // Create custom HTML marker element
      const el = document.createElement("div");
      el.className = `custom-map-marker ${isSelected ? "selected" : ""}`;
      el.style.cssText = `
        position: relative;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        transition: transform 0.2s ease;
      `;

      el.innerHTML = `
        <div style="
          position: absolute;
          width: ${isSelected ? "46px" : "36px"};
          height: ${isSelected ? "46px" : "36px"};
          border-radius: 50%;
          background: ${color};
          opacity: 0.25;
          animation: pulse 2s infinite ease-in-out;
        "></div>
        <div style="
          width: ${isSelected ? "34px" : "26px"};
          height: ${isSelected ? "34px" : "26px"};
          border-radius: 50%;
          background: ${color};
          border: 2px solid #ffffff;
          box-shadow: 0 0 12px ${color};
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 700;
          font-size: ${isSelected ? "12px" : "10px"};
          font-family: 'JetBrains Mono', monospace;
          z-index: 2;
        ">
          ${Math.round(ward.score)}
        </div>
        <div style="
          margin-top: 4px;
          padding: 2px 6px;
          background: rgba(10, 14, 23, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 4px;
          color: #f1f5f9;
          font-size: 10px;
          font-weight: 600;
          white-space: nowrap;
          backdrop-filter: blur(4px);
        ">
          ${ward.ward_id.replace("KE-039-", "")}
        </div>
      `;

      el.addEventListener("click", () => {
        onSelectWard(ward);
        map.flyTo({
          center: [ward.longitude, ward.latitude],
          zoom: 10.5,
          essential: true,
          speed: 1.2,
        });
      });

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([ward.longitude, ward.latitude])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [wards, selectedWard, onSelectWard]);

  // Fly to selected ward when selected outside of map click
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedWard) return;
    if (selectedWard.latitude && selectedWard.longitude) {
      map.flyTo({
        center: [selectedWard.longitude, selectedWard.latitude],
        zoom: 10.5,
        essential: true,
      });
    }
  }, [selectedWard]);

  if (!MAPBOX_TOKEN) {
    return (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0e17",
          color: "#f1f5f9",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "420px" }}>
          <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "8px" }}>
            Map basemap not configured
          </div>
          <div style={{ fontSize: "13px", color: "#94a3b8", lineHeight: 1.5 }}>
            Set <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> in{" "}
            <code>apps/console/.env.local</code> (copy from{" "}
            <code>.env.example</code>) and restart the dev server to render the
            interactive ward risk map.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapContainer} style={{ width: "100%", height: "100%" }} />

      {/* Map Legend Overlay */}
      <div
        style={{
          position: "absolute",
          bottom: "24px",
          left: "24px",
          background: "rgba(26, 34, 54, 0.9)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(148, 163, 184, 0.15)",
          borderRadius: "10px",
          padding: "12px 16px",
          color: "#f1f5f9",
          fontSize: "11px",
          zIndex: 10,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8" }}>
          Flood Risk Likelihood Band
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444" }}></span>
            <span>Severe Risk (75 - 100) — Trigger Threshold</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f97316" }}></span>
            <span>High Risk (50 - 74.9)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b" }}></span>
            <span>Moderate Risk (25 - 49.9)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981" }}></span>
            <span>Low Risk (0 - 24.9)</span>
          </div>
        </div>
        <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "10px", color: "#64748b" }}>
          Centroids generalised to ward level per KMD/NDMA guidelines
        </div>
      </div>
    </div>
  );
}
