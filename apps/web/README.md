# apps/web — reserved (see `apps/console`)

The public-facing **web application for resili is `apps/console`**, a Next.js
(App Router) progressive web app. It is the single web surface for the project:

- Ward-level flood-risk map (Mapbox GL) driven by the live ML risk scores.
- County duty-officer console: ward risk, anticipatory-action triggers,
  CAP alerts, and the tamper-evident audit ledger.
- Installable PWA with an offline service worker (`apps/console/public/sw.js`),
  so it doubles as the "web + installable mobile" surface on low-bandwidth links.

## Why this folder is empty

The original plan (`plan.md`) sketched separate `apps/web` and `apps/mobile`
leads. During build-out the web surface was consolidated into a single,
well-tested console (`apps/console`) rather than split across two half-built
apps — this keeps `main` demoable and every component independently testable,
per the project engineering rules.

This folder is intentionally retained (not deleted) only as a signpost. If a
distinct marketing/public site is ever needed, scaffold it here as its own
workspace package (`apps/web`) — it is already covered by the `apps/*` glob in
`pnpm-workspace.yaml`.

Run the web app:

```bash
cd apps/console
pnpm install
pnpm dev   # http://localhost:3000
```
