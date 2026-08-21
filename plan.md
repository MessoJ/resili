# TAHADHARI — Zone01 Kisumu GreenTech Hackathon 2026 Build Plan
### Track 6: Climate Risk Intelligence & Resilience Platform
> *Tahadhari* (Swahili: "caution / early warning"). Working name; alternatives in §12.

**Audience:** the build agent (Junie/Claude) + the human team.
**Read this whole file before writing a single line of code.**

> ⚠️ **UPDATE: UNEP will be in the room.** Read **§15 (The UNEP Play)** together with §10 and §11 — it changes the pitch framing, adds five cheap-but-decisive build items (CAP 1.2 alert export, open licence + DPG docs, SDG/Sendai indicator export, nature-based adaptation layer, compute-footprint reporting), and defines the ask. §15 overrides §11.2 and §12.3 where they conflict.

---

## 0. TL;DR — What We Are Building

A **county-grade climate risk intelligence and anticipatory-action platform** for the Lake Victoria Basin that does one thing no other team will do:

> **It does not stop at showing risk. It closes the loop from forecast → ward-level risk score → verifiable trigger → cash in a farmer's M-Pesa wallet, 3–7 days BEFORE the flood hits — with every trigger decision hash-anchored so nobody can dispute why money moved.**

Three surfaces, one brain:

| Surface | User | Tech |
|---|---|---|
| **Mobile app (offline-first)** | Farmer / household in Kano Plains, Budalangi, Nyando | Expo + SQLite + SMS/USSD fallback |
| **Web command centre** | Kisumu County Climate Change Unit, NDMA, Red Cross, SME | Next.js 15 App Router + MapLibre |
| **USSD / SMS** | The 40% with feature phones | Go service + Africa's Talking |

Powered by: GloFAS river-discharge forecasts + ERA5 reanalysis + CMIP6 projections + crowdsourced ground truth, fused by an ML risk model, executed by an on-chain-anchored trigger engine, paid out over M-Pesa B2C.

---

## 1. Verdict on Kilimo Halisi (`shalisi`) vs Track 6

### 1.1 Honest fit score

| Dimension | Verdict |
|---|---|
| **Domain fit** | ❌ 3/10 as-is. Kilimo Halisi is an *agri-health + commerce* platform (disease triage, vet consults, agrovet marketplace, farm tourism). Track 6 is *climate risk intelligence*. Submitting it re-skinned = judges smell "recycled project" and we lose Innovation (15%) and Problem Relevance (20%). |
| **Engineering fit** | ✅ 9/10. The *plumbing* is exactly what Track 6 needs and is worth ~20 of our 48 hours. |
| **Narrative fit** | ✅ 8/10. "We already ship to smallholder farmers; we discovered the real killer is not disease, it's climate shocks" is a *strong* origin story with a warm user base = pilot credibility (+2 bonus). |

**Decision: NEW REPO. Harvest, do not fork-and-rename.** We lift ~35–40% of the code as libraries and infrastructure, and we build a genuinely new domain core.

### 1.2 What we HARVEST (copy + adapt, credit in README)

| From `shalisi` | LOC | Becomes in new repo | Why it's gold |
|---|---|---|---|
| `services/outbreak-engine/internal/dbscan/` | 142 | `services/risk-engine/internal/cluster/` | Production DBSCAN spatial clustering + tests. Repurpose: cluster **flood incident reports / distress signals** instead of disease scans. Zero domain lock-in. |
| `services/outbreak-engine/internal/geo/distance.go` | 34 | `pkg/geo/` | Haversine. Reused everywhere (ward centroid → gauge distance). |
| `services/daraja-gateway/` | 566 | `services/payout-gateway/` | **M-Pesa STK Push + B2C payouts + Daraja IP-allowlist + signature verification, with tests.** This is the single most valuable asset. Anticipatory cash transfers run on it *today*. Building this from scratch costs 6+ hours. |
| `services/ussd-handler/` | 362 | `services/ussd-handler/` | Swahili-first USSD state machine + session store + tests. Re-map menus: `1. Hatari ya mafuriko` (flood risk), `2. Ripoti tukio` (report event), `3. Malipo yangu` (my payout). **Directly earns the +1 low-bandwidth bonus.** |
| `services/image-processor/` | 194 | `services/image-processor/` | Adaptive JPEG ≤500KB. Reused for citizen flood-damage photo evidence over 2G. |
| `services/ws-relay/` | 166 | `services/alert-relay/` | Gorilla WebSocket hub → live alert fan-out to the county dashboard. |
| `packages/ml/mrv/carbon_calculator.py` | 99 | `packages/ml/adaptation/` | The *pattern* (IPCC-factor math + Kenyan statutory benefit-sharing assertions) transfers to resilience-dividend / avoided-loss accounting. Keep the 40% Kenya Carbon Markets Regs 2024 rule for the carbon-linked resilience module. |
| `packages/api/src/trpc.ts`, `routers/auth.ts` | ~200 | same | Phone-OTP identity, protected procedures, context. |
| `packages/db/src/` Drizzle + PostGIS setup, `drizzle.config.ts` | ~150 | same | Schema conventions: UUID id, `created_at/updated_at`, soft delete, geography type. |
| `packages/ui/` (Button, Card, Badge, RegulatoryDisclaimer) | ~120 | same | `RegulatoryDisclaimer` becomes `ForecastUncertaintyDisclaimer` — see §7. |
| `infrastructure/docker-compose.yml` + `turbo.json` + `pnpm-workspace.yaml` | ~200 | same | One-command bring-up. Judges love `docker compose up` working first try. |
| `packages/api/src/__tests__/helpers.ts` + Vitest config | ~150 | same | Test harness already exists → we ship with real tests (Technical Execution 20%). |

**Harvest total: ~2,400 LOC of tested, working code.**

### 1.3 What we DROP (ruthlessly)

Triage/disease ML, expert consultations & KVB verification, agrovet marketplace, prescriptions, farm tourism, social feed. All of it. Every screen we keep that is not about climate risk costs us Problem Relevance points. **No feature creep. If a judge asks "why is there a marketplace?", we've already lost.**

### 1.4 What we must BUILD NEW (the actual differentiator)

1. Multi-hazard risk fusion engine (flood, drought, heat).
2. Ward-level Climate Vulnerability Index (exposure × hazard × sensitivity ÷ capacity).
3. Anticipatory-action trigger state machine with hash-chained audit ledger.
4. Citizen ground-truth reporting + verification loop.
5. County resilience-planning workspace (FLLoCA/PCRA output generator).
6. SME climate-preparedness self-assessment.

