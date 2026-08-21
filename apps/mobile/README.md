# apps/mobile — reserved (mobile reach is USSD + the console PWA)

resili's mobile strategy deliberately does **not** ship a native app store
build. In the Lake Victoria Basin, the reliable lowest common denominator is a
feature phone on an intermittent 2G link, so mobile reach is delivered by two
existing, tested surfaces instead:

1. **USSD (feature phones, no data, no smartphone required)**
   - Menu/routing logic: `packages/ussd-core` (Swahili, tested with Vitest).
   - Live callback endpoint: `services/gateway/internal/handler/ussd.go`,
     exercised by `infrastructure/scripts/verify_services.sh`.
   - Communicates likelihood only, attributes KMD/NDMA, generalises report
     locations to ward level, and minimises phone PII (per the climate-safety
     guardrails).

2. **Installable PWA (smartphones)**
   - `apps/console` is an installable progressive web app with an offline
     service worker (`apps/console/public/sw.js`) and a web manifest
     (`apps/console/public/manifest.json`), so officers and ward chiefs can
     "Add to Home Screen" and keep working when the network drops.

## Why this folder is empty

The original plan (`plan.md`) listed an `apps/mobile` lead, but a native build
would fragment effort and exclude the feature-phone majority. The USSD + PWA
combination reaches both feature phones and smartphones with code that is
already tested and demoable.

This folder is retained only as a signpost. If a native companion app is ever
required, scaffold it here as its own workspace package — it is already covered
by the `apps/*` glob in `pnpm-workspace.yaml`.
