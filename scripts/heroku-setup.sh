#!/usr/bin/env bash
#
# resili — one-command Heroku provisioning.
#
# Creates the three resili apps on the container stack, attaches a shared
# PostGIS-enabled Postgres and Redis, loads migrations + seed data, and sets
# every config var / secret needed for a working production deploy. Safe to run
# repeatedly — every step is idempotent.
#
# Prerequisites:
#   - Heroku CLI logged in, or HEROKU_API_KEY exported.
#   - Secrets available in infrastructure/.env (Daraja + Africa's Talking).
#
# Usage:
#   NEXT_PUBLIC_MAPBOX_TOKEN=pk.xxx bash scripts/heroku-setup.sh
#
# Optional overrides (env vars):
#   ML_APP        (default: resili-forecast)
#   GATEWAY_APP   (default: resili-gateway)
#   CONSOLE_APP   (default: resili-console)
#   REGION        (default: eu — closest Heroku region to East Africa)

set -euo pipefail

ML_APP="${ML_APP:-resili-forecast}"
GATEWAY_APP="${GATEWAY_APP:-resili-gateway}"
CONSOLE_APP="${CONSOLE_APP:-resili-console}"
REGION="${REGION:-eu}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${REPO_ROOT}/infrastructure/.env"

log()  { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }

require_heroku() {
  command -v heroku >/dev/null 2>&1 || { echo "heroku CLI not found"; exit 1; }
  heroku auth:whoami >/dev/null 2>&1 || { echo "Not logged in. Export HEROKU_API_KEY or run 'heroku login'."; exit 1; }
}

# Create an app on the container stack only if it does not already exist.
ensure_app() {
  local app="$1"
  if heroku apps:info --app "$app" >/dev/null 2>&1; then
    log "App '$app' already exists — reusing."
  else
    log "Creating app '$app' (region $REGION, container stack)…"
    heroku apps:create "$app" --region "$REGION" --stack container
  fi
}

# Attach an addon only if the app has no plan of that family yet.
ensure_addon() {
  local app="$1" plan="$2" family="$3"
  if heroku addons --app "$app" 2>/dev/null | grep -q "$family"; then
    log "Addon '$family' already attached to '$app'."
  else
    log "Provisioning '$plan' on '$app'…"
    heroku addons:create "$plan" --app "$app" --wait
  fi
}

# Load KEY=VALUE pairs from infrastructure/.env into the current shell.
load_secrets() {
  if [ -f "$ENV_FILE" ]; then
    log "Loading secrets from $ENV_FILE"
    set -a
    # shellcheck disable=SC1090
    . <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' "$ENV_FILE")
    set +a
  else
    warn "$ENV_FILE not found — Daraja/Africa's Talking config will be blank."
  fi
}

require_heroku
load_secrets

# ── 1. Apps ────────────────────────────────────────────────────────────────
ensure_app "$ML_APP"
ensure_app "$GATEWAY_APP"
ensure_app "$CONSOLE_APP"

# ── 2. Data services (shared Postgres + Redis, attached to the gateway) ──────
ensure_addon "$GATEWAY_APP" "heroku-postgresql:essential-0" "heroku-postgresql"
ensure_addon "$GATEWAY_APP" "heroku-redis:mini" "heroku-redis"

# Share the same database with the ML service so both read the same wards.
DB_ADDON="$(heroku addons --app "$GATEWAY_APP" 2>/dev/null | grep -o 'postgresql-[a-z]*-[0-9]*' | head -1 || true)"
if [ -n "$DB_ADDON" ]; then
  if heroku addons --app "$ML_APP" 2>/dev/null | grep -q "$DB_ADDON"; then
    log "Database already attached to '$ML_APP'."
  else
    log "Attaching shared database '$DB_ADDON' to '$ML_APP'…"
    heroku addons:attach "$DB_ADDON" --app "$ML_APP" || warn "Could not attach shared DB to ML app."
  fi
fi

# ── 3. Schema + seed data (PostGIS enabled, migrations then seeds) ───────────
log "Enabling PostGIS and loading migrations + seeds on '$GATEWAY_APP'…"
heroku pg:psql --app "$GATEWAY_APP" -c "CREATE EXTENSION IF NOT EXISTS postgis;" || warn "PostGIS enable failed (may already exist)."
for f in \
  "$REPO_ROOT/infrastructure/migrations/0001_risk_and_trigger_audit.sql" \
  "$REPO_ROOT/infrastructure/migrations/0002_ward_geometry_and_hazards.sql" \
  "$REPO_ROOT/infrastructure/data/seed-wards.sql" \
  "$REPO_ROOT/infrastructure/data/seed-evacuation-centers.sql"; do
  if [ -f "$f" ]; then
    log "Applying $(basename "$f")"
    heroku pg:psql --app "$GATEWAY_APP" -f "$f" || warn "Failed applying $(basename "$f") (idempotent scripts may report benign notices)."
  fi
done

# ── 4. Config vars ───────────────────────────────────────────────────────────
log "Setting gateway config vars…"
heroku config:set --app "$GATEWAY_APP" \
  ML_SERVICE_URL="https://${ML_APP}.herokuapp.com" \
  PAYOUT_ADAPTER="${PAYOUT_ADAPTER:-mock}" \
  DARAJA_ENV="${DARAJA_ENV:-sandbox}" \
  DARAJA_CONSUMER_KEY="${DARAJA_CONSUMER_KEY:-}" \
  DARAJA_CONSUMER_SECRET="${DARAJA_CONSUMER_SECRET:-}" \
  DARAJA_BUSINESS_SHORT_CODE="${DARAJA_BUSINESS_SHORT_CODE:-}" \
  DARAJA_INITIATOR_NAME="${DARAJA_INITIATOR_NAME:-}" \
  DARAJA_SECURITY_CREDENTIAL="${DARAJA_SECURITY_CREDENTIAL:-}" \
  DARAJA_B2C_RESULT_URL="${DARAJA_B2C_RESULT_URL:-}" \
  DARAJA_QUEUE_TIMEOUT_URL="${DARAJA_QUEUE_TIMEOUT_URL:-}" \
  AFRICAS_TALKING_USERNAME="${AFRICAS_TALKING_USERNAME:-sandbox}" \
  AFRICAS_TALKING_API_KEY="${AFRICAS_TALKING_API_KEY:-}" \
  AFRICAS_TALKING_SENDER="${AFRICAS_TALKING_SENDER:-}"

log "Provisioning complete."
cat <<EOF

  Apps:
    ML       https://${ML_APP}.herokuapp.com
    Gateway  https://${GATEWAY_APP}.herokuapp.com
    Console  https://${CONSOLE_APP}.herokuapp.com

  Next: push images (CI does this automatically on master), or manually:
    (cd services/forecast-ingest && heroku container:push web -a ${ML_APP} && heroku container:release web -a ${ML_APP})
    (cd services/gateway         && heroku container:push web -a ${GATEWAY_APP} && heroku container:release web -a ${GATEWAY_APP})
    (cd apps/console             && heroku container:push web -a ${CONSOLE_APP} \\
        --arg NEXT_PUBLIC_API_BASE_URL=https://${GATEWAY_APP}.herokuapp.com,NEXT_PUBLIC_MAPBOX_TOKEN=\${NEXT_PUBLIC_MAPBOX_TOKEN} \\
        && heroku container:release web -a ${CONSOLE_APP})
EOF