---

## 2. The Winning Thesis (read this twice)

Every other Track 6 team will build **a dashboard with a map and a chart**. Judges will see eight of them. Our four wedges:

### Wedge 1 — Ward-level, not county-level
Kenya's climate governance runs through **Ward Climate Change Planning Committees (WCCPCs)** under the County Climate Change Fund Act / FLLoCA. Counties are legally required to produce **Participatory Climate Risk Assessments (PCRAs) across every ward**. Bungoma did all 45 wards; Kisumu has 35. Everyone else will show county polygons. We show **wards**, because that is the unit where money is actually appropriated. Instant credibility with any county officer in the room.

### Wedge 2 — Forecast → cash, not forecast → PDF
Kenya Red Cross already has an IFRC **Early Action Protocol for Riverine Floods triggered on GloFAS thresholds**. That is real, documented, and underfunded. We implement the *digital rails* for it: threshold breach → trigger → verified beneficiary list → M-Pesa B2C payout → receipt. **Anticipatory action, not disaster response.** This is the single hardest thing to copy in 48h and we already own the payments code.

### Wedge 3 — Trust layer: hash-chained decision ledger + on-chain anchor
Anticipatory cash fails politically because nobody can prove *why* money went to ward X and not ward Y. Every risk score, forecast snapshot, and trigger decision is written to an append-only ledger, each row hashing the previous (Merkle-style), with the daily root anchored to a public chain (Polygon Amoy testnet / or a local EVM node). Anyone can verify a payout against the exact forecast data that caused it. → **Blockchain for Sustainability bonus, done non-gimmicky.**

### Wedge 4 — Works at 2G, works at zero G
Offline-first mobile (SQLite queue + sync), USSD menus, SMS alerts in Dholuo/Swahili/English, ≤500KB images, and a **cached last-known-risk card** that renders with no network. → **+1 low-bandwidth bonus, and it's true, not aspirational.**

### The one-sentence pitch
> "Kenya spends billions responding to floods it was told about a week in advance. We built the rails that turn a GloFAS forecast into money in a Kano Plains farmer's phone before the water arrives — and make every shilling auditable."

---

## 3. Data Sources (all free, no procurement, verified)

| Source | What we get | Access | Use |
|---|---|---|---|
| **Open-Meteo Flood API** (`/v1/flood`) | GloFAS v4 river discharge, 5km, 1984→ + 30-day & 7-month forecast, ensemble median/max | HTTPS, **no API key** | Core flood hazard signal. Compute return-period percentile per ward from the 1984+ reanalysis, trigger on ensemble exceedance. |
| **Open-Meteo Forecast API** | 16-day rainfall, temp, ET0, soil moisture (0–7cm…), 30+ models | no key | Flash-flood + heat + irrigation signals. |
| **Open-Meteo Historical (ERA5)** | 1940→ hourly reanalysis | no key | Baselines, anomaly z-scores, SPI computation. |
| **Open-Meteo Climate API (CMIP6)** | Downscaled projections to 2050 | no key | "Your ward in 2050" projection view. |
| **NASA POWER** | Daily agroclimate (rain, radiation, RH) | REST, no key | Cross-validation of ERA5. |
| **CHIRPS** (UCSB) | 0.05° daily rainfall 1981→, Africa-tuned | Google Earth Engine / direct COG | SPI-3 / SPI-6 drought index. |
| **MODIS/VIIRS NDVI → VCI** | Vegetation Condition Index | GEE / NDMA bulletins | Drought severity, same metric NDMA officially uses (Extreme/Severe/Moderate/Normal categories). |
| **NDMA National Drought Early Warning Bulletins** | Monthly county+sub-county VCI tables, official thresholds | PDF at `knowledgeweb.ndma.go.ke` | **Validation set + credibility slide.** Show our computed VCI matches NDMA's published category. |
| **HDX `cod-ab-ken`** | Kenya admin level 0–2 boundaries, GeoJSON/SHP, P-coded | direct download | Base geometry. |
| **KNBS / IEBC ward boundaries + 2019 Census** | Admin-3 wards, population, poverty rate, housing type | HDX / opendata | Vulnerability denominator. |
| **WorldPop / GHSL** | 100m population raster, building footprints | direct | Exposure count inside flood extent. |
| **OpenStreetMap (Overpass)** | Roads, schools, clinics, markets | API | Critical-asset exposure layer. |
| **Copernicus Sentinel-1** | SAR flood extent (works through clouds) | GEE / CDSE | Historical flood footprints for model labels + post-event verification. |
| **Africa's Talking sandbox** | SMS + USSD | free sandbox | Alert delivery. |
| **Safaricom Daraja sandbox** | STK Push + B2C | free sandbox | Payouts. |

**Golden validation set:** Kenya's documented flood events — Nov 2023 El Niño floods (Nzoia/Budalangi + Kano Plains), Apr–May 2024, Apr–May 2018, 2020 Lake Victoria backflow. Backtest: did our trigger fire, and how many days of lead time? **"Our engine would have fired 5 days early on the November 2023 Nzoia flood"** is the strongest single slide we can produce. Do this backtest EARLY (hour 12) — it is the demo's spine.

---

## 4. Architecture

```
apps/
  mobile/        Expo SDK 54, Expo Router, offline-first SQLite, EN/SW/Dholuo
  web/           Next.js 15 App Router — county command centre + public risk portal
packages/
  api/           tRPC v11 routers: risk, hazard, ward, alert, report, trigger, payout, sme, ledger
  db/            Drizzle + PostGIS (geography), migrations, seed
  ui/            shared NativeWind components
  ml/            Python: hazard indices (SPI, VCI, return periods), vulnerability index, forecast fusion
  ledger/        hash-chain + EVM anchor client
  config/        tsconfig / eslint
services/        (Go)
  ingest/        scheduled pullers for Open-Meteo / CHIRPS / NDMA → Postgres (idempotent, cached)
  risk-engine/   DBSCAN clustering of citizen reports + hazard×vulnerability scoring
  trigger-engine/ threshold state machine → alert + payout orchestration, writes ledger
  payout-gateway/ M-Pesa STK/B2C (harvested)
  ussd-handler/  Africa's Talking USSD (harvested)
  alert-relay/   WebSocket + SMS fan-out (harvested)
  image-processor/ ≤500KB damage-photo pipeline (harvested)
contracts/       Solidity: ResilienceLedger.sol (anchorRoot, verify)
infrastructure/  docker-compose, seed scripts, Terraform sketch
```

