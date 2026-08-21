"use client";

import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { WardRisk } from "@/lib/types";
import { WARD_POLYGONS, WARD_POLYGON_BY_ID } from "@/lib/ward-polygons";

interface RiskMapProps {
  wards: WardRisk[];
  selectedWard: WardRisk | null;
  onSelectWard: (ward: WardRisk) => void;
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

// Risk-band colours mirror the CSS design tokens (--risk-*) so the map and the
// panels read as one system.
const BAND_COLORS: Record<string, string> = {
  severe: "#cf5049",
  high: "#df7a3a",
  moderate: "#d6a13c",
  low: "#45b083",
};

const WARDS_SOURCE = "resili-wards";
const WARDS_FILL_LAYER = "resili-wards-fill";
const WARDS_OUTLINE_LAYER = "resili-wards-outline";
const WARDS_SELECTED_LAYER = "resili-wards-selected";

function buildWardFeatureCollection(
  wards: WardRisk[]
): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  const byId = new Map(wards.map((w) => [w.ward_id, w]));
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = WARD_POLYGONS.map((wp) => {
    const risk = byId.get(wp.ward_id);
    return {
      type: "Feature",
      properties: {
        ward_id: wp.ward_id,
        name: wp.name,
        band: risk?.band ?? "low",
        score: risk?.score ?? 0,
        color: BAND_COLORS[risk?.band ?? "low"] ?? BAND_COLORS.low,
      },
      geometry: {
        type: "Polygon",
        coordinates: [wp.polygon],
      },
    };
  });
  return { type: "FeatureCollection", features };
}

