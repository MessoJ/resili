# Deploying resili

resili ships two fully-automated deploy paths: **Render (primary, live)** and
**Heroku (alternative)**. Both build the same three container services from this
repo and honour the platform-injected `$PORT`.

## Live on Render (primary)

The platform is deployed and running on Render (see `render.yaml`):

| Service           | Live URL                                 |
| ----------------- | ---------------------------------------- |
| Console (PWA)     | https://resili-console.onrender.com      |
| API gateway (Go)  | https://resili-gateway.onrender.com      |
| ML forecast API   | https://resili-forecast.onrender.com     |

- **CD is automatic:** each service has `autoDeploy: yes`, so every push to
  `master` rebuilds and redeploys it — no extra workflow required.
- **No database needed:** ward risk is served by the ML model's deterministic
  per-ward snapshots and the audit ledger / triggers are in-memory, so the stack
  runs on Render's free tier. (Add the `resili-db`/`resili-redis` blocks in
  `render.yaml` only if you later need persistent storage.)
- **Payouts** default to `PAYOUT_ADAPTER=mock` (demo-safe); set the Daraja /
  Africa's Talking config vars + `PAYOUT_ADAPTER=live` on `resili-gateway` to go
  live.
- **Free-tier note:** free instances cold-start after ~15 min idle and may drop
  the occasional request; the console degrades gracefully to deterministic demo
  data and self-heals on its 60 s refresh. Upgrade any service to a paid
  instance to remove cold starts.

### Recreate the Render stack from scratch

Either connect the repo in the Render dashboard and "New → Blueprint" (uses
`render.yaml`), or create the three Docker web services via the API with
`runtime=docker`, `plan=free`, `region=frankfurt`, wiring the gateway's
`ML_SERVICE_URL` and the console's `NEXT_PUBLIC_API_BASE_URL` /
`NEXT_PUBLIC_MAPBOX_TOKEN`.

---

## Deploying to Heroku (alternative)

resili can equally run as three Heroku apps that share one PostGIS database and
one Redis:

| Service            | Path                        | Heroku app (default) | Stack     |
| ------------------ | --------------------------- | -------------------- | --------- |
| ML forecast API    | `services/forecast-ingest`  | `resili-forecast`    | container |
| API gateway (Go)   | `services/gateway`          | `resili-gateway`     | container |
| Console (Next.js)  | `apps/console`              | `resili-console`     | container |

All three honour the Heroku-injected `$PORT`. The gateway and console are
built against the ML/gateway public URLs respectively, so **deploy order is
ML → gateway → console**.

---

## 1. One-time: install the CLI and log in

```bash
curl -fsSL https://cli-assets.heroku.com/install.sh | sh   # or: brew install heroku
export HEROKU_API_KEY=HRKU-xxxxxxxx        # from `heroku authorizations:create`
heroku auth:whoami                          # confirm you are logged in
```

## 2. One-time: provision apps, database, secrets

The idempotent helper creates the three apps, attaches a PostGIS-enabled
Postgres + Redis (shared with the ML app), loads the migrations and seed data,
and sets every config var (including the Daraja / Africa's Talking secrets read
from `infrastructure/.env`):

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_token bash scripts/heroku-setup.sh
```

Re-running it is safe — existing apps/addons/config are reused, not duplicated.

## 3. Deploy — automatic (recommended)

CI/CD is wired with GitHub Actions:

- **`.github/workflows/ci.yml`** — on every push/PR, builds and tests the Go
  gateway, the Python ML service, the console, and the USSD core package.
- **`.github/workflows/deploy-heroku.yml`** — on every green push to `master`,
  builds each image and releases it to its Heroku app via the Container
  Registry (ML → gateway → console), then smoke-tests the gateway `/health`.

Configure these once in **GitHub → Settings → Secrets and variables → Actions**:

| Kind     | Name                        | Value                                   |
| -------- | --------------------------- | --------------------------------------- |
| Secret   | `HEROKU_API_KEY`            | your `HRKU-…` token                      |
| Secret   | `NEXT_PUBLIC_MAPBOX_TOKEN`  | your public `pk.` Mapbox token           |
| Variable | `HEROKU_ML_APP`             | `resili-forecast` (optional override)    |
| Variable | `HEROKU_GATEWAY_APP`        | `resili-gateway` (optional override)     |
| Variable | `HEROKU_CONSOLE_APP`        | `resili-console` (optional override)     |

## 4. Deploy — manual (fallback)

```bash
heroku container:login

(cd services/forecast-ingest && heroku container:push web -a resili-forecast && heroku container:release web -a resili-forecast)
(cd services/gateway         && heroku container:push web -a resili-gateway  && heroku container:release web -a resili-gateway)
(cd apps/console             && heroku container:push web -a resili-console \
    --arg NEXT_PUBLIC_API_BASE_URL=https://resili-gateway.herokuapp.com,NEXT_PUBLIC_MAPBOX_TOKEN=$NEXT_PUBLIC_MAPBOX_TOKEN \
    && heroku container:release web -a resili-console)
```

Each service directory also carries a `heroku.yml`, so a plain
`git push heroku` from a subtree works too.

## 5. Verify

```bash
curl -s https://resili-gateway.herokuapp.com/api/v1/health
curl -s https://resili-gateway.herokuapp.com/api/v1/wards/risk/all | head -c 300
open  https://resili-console.herokuapp.com
```

---

## Secrets policy

- **Never commit real credentials.** `infrastructure/.env` is git-ignored; CI
  reads secrets from GitHub Actions secrets; runtime reads them from Heroku
  config vars set by `scripts/heroku-setup.sh`.
- The Mapbox `pk.` token is a *public*, URL-restricted token and is the only
  credential inlined into the browser bundle (at build time).
- Keep `PAYOUT_ADAPTER=mock` for demos; switch to `live` only with a complete
  Daraja B2C credential set (short code, initiator, security credential, result
  URL) and a real Africa's Talking account username.

## Notes on data services

- Heroku Postgres supports the `postgis` extension; the setup script enables it
  before loading migrations.
- The ML app shares the gateway's database via `heroku addons:attach`, so both
  read the same ward table. For a fully independent ML datastore, give it its
  own `heroku-postgresql` addon instead.