**Emerging-tech coverage (we hit ALL FOUR categories — this is how we max Technology Integration 15% + the +2 bonus):**
- **AI & Data Intelligence** — flood/drought risk model, VCI forecasting, report-cluster anomaly detection, Swahili/Dholuo LLM advisory summariser.
- **Blockchain for Sustainability** — hash-chained trigger ledger anchored on-chain; verifiable payout provenance.
- **Cloud & Edge Computing** — cloud ingest + analytics; edge = offline-first mobile with on-device cached risk model and store-and-forward sync.
- **Cybersecurity for Climate Infrastructure** — Daraja IP allowlist + signature verification, rate limiting, RBAC, audit log, tamper-evident ledger, PII minimisation (sub-ward GPS generalisation), signed alert payloads (spoofed flood warnings are a real attack).

---

## 5. Data Model (Drizzle + PostGIS)

Conventions inherited from `shalisi`: UUID `id`, `created_at`, `updated_at`, soft delete via `deleted_at`, FKs enforced, geospatial = PostGIS `geography`.

```
counties(id, code, name, geom geography(MultiPolygon))
sub_counties(id, county_id, name, geom)
wards(id, sub_county_id, code, name, geom, centroid geography(Point),
      population, households, poverty_rate, under5_pct, elderly_pct,
      pct_earth_floor, health_facilities, schools, road_km)     -- vulnerability inputs

hazard_sources(id, key, name, provider, cadence, last_ingested_at)
hazard_observations(id, source_id, ward_id, variable, value, unit,
                    valid_at, ingested_at, lead_time_hours, ensemble_member)
   -- variable ∈ river_discharge | precipitation | soil_moisture_0_7cm | ndvi | vci | spi3 | t2m_max
   -- UNIQUE(source_id, ward_id, variable, valid_at, lead_time_hours, ensemble_member)  ← idempotent ingest

hazard_baselines(id, ward_id, variable, period_start, period_end,
                 mean, stddev, p50, p80, p90, p95, p98, return_period_2y, _5y, _10y, _20y)

risk_scores(id, ward_id, hazard_type, valid_at, horizon_days,
            hazard_score, exposure_score, sensitivity_score, capacity_score,
            composite_score, band, model_version, inputs_hash)
   -- band ∈ low | moderate | high | severe | extreme

citizen_reports(id, reporter_id, ward_id, hazard_type, severity,
                description, photo_url, geom_generalised geography(Point),
                submitted_via, status, verified_by, created_at)
   -- submitted_via ∈ app | ussd | sms | web ; precise GPS NEVER exposed publicly
report_clusters(id, ward_id, hazard_type, center geography(Point), radius_km,
                report_count, confidence, dbscan_eps, created_at)

alerts(id, ward_id, hazard_type, severity, headline_en, headline_sw, headline_luo,
       body_en, body_sw, body_luo, advice_actions jsonb, issued_at, expires_at,
       risk_score_id, signature)                    -- signed to prevent spoofing
alert_deliveries(id, alert_id, user_id, channel, status, delivered_at)

triggers(id, ward_id, hazard_type, name, rule jsonb, lead_time_days,
         payout_per_household_kes, budget_kes, status, created_by)
   -- rule example: {"variable":"river_discharge","op":">=","threshold_return_period":5,
   --               "ensemble_agreement":0.6,"consecutive_days":2}
trigger_activations(id, trigger_id, fired_at, evidence jsonb, evidence_hash,
                    beneficiary_count, total_kes, status, ledger_entry_id)

payouts(id, activation_id, user_id, phone_hash, amount_kes, mpesa_conversation_id,
        status, attempted_at, completed_at, failure_reason)   -- idempotency_key UNIQUE

ledger_entries(id, seq, entry_type, payload jsonb, payload_hash, prev_hash,
               entry_hash, created_at)
ledger_anchors(id, merkle_root, from_seq, to_seq, chain, tx_hash, anchored_at)

audit_log(id, actor_id, action, entity, entity_id, before jsonb, after jsonb, ip, created_at)

users(id, phone_e164, phone_hash, role, ward_id, language, consent_flags, created_at)
   -- role ∈ resident | ward_committee | county_officer | partner_ngo | sme | admin
sme_assessments(id, org_id, sector, answers jsonb, preparedness_score,
                exposure_summary jsonb, recommendations jsonb, created_at)
```

### Risk score formula (put this on a slide)

```
hazard      = normalised forecast exceedance vs ward baseline
              (return-period percentile × ensemble agreement × lead-time decay)
exposure    = population + critical assets inside modelled hazard footprint
sensitivity = f(poverty_rate, under5+elderly, earth-floor housing, crop dependence)
capacity    = f(health facility density, road access, mobile money penetration,
                past alert reach, existing dyke/drainage assets)

composite = (hazard^0.4 · exposure^0.25 · sensitivity^0.2) / capacity^0.15
```
Geometric weighting (not a naive sum) so a zero in any pillar cannot be masked — mirrors IPCC AR5 risk framing (hazard × exposure × vulnerability). **Every score returns its component breakdown — explainability is a judging weapon.**

---

## 6. Feature Set per Surface (MVP-locked)

### 6.1 Mobile (farmer/resident) — 6 screens, no more
1. **Home / Risk Card** — "Ward: Kobura. Flood risk: SEVERE. Peak expected Thu 12 Mar. Lead time 4 days." Traffic-light, huge type, works offline from cache.
2. **7-day hazard timeline** — discharge/rain sparkline vs the 5-year flood line.
3. **Report an event** — hazard type, severity, optional photo (compressed), queued offline, syncs later.
4. **My alerts** — history, in chosen language, with the 3 recommended actions ("move livestock to Ahero ridge", "raise stored grain", "charge phone").
5. **Anticipatory payout** — "KES 3,000 sent to 07XX… because Nyando discharge crossed the 5-yr line on 09 Mar. Verify receipt →" (links to ledger proof).
6. **Preparedness checklist** — offline, gamified, ward-specific.

### 6.2 Web command centre (county / NDMA / Red Cross)
1. **Live ward risk map** (MapLibre + PostGIS vector tiles) — choropleth, hazard toggle, horizon slider 0/3/7/14 days.
2. **Ward drill-down** — score decomposition, historical events, citizen reports cluster overlay, population at risk.
3. **Trigger console** — define/inspect thresholds, see armed vs fired, dry-run simulation, approve payout batch (2-person rule).
4. **Ledger explorer** — every decision, its hash, its on-chain anchor, "verify" button.
5. **PCRA / FLLoCA report generator** — one click → ward-by-ward climate risk assessment PDF matching the FLLoCA PCRA structure (hazards, exposure, priorities, proposed investments). **This is the feature that makes a county officer ask for our number.**
6. **SME climate preparedness** — questionnaire → score + exposure map + adaptation recommendations.
7. **Backtest view** — replay any past date, show what the platform would have said.

