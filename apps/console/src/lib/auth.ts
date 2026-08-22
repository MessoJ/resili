/**
 * Lightweight, role-based access model for the console.
 *
 * v1 keeps sessions client-side (a signed-in name + role stored in
 * localStorage) so the deployed demo needs no auth backend, while the shape is
 * ready to be swapped for a real gateway-issued session/JWT later: every
 * permission check goes through {@link can}, and the trigger workflow reads the
 * signed-in identity instead of hardcoded approver IDs.
 */

export type Role = "viewer" | "county_officer" | "ndma_observer" | "admin";

export interface Session {
  name: string;
  role: Role;
}

export interface RoleInfo {
  role: Role;
  label: string;
  blurb: string;
}

/** Ordered list of selectable roles for the sign-in screen. */
export const ROLES: RoleInfo[] = [
  {
    role: "county_officer",
    label: "County Disaster Management Officer",
    blurb: "Reviews risk and gives the county sign-off on anticipatory payouts.",
  },
  {
    role: "ndma_observer",
    label: "NDMA Early Action Observer",
    blurb: "Provides the independent second approval required for any payout.",
  },
  {
    role: "viewer",
    label: "Ward / Community Focal Point",
    blurb: "Monitors ward risk and alerts. Read-only access.",
  },
  {
    role: "admin",
    label: "Programme Administrator",
    blurb: "Full access, including both approval steps and technical audit data.",
  },
];

export type Permission =
  | "view"
  | "approve_county"
  | "approve_ndma"
  | "view_technical";

const PERMISSIONS: Record<Role, Permission[]> = {
  viewer: ["view"],
  county_officer: ["view", "approve_county"],
  ndma_observer: ["view", "approve_ndma"],
  admin: ["view", "approve_county", "approve_ndma", "view_technical"],
};

/** Returns true when the given role is granted the permission. */
export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return PERMISSIONS[role].includes(permission);
}

/** Human label for a role. */
export function roleLabel(role: Role): string {
  return ROLES.find((r) => r.role === role)?.label ?? role;
}

const STORAGE_KEY = "resili.session";

/** Reads the persisted session, or null when signed out / on the server. */
export function loadSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (parsed && typeof parsed.name === "string" && parsed.role) return parsed;
    return null;
  } catch {
    return null;
  }
}

/** Persists a session. */
export function saveSession(session: Session): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

/** Clears the persisted session (sign out). */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/* ---------------------------------------------------------------------------
 * Reactive session store (for React's useSyncExternalStore).
 *
 * Using an external store rather than an effect keeps sign-in state SSR-safe
 * (the server snapshot is always "signed out") and avoids calling setState
 * synchronously inside an effect.
 * ------------------------------------------------------------------------- */

type Listener = () => void;
const listeners = new Set<Listener>();
// `undefined` means "not yet read from storage"; null means signed out.
let current: Session | null | undefined = undefined;

/** Subscribe to session changes; returns an unsubscribe function. */
export function subscribeSession(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Current session snapshot for the client (lazily loaded from storage). */
export function getSessionSnapshot(): Session | null {
  if (current === undefined) current = loadSession();
  return current;
}

/** Server snapshot is always signed out — auth is client-side only. */
export function getServerSessionSnapshot(): Session | null {
  return null;
}

/** Signs in (or out, when passed null) and notifies subscribers. */
export function setCurrentSession(session: Session | null): void {
  current = session;
  if (session) saveSession(session);
  else clearSession();
  listeners.forEach((l) => l());
}
