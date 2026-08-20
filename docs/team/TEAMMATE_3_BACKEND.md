# Teammate 3: Go Backend Guide

## Your Mission
Extend the Go API Gateway with REST endpoints for local business advisories, ensuring fast, rate-limited, and auditable responses.

## Files You Own
- `services/gateway/internal/handler/sme.go`
- `services/gateway/internal/handler/sme_test.go`

## Your Bite-Sized TODOs
Open `services/gateway/internal/handler/sme.go`:
1. **TODO 1:** In `GetSmeAdvisory()`, add a check for `wardID == "KE-039-KANO"` to return `riskBand: "high"` and advisories:
   - "Secure outdoor market stalls against high winds and runoff"
   - "Clear silt and debris from local rice irrigation access channels"
2. **TODO 2:** In `services/gateway/internal/handler/sme_test.go`, add a test verifying that `KE-039-KANO` returns `"high"`.

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
