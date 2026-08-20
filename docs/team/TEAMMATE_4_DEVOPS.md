# Teammate 4: Data & DevOps Guide

## Your Mission
Ensure all microservices (PostGIS, Python ML, Go Gateway, Redis) boot up cleanly with a single command and seed essential community evacuation datasets.

## Files You Own
- `infrastructure/data/seed-evacuation-centers.sql`
- `infrastructure/scripts/verify_services.sh`
- `infrastructure/docker-compose.yml`

## Your Bite-Sized TODOs
1. **TODO 1:** Open `infrastructure/data/seed-evacuation-centers.sql` and add 2 more shelter rows:
   - For `KE-039-NZOIA`: "Ruambwa Multipurpose Shelter", capacity 900 persons, elevation 1145m.
   - For `KE-039-RACHUONYO`: "Kendu Bay Relief Grounds", capacity 750 persons, elevation 1152m.
2. **TODO 2:** Open `infrastructure/scripts/verify_services.sh` and add a curl check for the USSD callback:
   ```bash
   curl -s -X POST http://localhost:8080/api/v1/ussd -d "text=1" | grep -o "Hatari"
   ```

## How to Test Your Work
```bash
cd infrastructure
docker compose up -d
bash scripts/verify_services.sh
```
All green checkmarks mean the platform is 100% demo-ready for the judges!
