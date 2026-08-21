# Team Roles & Codebase Assignment

Welcome to **resili** (Track 6: Climate Risk Intelligence, Zone01 Kisumu GreenTech Hackathon 2026).
Here is how our 5-person team is structured and the exact files each person owns.

---

## 🏛️ Role 1: Solution Architect / Data & ML / Pitch (Lead / You)
- **Focus:** System design, climate data ingest, ML flood risk model, data contracts, pitch deck & judge demo.
- **Owned Packages:**
  - `services/forecast-ingest/` (Python ML pipeline, XGBoost model, GloFAS/CHIRPS clients, FastAPI)
  - `packages/risk-core/`, `packages/trigger-core/`, `packages/ledger-core/`
  - `docs/PITCH.md`, `docs/DEMO-SCRIPT.md`, `README.md`

---

## 🎨 Role 2: Frontend Developer (Teammate 2)
- **Focus:** Operations Console UI, Mapbox/Leaflet views, Ward cards, and SME climate resilience features.
- **Owned Files:**
  - `apps/command-centre/src/components/SmePreparednessCard.tsx`
  - `apps/command-centre/src/components/WardList.tsx`
  - `apps/command-centre/src/components/DetailPanel.tsx`
- **Instructions & Simple TODOs:** See [`docs/team/TEAMMATE_2_FRONTEND.md`](TEAMMATE_2_FRONTEND.md)

---

## ⚙️ Role 3: Go Backend Developer (Teammate 3)
- **Focus:** Go API Gateway, REST endpoints, rate limiting, and SME advisory service.
- **Owned Files:**
  - `services/gateway/internal/handler/sme.go`
  - `services/gateway/internal/handler/sme_test.go`
  - `services/gateway/internal/handler/trigger.go`
- **Instructions & Simple TODOs:** See [`docs/team/TEAMMATE_3_BACKEND.md`](TEAMMATE_3_BACKEND.md)

---

## 🚀 Role 4: Data & DevOps Engineer (Teammate 4)
- **Focus:** Docker multi-service orchestration, PostGIS database migrations, evacuation center datasets, and service verification.
- **Owned Files:**
  - `infrastructure/data/seed-evacuation-centers.sql`
  - `infrastructure/scripts/verify_services.sh`
  - `infrastructure/docker-compose.yml`
- **Instructions & Simple TODOs:** See [`docs/team/TEAMMATE_4_DEVOPS.md`](TEAMMATE_4_DEVOPS.md)

---

## 📱 Role 5: Mobile, USSD & Offline UX (Teammate 5)
- **Focus:** Africa's Talking USSD flows in Swahili, low-bandwidth PWA offline caching, and community testing.
- **Owned Files:**
  - `apps/command-centre/public/sw.js`
  - `apps/command-centre/public/manifest.json`
  - `packages/ussd-core/src/index.ts`
- **Instructions & Simple TODOs:** See [`docs/team/TEAMMATE_5_MOBILE_PWA.md`](TEAMMATE_5_MOBILE_PWA.md)
