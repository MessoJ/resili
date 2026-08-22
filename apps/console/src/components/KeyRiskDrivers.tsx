"use client";

import React from "react";
import type { WardRisk } from "@/lib/types";
import { keyRiskDrivers } from "@/lib/plain-language";

interface KeyRiskDriversProps {
  ward: WardRisk;
  limit?: number;
}

/**
 * Plain-language "Key Risk Drivers" — the human-readable replacement for the
 * raw feature-contribution bar chart. Each driver is an icon + a short "so
 * what?" sentence so a non-technical officer immediately understands *why* the
 * ward is at risk, not just by how many points a feature contributed.
 */
export function KeyRiskDrivers({ ward, limit = 4 }: KeyRiskDriversProps) {
  const drivers = keyRiskDrivers(ward, limit);
  if (drivers.length === 0) return null;

  return (
    <div className="drivers">
      {drivers.map((d) => (
        <div key={d.title} className="drivers__item">
          <span className="drivers__icon" aria-hidden="true">{d.icon}</span>
          <div className="drivers__body">
            <div className="drivers__title">{d.title}</div>
            <div className="drivers__text">{d.text}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
