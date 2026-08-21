# Teammate 4: Data & DevOps Guide

## Your Mission
Ensure all microservices (PostGIS, Python ML, Go Gateway, Redis) boot up cleanly with a single command and seed essential community evacuation datasets.

## Files You Own
- `infrastructure/data/seed-evacuation-centers.sql`
- `infrastructure/scripts/verify_services.sh`
- `infrastructure/docker-compose.yml`

## Status: complete ✅

All owned files are production-grade and wired together:

1. **Evacuation dataset** (`infrastructure/data/seed-evacuation-centers.sql`) — six
   shelters across all five demo wards (including the Nzoia "Ruambwa Multipurpose
   Shelter" and Rachuonyo "Kendu Bay Relief Grounds"). The table now follows the
   project data conventions: PostGIS `geography(Point, 4326)` location with a GIST
   index, an enforced foreign key to `wards(ward_id)`, soft deletion (`deleted_at`),
   `created_at`/`updated_at`, capacity check, and an idempotent `ON CONFLICT`.
2. **Verification** (`infrastructure/scripts/verify_services.sh`) — a robust,
   exit-code-aware smoke test covering PostGIS (connectivity + seed row counts),
   the ML API, the gateway health/risk/ledger endpoints, and the Swahili USSD
   callback. It fails loudly (non-zero exit) so it is CI/pre-demo safe. Override
   targets with `ML_URL` / `GATEWAY_URL` to point at deployed services.
3. **Orchestration** (`infrastructure/docker-compose.yml`) — one-command bring-up
   with health-gated startup ordering (gateway waits for the ML service to be
   healthy) and `restart: unless-stopped` policies.

> **Init-order fix:** the Postgres entrypoint only runs scripts placed *directly*
> in `/docker-entrypoint-initdb.d` (it does not recurse into sub-directories).
> The migrations and seeds are therefore mounted individually with numeric
> prefixes (`01_…`, `02_…`, `03_seed-wards`, `04_seed-evacuation-centers`) so
> migrations always run before the data seeds.

## How to Test Your Work
```bash
cd infrastructure
docker compose up -d          # starts PostGIS, Redis, ML, and the gateway
bash scripts/verify_services.sh
```
`SUMMARY: N passed, 0 failed` (exit 0) means the platform is demo-ready for the
judges.
