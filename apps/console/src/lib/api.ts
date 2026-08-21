import type { AlertData } from "./types";

/**
 * Base URL of the Go API gateway.
 *
 * Configurable via `NEXT_PUBLIC_API_BASE_URL` so the console can point at a
 * staging/production gateway without a code change; defaults to the local
 * development gateway. Every network call in the app resolves through this
 * single source so there are no hardcoded hosts scattered across components.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

/** Shape of a single CAP alert as returned by the gateway `/api/v1/alerts`. */
interface GatewayCapAlert {
  identifier: string;
  sender: string;
  sent: string;
  status: string;
  info: {
    event: string;
    severity: string;
    description: string;
    instruction: string;
    expires: string;
    area: { area_desc: string };
  };
}

interface GatewayAlertsResponse {
  alerts: GatewayCapAlert[];
}

/**
 * Flattens the gateway's nested CAP 1.2 alert JSON into the console's
 * `AlertData` view model.
 */
function mapGatewayAlert(a: GatewayCapAlert): AlertData {
  return {
    identifier: a.identifier,
    sender: a.sender,
    sent: a.sent,
    status: a.status,
    severity: a.info.severity,
    event: a.info.event,
    description: a.info.description,
    instruction: a.info.instruction,
    area_desc: a.info.area.area_desc,
    expires: a.info.expires,
  };
}

/**
 * Fetches the live CAP alert feed from the gateway. Returns `null` on any
 * failure so the caller can fall back to deterministic seed data.
 */
export async function fetchAlerts(signal?: AbortSignal): Promise<AlertData[] | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v1/alerts`, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as GatewayAlertsResponse;
    if (!data.alerts || data.alerts.length === 0) return null;
    return data.alerts.map(mapGatewayAlert);
  } catch {
    return null;
  }
}
