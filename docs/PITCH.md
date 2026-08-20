# Rezili — Pitch Guide

## The One-Liner

> Rezili turns national weather forecasts into ward-level, explainable
> flood risk decisions — and triggers anticipatory cash transfers before
> the water arrives.

---

## The Problem (2 minutes)

Start with a person, not a statistic:

"In April 2024, the Nyando River burst its banks and displaced 12,000
families in Kano Plains. NDMA had issued a seasonal outlook weeks
earlier. KMD had a 5-day forecast. But the ward chief in Kochogo didn't
have a system that could translate 'heavy rainfall expected in western
Kenya' into 'your specific ward has an 82% chance of flood impact in
4 days — here's who to alert and here's the pre-approved payout.'

That gap — between a national forecast and a local decision — costs
lives, livelihoods, and dignity. People who could have moved their
livestock, stored their grain, or received emergency cash before the
water arrived instead waited for post-disaster relief that came days or
weeks late."

Key statistics to cite:
- Kenya floods in 2024 displaced 290,000+ people (NDMA situation reports)
- Nyando catchment floods 2-3 times per year during long rains
- Anticipatory action costs 1/3 of post-disaster response (WFP evidence)
- 70% of Nyando ward residents are below the poverty line (KNBS 2019)

---

## The Solution (3 minutes)

"Rezili is a climate risk intelligence platform for the Lake Victoria
Basin. It does three things that nobody else does together:

1. **Downscales** public forecasts (GloFAS, CHIRPS, Open-Meteo) to the
   ward level using terrain, flood history, and an XGBoost model trained
   on local catchment data.

2. **Explains** every risk score. The score is not a black box — you can
   see that 3-day precipitation contributed 28 points, discharge ratio
   contributed 22 points, and ward vulnerability contributed 15 points.
   Judges can verify this.

3. **Acts** on the score. When risk crosses 75 (severe), lead time
   exceeds 3 days, and two people approve, Rezili triggers an
   anticipatory cash transfer through M-Pesa. Every decision is
   recorded in a tamper-evident hash chain."

Demo flow:
- Show the Operations Console with 5 wards on the map
- Click Nyando → risk score 82 (severe), red ward, explanation panel
- Show the trigger approval workflow (two officers approve)
- Show the payout receipt with audit hash
- Show the USSD menu in Swahili
- Show the audit ledger with chain verification

---

## Tech Stack (1 minute)

"We built this with four languages because each one is the right tool
for its job:

- **Python** for the ML pipeline — because that's where XGBoost,
  pandas, and the climate data ecosystem live.
- **Go** for the API gateway — because it compiles to a 15MB binary,
  handles 10,000 concurrent connections, and rate-limits public
  endpoints to prevent abuse.
- **TypeScript** for the business logic — because the risk scoring,
  triggers, ledger, and payout rules need strong types and tests.
- **Next.js** for the dashboard — because ward-level risk maps need
  to load fast on Kenyan mobile data."

---

## Innovation (1 minute)

"Three things make Rezili different:

1. **Explainable ML at the ward level.** We don't just say 'high risk.'
   We show exactly what forecast signals drove the score, calibrated
   against Nyando catchment hydrology.

2. **Anticipatory action pipeline.** This is not a monitoring dashboard.
   It's a decision-to-payout pipeline with dual approval, idempotency,
   and an immutable audit chain.

3. **Three access paths.** Operations Console for county officers, USSD for
   communities without smartphones, and an API for integration with
   NDMA systems."

---

## Impact (1 minute)

"If Rezili were deployed for the April 2024 Nyando floods:

- Ward chiefs would have had a **4-day early warning** with a specific
  risk score, not just 'heavy rain expected.'
- **12,000 families** could have received anticipatory cash (KES 500
  per household) to prepare — moving livestock, buying supplies, or
  evacuating early.
- Total cost: ~KES 6 million in anticipatory transfers, versus an
  estimated KES 20 million in post-disaster response.

That's the value proposition: spend 1/3 of the money, days earlier,
with full accountability."

---

## UNEP Alignment

Mention these for the UNEP panellists:
- **Sendai Framework Target G**: We track early warning reach as a
  Sendai indicator and export it.
- **SDG 13 (Climate Action)**: Ward-level climate risk intelligence.
- **SDG 11 (Sustainable Cities)**: Community resilience for urban
  flood-prone areas.
- **Digital Public Good**: Open-source, open standards (CAP 1.2,
  GeoJSON, OGC), no vendor lock-in.
- **Compute footprint**: We track and report the CO₂ cost of our own
  ML inference.

---

## Scalability (30 seconds)

"Rezili works for Nyando today. It works for any catchment tomorrow.
The ward profiles, forecast sources, and scoring model are all
configurable. Swap in Nzoia Basin data, and you have Nzoia coverage.
The architecture is containerised — one `docker compose up` brings
everything up."

---

## Closing

"We're not replacing KMD or NDMA. We're building the missing layer
between their forecasts and the ward chief who needs to make a decision
tonight. That's Rezili."