### 6.3 USSD/SMS (`*789*6#`)
```
Tahadhari
1. Hatari ya leo (today's risk)
2. Utabiri wa siku 7 (7-day)
3. Ripoti tukio (report event)
4. Malipo yangu (my payout)
5. Badili lugha (language)
```

---

## 7. Guardrails (borrowed discipline from Kilimo Halisi — judges reward this)

Kilimo Halisi enforced Kenyan law in code (KVB, VMD, PCPB, NEMA). We do the equivalent for climate:

1. **Never say "will flood."** Language is always probabilistic: *"high likelihood," "forecast indicates," "X% of ensemble members exceed."* Every risk screen carries: **"Forecast-based estimate, not a certainty. Follow official directives from KMD, NDMA and your county government."**
2. **Attribution to official sources.** KMD is Kenya's mandated authority for weather warnings. We *augment*, never impersonate. Every alert names its data source and model version.
3. **No spoofable alerts.** All outbound alerts are cryptographically signed; the app verifies. A false flood warning can kill people.
4. **Privacy.** Precise GPS only for the reporter's own records and payout eligibility; anything public/shared is generalised to ward centroid. Phone numbers stored hashed + encrypted-at-rest.
5. **Payout integrity.** Idempotency keys on every M-Pesa call, 2-person approval on batch release, full audit log, Daraja IP allowlist + callback signature verification (already implemented in harvested code).
6. **Fairness.** Trigger rules are public and version-controlled. No hidden discretion. Ledger makes exclusion auditable.

---

## 8. The 48-Hour Plan (hour-by-hour, agent-executable)

> **Rule: at the end of every 6-hour block, `main` must be demoable.** If a feature isn't demoable by its deadline, it is cut. We never enter hour 40 with a broken build.

### PHASE 0 — Pre-hackathon (do this BEFORE the clock starts; it's all legal prep, not code)
- [ ] Register Africa's Talking sandbox + Daraja sandbox creds; put in `.env.example`.
- [ ] Download HDX `cod-ab-ken` GeoJSON + Kisumu/Siaya/Busia/Homa Bay/Migori ward boundaries + 2019 census ward table → `infrastructure/data/`.
- [ ] Pull 40 years of Open-Meteo flood + ERA5 for ~180 Lake Basin ward centroids into a local Parquet/CSV cache. **Do this now — it takes hours of API calls and we must never be network-blocked during the demo.**
- [ ] Collect NDMA bulletins (last 12 months) + the 2023/2024/2018 flood event dates for the backtest.
- [ ] Send 3 outreach messages: Kisumu County Climate Change Unit, Kenya Red Cross Nyanza, a Kano Plains farmer cooperative / WCCPC chair. **Screenshot every reply.** Even "we'd be interested to see it" is worth +2 bonus points.
- [ ] Scaffold the empty repo: turborepo, pnpm workspace, docker-compose, CI (lint+test), README skeleton.

### HOURS 0–6 — Foundation (all four humans + agent in parallel)
- Repo live, `docker compose up` brings Postgres+PostGIS+Redis.
- Harvest & rename: `payout-gateway`, `ussd-handler`, `image-processor`, `alert-relay`, `pkg/geo`, `risk-engine/cluster`. **Their tests must pass in the new repo before we move on.**
- Drizzle schema §5 written + migrated + ward/county geometry seeded.
- `ingest` service: Open-Meteo flood + forecast + ERA5 pullers, idempotent upsert, from local cache first.
- **Checkpoint 1: `SELECT` real GloFAS discharge for Kobura ward from our own DB.**

### HOURS 6–12 — The Brain
- `packages/ml`: baselines & return periods from 40y reanalysis; SPI-3; VCI; composite risk formula with component breakdown.
- Risk scores materialised for all wards × 3 horizons.
- tRPC routers: `ward`, `hazard`, `risk` with Zod validation + unit tests.
- **Backtest script**: replay Nov 2023 + Apr 2024 + May 2018 → report lead time per event.
- **Checkpoint 2: the backtest number exists.** This number goes on the pitch deck's biggest slide. If lead time is bad, tune thresholds now, not at hour 44.

### HOURS 12–18 — Command Centre v1
- Next.js map with ward choropleth, hazard toggle, horizon slider, drill-down panel with score decomposition.
- Seed 300 synthetic-but-plausible citizen reports; DBSCAN clustering overlay live.
- **Checkpoint 3: a stranger can look at the screen and understand which wards are in danger.**

### HOURS 18–24 — Mobile + Voice of the Farmer
- Expo app: 6 screens, offline SQLite cache, EN/SW/Luo strings, queued report submission.
- USSD menus rewired + tested against Africa's Talking simulator.
- SMS alert dispatch through `alert-relay`.
- **Checkpoint 4: put the phone in airplane mode, open app, risk card still renders. Demo this on stage.**

### HOURS 24–32 — Trigger Engine + Payouts + Ledger (the crown jewels)
- `trigger-engine`: rule evaluation state machine (armed → watch → fired → settled), dry-run mode.
- Hash-chained `ledger_entries` (prev_hash → entry_hash), Merkle root per batch.
- `contracts/ResilienceLedger.sol` deployed to Polygon Amoy testnet; `anchorRoot(root, fromSeq, toSeq)`; anchor tx hash stored.
- Payout batch: 2-person approval → M-Pesa B2C sandbox → receipts → ledger entries.
- **Checkpoint 5: end-to-end — bump a discharge value in the DB → trigger fires → SMS arrives → sandbox payout completes → ledger entry hash verifiable against on-chain root.** THIS IS THE DEMO. Nothing else matters as much.

### HOURS 32–38 — Depth & Differentiators
- PCRA/FLLoCA report generator (server-side PDF, ward-by-ward).
- SME preparedness assessment.
- CMIP6 "your ward in 2050" view.
- Security pass: rate limiting, RBAC, alert signing, audit log, secrets hygiene, dependency audit, PII generalisation check. Write `SECURITY.md`.
- Test pass: target ≥40 meaningful tests, CI green, coverage on risk math + trigger rules + payout idempotency.

