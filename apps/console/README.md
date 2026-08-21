# resili Console

The public-facing dashboard for the resili climate-risk platform. It shows a
live **Mapbox** map of Lake Victoria Basin wards, each coloured by its ML flood
risk band, with explainable score panels, trigger approvals, CAP alerts, and the
tamper-evident audit ledger.

## Environment setup

The map needs a Mapbox access token. Copy the template and fill it in:

```bash
cp .env.example .env.local
# then edit .env.local and set NEXT_PUBLIC_MAPBOX_TOKEN
```

| Variable | Purpose | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox GL public (`pk.`) token for the basemap. Without it the map shows a setup hint. | _(required)_ |
| `NEXT_PUBLIC_API_BASE_URL` | Base URL of the Go API gateway that serves live risk data. | `http://localhost:8080` |

`.env.local` is git-ignored; only `.env.example` is committed.

## Getting started

```bash
pnpm install   # from the repo root (workspace)
pnpm --filter resili-console dev
# or, from this folder:
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How map + data connect

```
forecast-ingest (Python ML, :8001)
   └─ GET /predict/all  ──► gateway (Go, :8080)
         └─ GET /api/v1/wards/risk/all  (wraps as GeoJSON + ward centroids)
               └─ Console (this app)
                     ├─ RiskMap.tsx renders Mapbox markers per ward
                     └─ polls every 60s; audit ledger via /api/v1/ledger
```

- **Live mode:** when the gateway is reachable, the console fetches real ML
  scores and the audit ledger. The header shows a green **"Live data"** badge.
- **Demo mode:** if the gateway is down, the console falls back to the
  deterministic fixtures in `src/lib/demo-data.ts` (regenerated from the live
  model, so the map looks identical) and shows an amber **"Demo data"** badge.

Ward centroids are generalised to ward level per the project's climate-safety
guidelines (see `SECURITY.md`).
