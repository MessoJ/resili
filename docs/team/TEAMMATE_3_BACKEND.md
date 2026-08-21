# Teammate 3: Go Backend Guide

## Your Mission
Extend the Go API Gateway with REST endpoints for local business advisories, ensuring fast, rate-limited, and auditable responses.

## Files You Own
- `services/gateway/internal/handler/sme.go`
- `services/gateway/internal/handler/sme_test.go`
- `services/gateway/internal/handler/trigger.go`

## Status: complete ✅

All owned handlers are production-grade, wired into the gateway router, and covered by tests:

1. **SME advisory** (`sme.go`) — ward-tailored preparedness checklists with three
   risk bands: `severe` (Nyando, Budalangi), `high` (Kano Plains — secure outdoor
   market stalls, clear silt from rice irrigation channels), and `moderate`
   (default). Every response carries an explicit KMD/NDMA/county attribution and
   never impersonates an official warning (climate-safety guardrail).
2. **SME tests** (`sme_test.go`) — cover the Nyando severe path, the Kano `high`
   path, and the missing-`wardId` 400.
3. **Trigger decisions** (`trigger.go`) — anticipatory-action endpoint enforcing
   public trigger rules (risk ≥ 75, lead ≥ 3 days), two-person approval (unique
   approvers only), idempotency (replayed key returns the original decision), and
   a SHA-256 decision hash for the audit trail. Covered by `trigger_test.go`.

## How to Test Your Work
```bash
cd services/gateway
go test ./...
go run ./cmd/server
```
Test with curl in another terminal:
```bash
curl "http://localhost:8080/api/v1/sme/advisory?wardId=KE-039-KANO"
```
You should see a clean JSON response with the high-risk checklist and Kisumu disaster desk contact!