### HOURS 38–44 — Polish & Pitch
- Seed a beautiful, deterministic demo dataset (`pnpm demo:seed`) — never depend on live APIs on stage.
- README with architecture diagram, one-command setup, screenshots, data-source table.
- Deploy: web → Vercel, services → Fly/Railway, DB → Neon. **A live public URL beats localhost.**
- Deck (12 slides, §11) + 4-minute demo video as insurance against stage wifi.
- Rehearse the demo 3×, timed, with the laptop we'll actually use.

### HOURS 44–48 — Freeze
- **Code freeze at hour 44.** Only bug fixes, no new features.
- Full clean-clone test: `git clone && cp .env.example .env && docker compose up && pnpm demo:seed && pnpm dev` on a second machine.
- Rehearse 3× more. Prepare answers to the 12 hard questions (§11.3).
- Sleep 3 hours. Seriously — Presentation is 10% and exhausted presenters lose it.

---

## 9. How We Collaborate (humans ↔ agent)

### 9.1 Roles (4-person team; adapt if different)
| Role | Owns | Never touches |
|---|---|---|
| **A — Data/ML lead** | `packages/ml`, `services/ingest`, backtest, risk formula | web UI |
| **B — Backend/Chain lead** | `packages/api`, `packages/db`, `trigger-engine`, `payout-gateway`, `contracts/` | mobile |
| **C — Web lead** | `apps/web`, maps, PCRA generator, deploy | ml internals |
| **D — Mobile/Comms lead + Pitch owner** | `apps/mobile`, `ussd-handler`, i18n, deck, demo script, outreach | db schema |

**Ownership rule:** one owner per directory. Cross-directory change ⇒ open a PR and tag the owner. This is how we avoid merge hell at hour 30 and how we score the Team Collaboration 5% (judges look at commit history — everyone must have meaningful commits).

### 9.2 Git protocol
- `main` is always green and always demoable. Branch protection: PR + CI required.
- Branches: `feat/<area>-<short>`, `fix/<area>-<short>`.
- Conventional commits, same as Kilimo Halisi: `feat(risk): add ensemble exceedance scoring`.
- Squash merge. Small PRs (<400 LOC). Rebase before merge.
- Tag `v0.1-demo` at code freeze. Demo runs off the tag, not `main`.

### 9.3 Working with the build agent (this is important)
- **The agent gets one directory at a time and a written contract.** Prompt template:
  ```
  Context: read plan.md §<n> and packages/db/src/schema/*.
  Task: implement <exactly one thing>.
  Constraints: TypeScript strict, no `any`, Zod on every tRPC input,
               named exports, kebab-case files, tests in __tests__/.
  Definition of done: <command that must pass>, e.g. `pnpm --filter api test`.
  Do not modify files outside <dir>.
  ```
- **Every agent task must end in a runnable verification command.** No "looks good" merges.
- **The agent writes tests in the same PR as the code.** Non-negotiable.
- Human reviews the diff for: hallucinated APIs, invented data, silently weakened tests, secrets in code.
- Keep a `DECISIONS.md` — one line per architectural decision with the reason. Judges asking "why Go for the trigger engine?" get an instant crisp answer, and the agent stays consistent across sessions.
- Keep a `PROGRESS.md` checklist mirroring §8, updated at every checkpoint. When the agent's context resets, this file is its memory.
- **AGENTS.md in the new repo** = the coding conventions section, rewritten for the climate domain (reuse the structure from `shalisi/AGENTS.md`, replace the regulatory section with §7 guardrails).

### 9.4 Standing rituals
- **Every 6 hours: 10-minute standup.** What's demoable? What's blocked? What do we cut?
- **Cut list, maintained live.** If at hour 30 the SME module isn't started, it's cut. Written down so nobody secretly keeps building it.
- **One person is always "demo warden"** (D). Their job at any moment is to be able to run the demo. If the demo breaks, all work stops until it's green again.

---

## 10. Rubric Attack Plan (score every box deliberately)

| Criterion | Weight | How we max it | Evidence we must have on stage |
|---|---|---|---|
| **Problem Relevance & Impact** | 20% | Hyper-local: Kano Plains / Nyando / Budalangi floods — the judges' own backyard. ~5,000 people affected annually in lower Kano alone; 2023/2024 floods displaced hundreds of thousands nationally. Quantify avoided loss: `households × avg asset loss × lead-time efficacy`. Tie to SDG 13, 11, 6, 1, 8 and Kenya's NAP / MTP IV / FLLoCA. | A slide with real numbers + named wards + a named partner conversation. |
| **Technical Execution** | 20% | Polyglot monorepo, real data end-to-end, 40+ passing tests, CI green, one-command setup, deployed live URL, no mocked "AI". Harvested code is battle-tested. | `pnpm test` run live if asked; live URL; GitHub Actions badge. |
| **Innovation & Creativity** | 15% | Nobody else will do **forecast→verified trigger→M-Pesa anticipatory payout→on-chain audit** in 48h. Plus ward-level (not county) granularity and the PCRA auto-generator. | The end-to-end trigger demo. |
| **Technology Integration** | 15% | We hit **all four** emerging-tech categories, each doing real work (see §4). Not one is decorative. | One slide mapping each category → the file that implements it. |
| **Scalability & Feasibility** | 15% | Data sources are free & global (GloFAS is worldwide → same code works in Uganda, Tanzania, Malawi). Stateless services, horizontal scale, Neon/PostGIS, cost model per county. Business model: county FLLoCA budgets (World Bank-funded, already appropriated), NGO anticipatory-action funds, SME SaaS, parametric insurance data licensing. | A "$/county/year vs cost of one flood response" slide + a 90-day pilot plan. |
| **Presentation & Demo** | 10% | 4-min live demo, rehearsed 6×, offline-safe (local seed + recorded video fallback). Open on the human story, close on the ledger proof. | Rehearsal. Rehearsal. Rehearsal. |
| **Team Collaboration** | 5% | 4 owners, PR-reviewed history, DECISIONS.md, everyone can explain the whole system. | Commit graph + each member answers a question about someone else's area. |
| **+2 Exceptional emerging tech** | bonus | The hash-chained, on-chain-anchored decision ledger + ensemble ML with explainable component scores. | Live "verify this payout" click-through. |
| **+2 Real pilot conversation** | bonus | Documented outreach to Kisumu CCCU / Red Cross Nyanza / a WCCPC. **Do this in Phase 0.** | Screenshot of the reply, name and title on the slide. |
| **+1 Low-bandwidth/offline** | bonus | Airplane-mode demo + USSD live on the Africa's Talking simulator + ≤500KB images. | Do it on stage, physically toggle airplane mode. |

