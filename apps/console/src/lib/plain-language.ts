import type { WardRisk } from "./types";

/**
 * Decision-Maker Abstraction Layer.
 *
 * The ML risk engine speaks in feature contributions, discharge ratios and
 * SHA-256 digests. County duty officers, ward administrators and NDMA
 * observers do not. This module is the single translation boundary that turns
 * the rigorous, auditable model output into plain-language "so what?"
 * statements — without ever changing or hiding the underlying numbers, which
 * remain available behind an explicit "technical details" toggle.
 *
 * Climate-safety rules encoded here (see project guidelines):
 *  - never say flooding "will" happen — always likelihood + uncertainty;
 *  - attribute the authoritative sources (KMD / NDMA);
 *  - keep locations at ward level.
 */

export type Band = "low" | "moderate" | "high" | "severe";

/** Human-readable ward name, preferring the backend field when present. */
export function wardDisplayName(ward: WardRisk): string {
  if (ward.ward_name && ward.ward_name.trim().length > 0) return ward.ward_name;
  const slug = ward.ward_id.replace(/^KE-\d+-/, "").replace(/[-_]/g, " ");
  return slug
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Plain-language likelihood phrase for a risk band (never a certainty). */
export function likelihoodPhrase(band: Band): string {
  switch (band) {
    case "severe":
      return "a very high chance of flooding";
    case "high":
      return "a high chance of flooding";
    case "moderate":
      return "a moderate chance of flooding";
    default:
      return "a low chance of flooding";
  }
}

/** Short status word used on chips and headers. */
export function bandLabel(band: Band): string {
  return band.charAt(0).toUpperCase() + band.slice(1);
}

/**
 * One-sentence headline a non-technical user can act on. Uses the ward name,
 * the likelihood band and the forecast window, and stays probabilistic.
 */
export function riskHeadline(ward: WardRisk): string {
  const name = wardDisplayName(ward);
  const days = ward.forecast_horizon_days ?? 4;
  const pct = Math.round((ward.probability ?? ward.score / 100) * 100);
  return `${name} has ${likelihoodPhrase(ward.band)} within the next ${days} days (about ${pct}% likelihood, based on KMD/NDMA forecast data).`;
}

export interface RiskDriver {
  /** Emoji icon shown next to the driver. */
  icon: string;
  /** Short plain-language title, e.g. "Heavy rainfall". */
  title: string;
  /** Conversational "so what?" explanation. */
  text: string;
  /** Relative weight 0..1 used to size/emphasise the driver. */
  weight: number;
}

const DRIVER_META: Record<string, { icon: string; title: string; phrase: (v: number) => string }> = {
  discharge_ratio: {
    icon: "🌊",
    title: "River levels",
    phrase: () => "River discharge is running well above its normal level and rising.",
  },
  discharge_trend: {
    icon: "📈",
    title: "River rising fast",
    phrase: () => "The river is rising quickly compared with recent days.",
  },
  precip_5day_sum: {
    icon: "🌧️",
    title: "Heavy rainfall ahead",
    phrase: () => "Expected 5-day rainfall is severely above average for this area.",
  },
  precip_3day_sum: {
    icon: "🌧️",
    title: "Heavy rain in 3 days",
    phrase: () => "A large amount of rain is forecast over the next three days.",
  },
  precip_max_daily: {
    icon: "⛈️",
    title: "Intense downpours",
    phrase: () => "One or more days of very intense rainfall are expected.",
  },
  rainfall_anomaly: {
    icon: "📊",
    title: "Unusual rainfall",
    phrase: () => "Rainfall is much higher than the historical norm for this season.",
  },
  antecedent_moisture: {
    icon: "💧",
    title: "Saturated ground",
    phrase: () => "The soil is already wet, so new rain runs off into rivers faster.",
  },
  exposure_score: {
    icon: "🏘️",
    title: "People & homes exposed",
    phrase: () => "Many people and homes sit in the low-lying parts of this ward.",
  },
  vulnerability_score: {
    icon: "🤝",
    title: "Vulnerable community",
    phrase: () => "Households here have fewer resources to cope with a flood.",
  },
  flood_plain_fraction: {
    icon: "🗺️",
    title: "Low-lying floodplain",
    phrase: () => "A large share of the ward is flat floodplain that fills quickly.",
  },
  historical_flood_frequency: {
    icon: "📅",
    title: "History of flooding",
    phrase: () => "This ward has flooded before under similar conditions.",
  },
};

/**
 * Translates the top model feature contributions into plain-language risk
 * drivers, ordered by importance. Returns at most `limit` drivers whose
 * contribution is meaningful (> 0).
 */
export function keyRiskDrivers(ward: WardRisk, limit = 4): RiskDriver[] {
  const entries = Object.entries(ward.feature_contributions)
    .filter(([, v]) => Math.abs(v) > 0.001)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a));

  if (entries.length === 0) return [];
  const max = Math.abs(entries[0][1]) || 1;

  return entries.slice(0, limit).map(([key, value]) => {
    const meta = DRIVER_META[key];
    return {
      icon: meta?.icon ?? "•",
      title: meta?.title ?? key.replace(/_/g, " "),
      text: meta ? meta.phrase(value) : `Contributes ${value.toFixed(1)} points to the risk score.`,
      weight: Math.min(1, Math.abs(value) / max),
    };
  });
}

/** Formats a person count with a thousands separator, e.g. 48,200. */
export function formatCount(n: number | undefined): string {
  if (n === undefined || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-KE");
}

/**
 * Plain-language recommended action for a ward, mapped from the risk band.
 * This is guidance, not an instruction to the public — it always defers to
 * KMD/NDMA and county authorities.
 */
export function recommendedAction(ward: WardRisk): string {
  switch (ward.band) {
    case "severe":
      return "Requires immediate action: review the anticipatory payout and notify community focal points now.";
    case "high":
      return "Prepare to act: brief responders and pre-position resources; watch for escalation.";
    case "moderate":
      return "Keep watching: conditions are building but no action is due yet.";
    default:
      return "No action needed: risk is low across the forecast window.";
  }
}
