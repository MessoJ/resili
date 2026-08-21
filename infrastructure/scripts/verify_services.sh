#!/usr/bin/env bash
#
# resili infrastructure health check
#
# Exercises every service the judges' demo depends on and fails loudly (non-zero
# exit) if any check does not pass, so it is safe to use in CI and pre-demo
# smoke tests.
#
#   1. PostGIS database        (docker compose service `postgis`)
#   2. Python ML forecast API  (port 8001)
#   3. Go API gateway          (port 8080)
#   4. Ward risk GeoJSON feed  (gateway -> ML)
#   5. Tamper-evident ledger   (gateway)
#   6. USSD callback           (gateway, Africa's Talking format)
#
# Usage:
#   bash scripts/verify_services.sh
#
# Environment overrides:
#   ML_URL        (default http://localhost:8001)
#   GATEWAY_URL   (default http://localhost:8080)
#   COMPOSE_FILE  (default ../docker-compose.yml relative to this script)

set -uo pipefail

ML_URL="${ML_URL:-http://localhost:8001}"
GATEWAY_URL="${GATEWAY_URL:-http://localhost:8080}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$SCRIPT_DIR/../docker-compose.yml}"

PASS=0
FAIL=0

green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
red()   { printf '\033[0;31m%s\033[0m\n' "$1"; }

# check <description> <command...>
# Runs the command; a zero exit code is a pass.
check() {
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then
    green "  PASS  $desc"
    PASS=$((PASS + 1))
  else
    red   "  FAIL  $desc"
    FAIL=$((FAIL + 1))
  fi
}

# http_contains <url> <needle>  -> succeeds if the response body contains needle
http_contains() {
  curl -s -f --max-time 10 "$1" | grep -q "$2"
}

# http_post_contains <url> <data> <needle>
http_post_contains() {
  curl -s -f --max-time 10 -X POST "$1" -d "$2" | grep -q "$3"
}

echo "=== resili INFRASTRUCTURE HEALTH CHECK ==="
echo "ML:      $ML_URL"
echo "Gateway: $GATEWAY_URL"
echo

# 1. PostGIS: only checked when docker compose is available (local/CI), so the
#    script still works when pointed at already-deployed remote services.
if command -v docker >/dev/null 2>&1 && [ -f "$COMPOSE_FILE" ]; then
  check "PostGIS accepts connections" \
    docker compose -f "$COMPOSE_FILE" exec -T postgis pg_isready -U resili -d resili
  check "PostGIS wards seeded (>=5)" bash -c \
    "test \"\$(docker compose -f '$COMPOSE_FILE' exec -T postgis psql -U resili -d resili -tAc 'SELECT count(*) FROM wards')\" -ge 5"
  check "PostGIS evacuation centers seeded (>=6)" bash -c \
    "test \"\$(docker compose -f '$COMPOSE_FILE' exec -T postgis psql -U resili -d resili -tAc 'SELECT count(*) FROM evacuation_centers')\" -ge 6"
else
  echo "  SKIP  PostGIS checks (docker compose not available here)"
fi

# 2. Python ML service
check "Python ML forecast service /health" curl -s -f --max-time 10 "$ML_URL/health"

# 3. Go API gateway
check "Go API gateway /api/v1/health" curl -s -f --max-time 10 "$GATEWAY_URL/api/v1/health"

# 4. Ward risk GeoJSON feed
check "Ward risk GeoJSON FeatureCollection" \
  http_contains "$GATEWAY_URL/api/v1/wards/risk/all" "FeatureCollection"

# 5. Tamper-evident audit ledger
check "Audit ledger reports chain_valid" \
  http_contains "$GATEWAY_URL/api/v1/ledger" "chain_valid"

# 6. USSD callback (Swahili menu)
check "USSD callback returns flood-risk menu (Hatari)" \
  http_post_contains "$GATEWAY_URL/api/v1/ussd" "text=1" "Hatari"

echo
echo "=== SUMMARY: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
  red "One or more checks failed — platform is NOT demo-ready."
  exit 1
fi
green "All checks passed — platform is demo-ready."