**Target: 100 + 5.** Realistically anything ≥88 wins this field.

---

## 11. The Demo & Deck

### 11.1 Demo script (4 minutes, memorised)
1. **(0:00–0:25) The hook, no slides.** "On 9 November 2023, GloFAS knew the Nzoia was going to burst. Five days later Budalangi went under water and 40,000 people lost everything. The forecast existed. It just never reached anybody who could act on it."
2. **(0:25–1:10) Command centre.** Kisumu map, Kobura/Ahero wards glowing red. Click a ward: "Flood risk SEVERE, 4-day lead time, 12,400 people exposed, driven by discharge at the 8-year return level with 78% ensemble agreement." Show the component breakdown — *we explain our score, we don't hide it.*
3. **(1:10–1:55) Backtest.** "Replay 2023." Trigger fires 5 days before the observed flood. "This isn't a hypothesis. We tested it against every major Lake Basin flood since 2018."
4. **(1:55–2:40) The farmer.** Phone on the projector, **airplane mode ON**. Risk card renders. Then the USSD simulator in Swahili. Then the SMS lands on a real handset.
5. **(2:40–3:25) The money.** Arm the trigger, push the discharge past threshold. Trigger fires → beneficiary list → 2-person approval → M-Pesa B2C sandbox payouts → farmer's phone shows "KES 3,000 received."
6. **(3:25–3:50) The proof.** Ledger explorer: the payout, its hash chain, the Merkle root, the Polygon transaction. "Anyone in Kenya can verify why this money moved. That is how anticipatory finance survives an audit."
7. **(3:50–4:00) Close.** "Free global data, Kenyan rails, ward-level precision. It runs in Kisumu today and in any river basin on Earth tomorrow. We've already spoken to [named partner]."

### 11.2 Deck (12 slides)
1 Title + one-line pitch · 2 The 5-day gap (2023 story) · 3 Who suffers (Kano Plains numbers) · 4 Why existing tools fail (county-level, English, online, no action) · 5 Our solution in one diagram · 6 Live demo · 7 The backtest table (lead time per event) · 8 Architecture + all-four emerging tech map · 9 Trust & security (ledger, signing, privacy) · 10 Scalability + business model + FLLoCA/anticipatory-finance buyers · 11 Pilot plan + partner conversation · 12 Team + ask.

### 11.3 Hard questions — prepare answers
1. "How is this different from KMD's forecasts?" → *We don't forecast; we translate forecasts into ward-level, actionable, cash-linked decisions. KMD is our source and our authority.*
2. "How accurate is your model?" → *We report skill honestly: backtested lead time and hit/false-alarm rate on N events. Here it is.*
3. "What if it fires wrongly and money is wasted?" → *Anticipatory action economics: 1 false alarm costs the transfer; 1 missed flood costs lives and 4–7× in response. Plus dry-run mode, ensemble agreement floor, 2-person approval, and public rules.*
4. "Why blockchain?" → *Only for tamper-evidence of trigger decisions and payout provenance — a real accountability problem in Kenyan climate finance. Everything else is Postgres. We anchor a Merkle root, we don't put PII on-chain.*
5. "Who pays?" → *County FLLoCA/CCCF budgets, NGO anticipatory funds, SME subscriptions, insurer data licensing.*
6. "What about people with no phone?" → *Ward committee cascade + chief's baraza printouts generated by the platform + SMS to community focal points.*
7. "Data licensing?" → *GloFAS/Copernicus, ERA5, CHIRPS, HDX, OSM — all open and attributed.*
8. "Where does this run offline?" → *Show it.*
9. "Isn't a false flood alert dangerous?" → *Signed alerts, source attribution, probabilistic language, KMD deference.*
10. "Scale beyond Kenya?" → *GloFAS is global; swap boundary + census layers.*
11. "What did you build in 48h vs before?" → **Be honest.** *These four services are hardened components from our previous platform, credited in the README; the climate risk engine, trigger engine, ledger, and all three UIs are new.* Honesty here is a strength — dishonesty caught on stage is fatal.
12. "What's next?" → *90-day pilot in 3 Kano Plains wards with the CCCU, 500 households, measure lead time and uptake.*

---

## 12. Naming, Risks, Cut List

### 12.1 Name candidates
- **Tahadhari** — "warning/caution" (SW). Clear, dignified, memorable. ★ recommended
- **Ng'ich** — Dholuo-flavoured, hyper-local to Nyanza (verify meaning with a native speaker before using).
- **Mbele** — "ahead/forward" (SW) → "we act ahead."
- **HaliSalama** — hali (condition) + salama (safe).
- Tagline: *"Tahadhari — climate risk intelligence that pays out before the water arrives."*

### 12.2 Top risks & mitigations
| Risk | Mitigation |
|---|---|
| Live API dies during demo | **All demo data pre-seeded locally.** Never call an external API on stage. |
| Daraja sandbox flaky | Wrap payouts behind an interface with a `MockDaraja` toggle; rehearse both paths. |
| Ward boundary data messy | Fall back to sub-county (admin-2, HDX-verified) for any county missing wards; state it openly. |
| Backtest shows weak skill | Reframe honestly as "lead time distribution + false alarm ratio" and show the tuning process. Judges reward rigour over inflated claims. |
| Scope creep | Cut list + demo warden + hour-44 freeze. |
| Merge hell | One owner per directory, small PRs, `main` always green. |
| Blockchain rabbit hole | Timebox to 3 hours. Fallback: local hash chain + a signed daily root published as a GitHub gist. Ship the fallback first, upgrade if time allows. |
| Agent hallucinating APIs | Every task ends in a passing command; human reviews diffs. |

### 12.3 Cut order (if behind schedule, cut in exactly this order)
1. CMIP6 2050 projection view
2. SME preparedness module
3. On-chain anchor (keep local hash chain)
4. PCRA PDF generator (fall back to an HTML page)
5. Dholuo localisation (keep EN/SW)
**NEVER CUT:** ward risk map, backtest, offline mobile card, USSD, trigger→payout→ledger chain.

---

## 13. Definition of Done (the agent must satisfy every line)