export default function RiskMap({
  wards,
  selectedWard,
  onSelectWard,
}: RiskMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const badgeMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const styleReadyRef = useRef(false);
  const wardsRef = useRef<WardRisk[]>(wards);
  const onSelectRef = useRef(onSelectWard);

  // Keep the latest wards / callback available to map event handlers
  // without re-registering them on every render.
  useEffect(() => {
    wardsRef.current = wards;
  }, [wards]);
  useEffect(() => {
    onSelectRef.current = onSelectWard;
  }, [onSelectWard]);

  useEffect(() => {
    if (!mapContainer.current) return;
    if (!MAPBOX_TOKEN) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [34.5, -0.1],
      zoom: 8.2,
      attributionControl: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      map.addSource(WARDS_SOURCE, {
        type: "geojson",
        data: buildWardFeatureCollection(wardsRef.current),
      });

      // Fill layer — the ward AREA. Uses the per-feature colour and
      // scales opacity a touch with zoom so it reads as a region up close
      // instead of a flat wash.
      map.addLayer({
        id: WARDS_FILL_LAYER,
        type: "fill",
        source: WARDS_SOURCE,
        paint: {
          "fill-color": ["get", "color"],
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            7, 0.22,
            10, 0.42,
            13, 0.55,
          ],
        },
      });

      // Crisp outline so the ward reads as a bounded area at every zoom.
      map.addLayer({
        id: WARDS_OUTLINE_LAYER,
        type: "line",
        source: WARDS_SOURCE,
        paint: {
          "line-color": ["get", "color"],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            7, 1.2,
            11, 2.0,
            14, 3.0,
          ],
          "line-opacity": 0.95,
        },
      });

      // Selected-ward emphasis: thicker light halo.
      map.addLayer({
        id: WARDS_SELECTED_LAYER,
        type: "line",
        source: WARDS_SOURCE,
        paint: {
          "line-color": "#e9efec",
          "line-width": 2.4,
          "line-opacity": 0.9,
        },
        filter: ["==", ["get", "ward_id"], ""],
      });

      map.on("click", WARDS_FILL_LAYER, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const wardId = (f.properties as { ward_id?: string })?.ward_id;
        if (!wardId) return;
        const ward = wardsRef.current.find((w) => w.ward_id === wardId);
        if (ward) onSelectRef.current(ward);
      });
      map.on("mouseenter", WARDS_FILL_LAYER, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", WARDS_FILL_LAYER, () => {
        map.getCanvas().style.cursor = "";
      });

      styleReadyRef.current = true;

      // Fit to the union of ward polygons on first load.
      const fc = buildWardFeatureCollection(wardsRef.current);
      const bounds = new mapboxgl.LngLatBounds();
      fc.features.forEach((f) =>
        f.geometry.coordinates[0].forEach((c) =>
          bounds.extend(c as [number, number])
        )
      );
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 60, duration: 0, maxZoom: 9.2 });
      }
    });

    return () => {
      styleReadyRef.current = false;
      map.remove();
    };
  }, []);

  // Refresh polygon colours + score badges when ward data changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;

    const source = map.getSource(WARDS_SOURCE) as
      | mapboxgl.GeoJSONSource
      | undefined;
    if (source) {
      source.setData(buildWardFeatureCollection(wards));
    }

    // Redraw score badges (label chips) at each ward centroid.
    badgeMarkersRef.current.forEach((m) => m.remove());
    badgeMarkersRef.current = [];

    wards.forEach((ward) => {
      if (!WARD_POLYGON_BY_ID[ward.ward_id]) return;
      if (!ward.latitude || !ward.longitude) return;

      const color = BAND_COLORS[ward.band] ?? BAND_COLORS.low;
      const isSelected = selectedWard?.ward_id === ward.ward_id;

      const el = document.createElement("div");
      el.className = "ward-marker";
      el.innerHTML = `
        <div class="ward-marker__dot" style="
          width: ${isSelected ? 34 : 28}px;
          height: ${isSelected ? 34 : 28}px;
          background: ${color};
          border: 2px solid ${isSelected ? "#e9efec" : "rgba(233,239,236,0.65)"};
          font-size: ${isSelected ? "12px" : "11px"};
        ">${Math.round(ward.score)}</div>
        <div class="ward-marker__label">${ward.ward_id.replace("KE-039-", "")}</div>
      `;
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        onSelectRef.current(ward);
      });

      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([ward.longitude, ward.latitude])
        .addTo(map);
      badgeMarkersRef.current.push(marker);
    });
  }, [wards, selectedWard]);

  // Update the selected-ward outline filter and fly to it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReadyRef.current) return;

    map.setFilter(WARDS_SELECTED_LAYER, [
      "==",
      ["get", "ward_id"],
      selectedWard?.ward_id ?? "",
    ]);

    if (!selectedWard) return;
    const wp = WARD_POLYGON_BY_ID[selectedWard.ward_id];
    if (wp) {
      const bounds = new mapboxgl.LngLatBounds();
      wp.polygon.forEach((c) => bounds.extend(c as [number, number]));
      map.fitBounds(bounds, { padding: 120, maxZoom: 11, duration: 900 });
    } else if (selectedWard.latitude && selectedWard.longitude) {
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
          background: "var(--bg-inset)",
          color: "var(--text-primary)",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "420px" }}>
          <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "8px" }}>
            Map basemap not configured
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5 }}>
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

      {/* Risk-scale legend */}
      <div className="map-legend">
        <div className="map-legend__title">Flood-risk likelihood band</div>
        <div className="map-legend__row">
          <span className="map-legend__swatch" style={{ background: "var(--risk-severe)" }} />
          <span>Severe · 75–100 (trigger threshold)</span>
        </div>
        <div className="map-legend__row">
          <span className="map-legend__swatch" style={{ background: "var(--risk-high)" }} />
          <span>High · 50–74.9</span>
        </div>
        <div className="map-legend__row">
          <span className="map-legend__swatch" style={{ background: "var(--risk-moderate)" }} />
          <span>Moderate · 25–49.9</span>
        </div>
        <div className="map-legend__row" style={{ marginBottom: 0 }}>
          <span className="map-legend__swatch" style={{ background: "var(--risk-low)" }} />
          <span>Low · 0–24.9</span>
        </div>
        <div className="map-legend__note">
          Likelihood, not certainty. Ward polygons are illustrative
          generalisations, not survey-grade boundaries.
        </div>
      </div>
    </div>
  );
}
