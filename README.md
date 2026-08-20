# Rezili

**Climate risk intelligence that helps communities act before the water arrives.**

---

## What Rezili Does

Every year the rains come to western Kenya and people near the Nyando, Nzoia, and Yala rivers wait to see if this season will be the one that floods their homes. KMD issues forecasts. NDMA coordinates response. But the gap between a national 5-day forecast and a ward chief knowing whether to move people out of Kano Plains — that gap is measured in hours nobody has and data nobody can access.

Rezili closes that gap. It takes public forecast data from GloFAS, CHIRPS, and Open-Meteo, downscales it to the ward level using terrain and historical flood exposure, scores the combined risk with an explainable ML model, and — when the score crosses a transparent threshold with two-person approval — triggers an anticipatory cash transfer through M-Pesa before the water arrives.

It's not a weather app. It's a decision-support system that turns "it might rain a lot" into "Kochogo ward has a 78% chance of exceeding flood stage in 4 days — here's who to notify and here's the pre-approved payout."

## Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐
│ Data Ingest  │────▶│ Risk Engine  │────▶│  Trigger + Payout    │
│ (Python)     │     │ (XGBoost ML) │     │  (TypeScript + Go)   │
│              │     │              │     │                      │
│ • GloFAS     │     │ • Ward score │     │ • 2-person approval  │
│ • CHIRPS     │     │ • Explainable│     │ • Idempotent payout  │
│ • Open-Meteo │     │   features   │     │ • Hash-chain ledger  │
└──────────────┘     └──────┬───────┘     └──────────┬───────────┘
                            │                        │
                   ┌────────▼────────────────────────▼──────┐
                   │          API Gateway (Go)               │
                   │  • REST + rate limiting                 │
                   │  • CAP 1.2 alert feed                   │
                   │  • GeoJSON ward risk                    │
                   │  • USSD callback handler                │
                   └────────┬────────────────────┬──────────┘
                            │                    │
            ┌───────────────▼──┐       ┌─────────▼────────┐
            │  PostGIS + Redis │       │ Operations Console
            │                  │       │ (Next.js)        │
            │ • Ward geometry  │       │ • Live risk map  │
            │ • Risk history   │       │ • Trigger flow   │
            │ • Trigger audit  │       │ • Alert history  │
            └──────────────────┘       │ • USSD preview   │
                                       └──────────────────┘
```

## Tech Stack

| Language | What it builds | Why |
|---|---|---|
| **Python** | Data ingest, XGBoost flood risk model, FastAPI server | ML ecosystem, pandas/xarray for climate data |
| **Go** | API Gateway with rate limiting, USSD handler, CAP server | Fast single-binary, great concurrency for real-time |
| **TypeScript** | Core business logic (risk scoring, triggers, ledger, payout) | Strong types, testable, existing monorepo |
| **Next.js** | Operations Console portal | React, SSR for low-bandwidth |
| **SQL/PostGIS** | Migrations, ward geometry, spatial queries | Data integrity, geospatial |

## Data Sources

All data is publicly available and properly attributed:

- **GloFAS** — River discharge forecasts (Copernicus/ECMWF, via Open-Meteo)
- **CHIRPS** — Historical rainfall (Climate Hazards Center, UC Santa Barbara)
- **Open-Meteo** — Weather forecasts (CC-BY 4.0)
- **HDX COD-AB** — Kenya administrative boundaries (OCHA)
- **KNBS** — Population and poverty data (Kenya National Bureau of Statistics)

## Emerging Technology

| Category | Implementation |
|---|---|
| **AI & Data Intelligence** | XGBoost flood risk model with explainable feature contributions |
| **Cloud & Edge Computing** | Dockerised microservices, PostGIS, offline-first USSD |
| **Cybersecurity** | Signed alerts, rate-limited endpoints, hash-chain audit, PII minimisation |

## Local Setup

```bash
# 1. Clone and install TypeScript packages
git clone https://github.com/your-org/rezili.git
cd rezili
pnpm install
pnpm test

# 2. Start Python ML service
cd services/forecast-ingest
pip install -e ".[dev]"
python -m src.model.train
uvicorn src.api.serve:app --port 8001

# 3. Start Go API gateway
cd services/gateway
go run ./cmd/server

# 4. Start Operations Console
cd apps/command-centre
npm run dev

# Or use Docker for everything:
cd infrastructure
docker compose up
```

## Safety

Forecasts are probabilistic estimates, not certainty. Rezili supports, rather than replaces, Kenyan public warning authorities:

- Scores are **decision-support estimates**, not predictions of what will happen
- All alerts attribute **KMD** and **NDMA** as the authoritative sources
- Triggers require **dual approval** and produce a **tamper-evident audit trail**
- Public locations are generalised to the **ward level** — no household PII
- Outbound alerts are **signed** and public endpoints are **rate-limited**

See [`SECURITY.md`](SECURITY.md) and [`DO-NO-HARM.md`](DO-NO-HARM.md).

## SDG Alignment

| SDG | How Rezili contributes |
|---|---|
| **SDG 1** (No Poverty) | Anticipatory cash transfers protect livelihoods before disaster |
| **SDG 6** (Clean Water) | Lake Victoria water-body-adjacent monitoring |
| **SDG 11** (Sustainable Cities) | Community resilience for flood-prone urban areas |
| **SDG 13** (Climate Action) | Ward-level climate risk intelligence and early warning |
| **Sendai Framework Target G** | Tracks early warning reach as a reportable indicator |

## Credits

Rezili is built for the Zone01 Kisumu GreenTech Hackathon 2026 (Track 6: Climate Risk Intelligence). It selectively adapts verified infrastructure patterns from Kilimo Halisi; adapted source and test provenance is recorded alongside each imported component.

## Licence

[MIT](LICENSE)