- [ ] `git clone && cp .env.example .env && docker compose up -d && pnpm i && pnpm db:migrate && pnpm demo:seed && pnpm dev` works on a clean machine.
- [ ] `pnpm turbo test` green; `go test ./...` green in every service; `pytest packages/ml` green.
- [ ] ≥40 meaningful tests, including: risk-score math, return-period computation, trigger rule evaluation, payout idempotency, ledger hash-chain integrity, USSD menu transitions, alert signing.
- [ ] No `any` in TypeScript. Zod on every tRPC input. Named exports. `kebab-case.ts` / `PascalCase.tsx`.
- [ ] Every table has `id`/`created_at`/`updated_at`; geo columns are PostGIS `geography`; soft deletes only.
- [ ] Mobile: airplane mode renders last-known risk; report queues and syncs; EN/SW strings complete.
- [ ] Security: rate limiting on public endpoints, RBAC enforced, audit log written for every payout and trigger, no secrets committed, PII generalised in public responses.
- [ ] README: architecture diagram, data-source table with attributions, screenshots, harvested-code credits, licence.
- [ ] `DECISIONS.md`, `PROGRESS.md`, `AGENTS.md`, `SECURITY.md` present.
- [ ] Live deployed URL + 4-minute recorded demo video committed as fallback.
- [ ] Backtest report committed: `docs/backtest.md` with lead time per historical event.

---

## 14. First Five Commands for the Agent

```bash
# 1. scaffold
mkdir tahadhari && cd tahadhari && git init
pnpm init && pnpm dlx create-turbo@latest --skip-install .

# 2. harvest (adjust path to the shalisi checkout)
bash scripts/harvest-from-shalisi.sh ../shalisi   # copies the §1.2 table, renames modules

# 3. infra up
docker compose -f infrastructure/docker-compose.yml up -d   # postgis + redis

# 4. schema + geometry
pnpm --filter db db:migrate && pnpm --filter db db:seed:boundaries

# 5. first real data
pnpm --filter ingest start -- --source open-meteo-flood --counties kisumu,siaya,busia --days 40y
```

**Then stop and verify Checkpoint 1 before writing any UI.**

---

## 15. THE UNEP PLAY (added: UNEP will be in the room)

> **This changes our optimisation target.** We are no longer only playing to win a hackathon. UNEP's headquarters is in Nairobi (Gigiri) — the only UN HQ in the Global South — and a UNEP officer in that room is not just a judge, they are a *channel*: to technical review, to Digital Public Good listing, to CTCN technical assistance, to county and basin-level introductions. **Optimise the pitch for one outcome: a UNEP person asks for a follow-up meeting.**

### 15.1 What a UNEP person actually cares about (and how we speak it)

| UNEP frame | What they listen for | Our line |
|---|---|---|
| **Early Warnings for All (EW4All)** — UN SG initiative, Africa Action Plan launched Nov 2024. Four pillars: (1) risk knowledge, (2) detection & forecasting, (3) warning dissemination & communication, (4) preparedness & response. | "Which pillar are you? Most tools only do pillar 2." | **"We are pillars 1, 3 and 4 — the three that are chronically underfunded. Pillar 2 already exists: GloFAS, KMD. The forecast is not the gap. The last mile and the *action* are the gap."** This single sentence is the most valuable thing we can say to UNEP. |
| **Adaptation Gap Report** — adaptation finance gap, and the fact that finance rarely reaches the local level. | Local-level delivery, tracked, auditable. | Ward-level targeting + hash-chained payout ledger = *proof that adaptation finance reached the last mile.* That is literally the reporting problem the Adaptation Gap Report complains about. |
| **Triple planetary crisis** (climate, nature, pollution) | Do you only see climate, or the whole system? | Add the **nature layer** (§15.4). Floods are also a pollution and ecosystem event in the Lake Victoria basin. |
| **Nature-based Solutions** — UNEP's signature adaptation position | "Is your answer only concrete and cash?" | Our map flags where **wetland/riparian restoration reduces ward risk most** — grey *and* green adaptation, ranked side by side. |
| **CODES / digital environmental sustainability + UNEA-7 resolution on the environmental sustainability of AI** | Is your own AI green and accountable? | §15.5 — we report our own compute footprint. Almost nobody at a hackathon does this. |
| **Open environmental data as a public good** (WESR, GEMS, Freshwater Ecosystems Explorer) | Open licence, open standards, machine-readable, interoperable. | §15.3 — MIT licence, CAP 1.2 alert feed, GeoJSON/STAC, public read API, DPG candidacy. |
| **SDG & Sendai reporting** | Indicator alignment | §15.6 — we *emit* indicator-ready data, not just pretty maps. |

### 15.2 Vocabulary discipline (a UNEP officer will notice if we get these wrong)

