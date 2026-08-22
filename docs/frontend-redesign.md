# Console redesign v1 — from analytical dashboard to command centre

This document captures the plan, rationale and design directions for the
console redesign, and records what shipped in this change. The goal, in one
line: **move the UI from "prove the model works" to "authorise the operation"**
so that non-technical county officials can use it with zero training.

## Who uses it (and what they need)

| Role | Primary job on the screen | Access |
|---|---|---|
| County Disaster Management Officer | Triage wards, give the **county** approval | view + approve (county) |
| NDMA Early Action Observer | Give the independent **second** approval | view + approve (NDMA) |
| Ward / Community Focal Point | Watch ward risk & alerts | read-only |
| Programme Administrator | Everything, incl. both approvals + technical audit | full |

Roles are enforced through a single `can(role, permission)` check
(`src/lib/auth.ts`). v1 keeps the session client-side (name + role in
`localStorage`, read via `useSyncExternalStore`) so the deployed demo needs no
auth backend; the shape is ready to be swapped for a gateway-issued session/JWT
without touching the components.

## Design principles

1. **Plain language first.** Every screen leads with a "so what?" sentence.
   Jargon (feature contributions, discharge ratios, SHA-256) lives behind an
   explicit *technical details* / *developer mode* toggle. The single
   translation boundary is `src/lib/plain-language.ts` — the
   "Decision-Maker Abstraction Layer". The rigorous numbers are never changed
   or removed, only demoted.
2. **Action-first hierarchy.** The most urgent thing on the screen is the thing
   you can do about it. Selecting a **severe** ward jumps straight to the
   **Take action** tab; the authorise button is the highest-contrast element on
   screen only when the system is waiting for the user's click.
3. **People, not IDs.** Internal references (`KE-039-NYANDO`) are replaced in the
   primary views by ward names and, crucially, **people / households at risk**.
4. **Climate-safety guardrails preserved.** Likelihood, never certainty;
   KMD/NDMA attributed; ward-level generalisation; dual approval + audit intact.

## What shipped

- **Sign-in gate** (`SignIn.tsx`) — name + role, low friction; recorded on the
  audit trail via the approval payload (`county:<name>`, `ndma:<name>`) instead
  of hardcoded approver IDs.
- **Basin overview** (`BasinSummary.tsx`) — an urgent alarm banner
  *"N wards require immediate action"* with people + households eligible for the
  KES 500 transfer, replacing the abstract `2/5` ratio.
- **Ward list** (`WardList.tsx`) — cards show **people at risk** and
  **households eligible** + an *Action needed / Monitoring* signal, instead of
  raw IDs and GloFAS point values.
- **Ward detail** (`DetailPanel.tsx`) — plain-language headline, people-at-risk
  stats, a recommended-action block with a *Review anticipatory payout* CTA, and
  **Key Risk Drivers** (`KeyRiskDrivers.tsx`) — icon + conversational sentence
  per driver (🌧️ heavy rainfall, 🌊 river levels, …). The score card, feature
  bars, model explanation and SHA meta are collapsed behind
  *View technical details*.
- **Take action** (`TriggerPanel.tsx`) — plain summary (households × KES 500 =
  total), Step 1 system check, Step 2 two-person approval highlighted when it
  needs attention, and a **dominant authorise button** that only turns solid
  brand-danger colour (with a subtle pulse) when both approvals are in. Approval
  checkboxes are **role-gated**: you can only tick the approval your role owns.
- **History** (`AuditLedger.tsx`) — a plain-English timeline
  ("Risk scored by system" → "Trigger decision recorded" → "Payout requested")
  with the cryptographic hashes hidden behind a *View technical audit data
  (developer mode)* toggle.
- **Header** — live/seed **forecast** status, the forecast **window**
  ("Next N days"), last **updated** time (EAT), signed-in user + role, sign-out.
- **Map** (`RiskMap.tsx`) — markers now use plain ward names.

## Live forecast

The console already polls the gateway every 60s and falls back to deterministic
seed data when offline; that behaviour is preserved and now gated on an active
session. The header surfaces the forecast horizon and last-sync time so users
can see the picture changes over time. Data model additions
(`population_at_risk`, `households_eligible`, `ward_name`, `river`,
`forecast_horizon_days`) are **optional** on `WardRisk`, so live gateway payloads
keep working and light up the new fields as the backend provides them.

## Secrets & deployment

- **Mapbox**: `NEXT_PUBLIC_MAPBOX_TOKEN` (see `apps/console/.env.example`). The
  map degrades to a clear "basemap not configured" panel when unset. For local
  testing copy `.env.example` → `.env.local`. The production token is already
  set on Render.
- **API gateway**: `NEXT_PUBLIC_API_BASE_URL` (single source for every call in
  `src/lib/api.ts`).
- No secrets are committed; hardcoded *data* has been removed from the primary
  views (seed data remains only as an explicit offline fallback, clearly
  labelled "Seed data" in the header).

## Follow-ups / not done in v1

- Real auth backend (JWT/session from the gateway) — the store is ready for it.
- True two-person separation (two distinct signed-in operators per payout);
  today a single admin can complete both steps for demo purposes.
- Backend-provided `population_at_risk` / `households_eligible` (currently seed
  values in `demo-data.ts`; wire the ML/gateway response to populate them).
- If a component library is desired for future polish, prefer a headless kit
  (Radix + the existing CSS tokens) over a heavy design system, to keep the
  low-bandwidth, instrument-panel aesthetic.
