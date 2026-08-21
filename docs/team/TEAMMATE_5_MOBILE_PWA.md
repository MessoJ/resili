# Teammate 5: Mobile & Offline UX Guide

## Your Mission
Ensure resili functions reliably for community members using feature phones via USSD and county field officers working in low-bandwidth / offline conditions (+1 bonus point in rubric).

## Files You Own
- `apps/console/public/sw.js` (Service Worker)
- `apps/console/public/manifest.json` (PWA Manifest)
- `packages/ussd-core/src/index.ts` (Swahili USSD logic)

## Status: COMPLETE ✅

1. **TODO 1 (done):** `apps/console/public/sw.js` now uses a network-first
   strategy for API GETs (`/api/v1/wards`, `/ledger`, `/alerts`) with an
   on-device cache, and when both network and cache miss it returns a proper
   JSON envelope (`{ status: "offline", notice, path, generated_at }`,
   `503`, `X-Resili-Offline: 1`). Non-GET (trigger/payout) requests are never
   intercepted so audited actions always reach the gateway online.
2. **TODO 2 (done):** `packages/ussd-core/src/index.ts` rewritten as a tested
   routing tree (`routeUssd` + `swahiliMenu`): probabilistic language only
   ("uwezekano"), KMD/NDMA + county attribution, ward-level report
   generalisation, false-report warning, and the payout guardrails
   (score ≥ 75, 3+ days lead, two-person approval). 14 Vitest cases cover it.
3. **TODO 3 (done):** Service worker is registered on window load via
   `apps/console/src/components/ServiceWorkerRegistrar.tsx`, mounted in
   `apps/console/src/app/layout.tsx`; the manifest is linked and a theme
   colour set via the Next `viewport` export.

### Verification
- `packages/ussd-core`: `vitest run` → 14 passed; `tsc --noEmit` clean.
- `apps/console`: `tsc --noEmit`, `next build`, and `eslint` all clean.
- The Go gateway `services/gateway/internal/handler/ussd.go` mirrors the same
  Swahili menu, keeping wire behaviour consistent with the TS reference.

## How to Test Your Work
1. **Test USSD:**
   ```bash
   curl -X POST http://localhost:8080/api/v1/ussd -d "text="
   curl -X POST http://localhost:8080/api/v1/ussd -d "text=1"
   ```
2. **Test Offline Mode:**
   Open Chrome DevTools &rarr; Application &rarr; Service Workers &rarr; Check "Offline". Reload the page &mdash; the cached map and ward cards should still load reliably!