Use correctly and confidently: *anticipatory action*, *forecast-based financing*, *Early Action Protocol (EAP)*, *trigger / threshold / lead time*, *no-regret actions*, *hazard × exposure × vulnerability* (IPCC AR5/AR6 risk framing), *maladaptation*, *residual risk*, *loss and damage*, *last-mile dissemination*, *impact-based forecasting* (this is the WMO/KMD direction of travel — say we are impact-based, not hazard-based), *risk knowledge*, *locally led adaptation* (LLA — and its 8 Principles; FLLoCA is Kenya's LLA flagship).

**Never say:** "our AI predicts floods better than existing models." Say: **"we do not compete with GloFAS or KMD — we consume them, localise them to the ward, translate them into a decision, and prove the decision."** Humility about model skill reads as competence to this audience; overclaiming is instantly fatal.

### 15.3 Interoperability & Digital Public Good work items (cheap, enormous credibility)

All of these are small and belong in hours 32–38:

1. **CAP 1.2 (Common Alerting Protocol) export endpoint** — `GET /api/alerts/cap.xml`. CAP is the ITU/WMO/OASIS standard every national warning system and EW4All implementation uses. Emitting valid CAP means our alerts can be ingested by KMD, NDMA, Google Public Alerts, and any cell-broadcast system **without anyone rewriting our code**. ~2–3 hours. Highest credibility-per-hour item in this entire plan.
2. **Open licence (MIT or Apache-2.0) + `DPG.md`** mapping the project to the 9 **Digital Public Goods Alliance** indicators (open licence, clear ownership, platform independence, documentation, non-PII data extraction, privacy & law compliance, standards & best practices, do-no-harm). State that we intend to submit for DPG registry review.
3. **Public read-only API + open data exports** — ward risk scores as GeoJSON and CSV, versioned, with `model_version` and `inputs_hash`. "Our risk data is itself a public good."
4. **Standards list in the README:** CAP 1.2 (alerts), GeoJSON / OGC API Features (geometry), STAC (raster provenance), P-codes / HDX COD-AB (admin identifiers), ISO 8601 UTC, Sendai & SDG indicator codes. Standards compliance is how a UN body decides whether you are serious.
5. **`DO-NO-HARM.md`** — one page: how we prevent false alarms, spoofed warnings, exclusion errors, data-driven discrimination, and dependency on a private platform for a public safety function (including our exit/handover plan to the county).

### 15.4 The nature layer (turns a DRR pitch into a UNEP-shaped pitch)

Add a **Nature-based Adaptation** tab. Rule-based, no new ML needed:

- **Watershed context:** Nyando, Nzoia and Yala catchments — upstream degradation and riparian encroachment amplify downstream flood peaks. Nyando wetland and Yala swamp are natural retention buffers being lost.
- **Flood = pollution event:** floodwater flushes sediment, nutrients, agrochemicals, pit-latrine contents and plastics into Lake Victoria → algal blooms, water-hyacinth expansion, fish habitat damage, cholera risk. So a flood warning is also a **water-quality warning** (nod to Track 1 without leaving Track 6).
- **What we ship:** per-ward `nbs_opportunity_score` from open layers — riparian buffer deficit (OSM/HydroSHEDS + land cover), wetland loss proxy (NDVI/water-occurrence trend), slope/upstream contribution — ranked as *"restore X ha of riparian buffer here → estimated Y% peak reduction + Z tonnes sediment retained."* Label the estimates clearly as **indicative, literature-derived coefficients**, not modelled hydrology. Honest labelling beats fake precision.
- **One extra sentence in the pitch:** *"Cash protects the household this week. Wetland restoration protects the ward for thirty years. We rank both in the same interface, and the county can fund both from the same FLLoCA envelope."*

### 15.5 Green-by-design (the UNEA-7 AI-sustainability angle nobody else will touch)

- Log and display our own footprint: model inference runs, kWh estimate, gCO₂e using a documented grid-intensity factor (Kenya's grid is ~80–90% renewable — geothermal/hydro/wind — which is genuinely a good story). Small footer widget + `docs/compute-footprint.md`.
- Architectural argument: **on-device/edge inference + cached SMS/USSD delivery is the low-carbon, low-cost, low-bandwidth choice.** We chose small models and edge execution *deliberately* — a lightweight gradient-boosted risk model, not an LLM per request. LLM use is confined to one optional translation/summarisation step, and is cached.
- One slide line: *"Our AI must not cost the planet more than it saves. Here is our number."* This directly answers UNEP's newest AI mandate and will be remembered.

### 15.6 Indicator export (make us useful to a reporting institution)

Add `/reports/indicators` producing a machine-readable block mapped to:
- **SDG 13.1.1** — deaths/missing/directly affected per 100,000 (we hold ward exposure + verified event reports).
- **SDG 13.1.3** — proportion of local governments with local DRR strategies → **our PCRA/FLLoCA generator literally produces the evidence artefact for this indicator.** Say this out loud.
- **SDG 11.5.1 / 1.5.1** — disaster-affected persons, economic loss.
- **SDG 6.6.1** — water-related ecosystem extent change (nature layer).
- **Sendai Target G** — share of population with access to multi-hazard early warning; **Target A/B/D**. Our alert-delivery table (per channel, per ward, delivered/failed) is *exactly* Target G evidence, and almost nobody in Kenya can produce it today.

> **Killer framing:** *"Counties cannot report on Sendai Target G because nobody counts whether a warning was actually received. We count it, per person, per channel. That is a reporting capability, not just an app."*

### 15.7 The ask (do NOT ask for money)

Prepare exactly three asks, in this order:
1. **"Twenty minutes of technical review"** with whoever works on early warning / adaptation / digital transformation. Low cost to grant, therefore high probability of yes.
2. **"Would you point us to the right person"** for: Kisumu County Climate Change Unit, Lake Victoria Basin Commission, NDMA, Kenya Red Cross Nyanza, or a CTCN technical-assistance pathway. Introductions are free for them and transformative for us.
3. **"How do we make this qualify as a Digital Public Good / align with the EW4All Africa Action Plan?"** — this flatters the mandate and gets concrete guidance.

Never ask for funding at a hackathon. Ask for *validation and a name*.

### 15.8 Logistics — do not fumble the encounter

- **One-pager PDF** (single side): problem, screenshot, EW4All pillar map, SDG/Sendai indicators, licence, GitHub QR, live URL QR, team names + emails. Print 10 copies **and** have it ready to AirDrop/WhatsApp.
- **Live public URL + working QR code.** A UNEP officer who can open it on their own phone at the venue is worth more than any slide.
- **60-second version of the pitch, memorised**, for a corridor conversation. Structure: the 5-day gap → what we built → the pillar-1/3/4 line → the ask.
- **Follow-up email drafted before the event**, sent within 24 hours: 5 sentences, one-pager attached, repo link, the specific ask, reference to something they actually said.
- **One named human owner:** person **D** owns the UNEP interaction. Everyone else stays out of the way — four people crowding a UN officer is a bad look.
- **Pre-read (30 min each, before the hackathon):** the EW4All Africa Action Plan summary, the latest Adaptation Gap Report executive summary, and the CODES Action Plan's three systemic shifts. Quoting one of these accurately, once, is decisive.
- **Respect the room:** they are also there for other tracks and other teams. Be brief, be specific, be gone. Memorable ≠ persistent.

### 15.9 Deck & schedule amendments

- **Deck becomes 13 slides.** New **Slide 11a — "Alignment & Interoperability"**: EW4All four-pillar map (ours highlighted), CAP 1.2 / open standards, SDG + Sendai indicator codes, licence + DPG intent, compute footprint. One dense, credible slide.
- **Slide 9 (Trust & security)** gains one line on `DO-NO-HARM.md` and the county handover plan.
- **Hours 32–38 additions (in priority order):** CAP 1.2 export → indicator export page → `DPG.md` + `DO-NO-HARM.md` + licence → nature-based adaptation tab → compute-footprint footer.
- **Cut list update (§12.3):** insert the nature layer at position 2 and the compute-footprint widget at position 3. **Never cut:** CAP export, the licence/DPG docs, and the EW4All pillar slide — they are nearly free and they are what a UN institution grades you on.

### 15.10 Why this actually wins

Every other team will pitch a product. With UNEP present, the winning move is to pitch **public infrastructure**: open licence, open standards, indicator-ready outputs, nature and cash side by side, honest model claims, and an auditable trail proving adaptation finance reached a named ward. That is the vocabulary of the institution sitting in the front row — and it costs us maybe six hours of the 48.

---

*Built on the shoulders of Kilimo Halisi. Different problem, same conviction: technology only counts when it reaches the farmer.*
