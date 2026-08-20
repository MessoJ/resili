# Rezili

**Climate risk intelligence that helps communities act before the water arrives.**

Rezili turns authoritative forecasts into ward-level, explainable, impact-based
decisions for the Lake Victoria Basin. It does not replace KMD, NDMA, GloFAS,
or local authorities; it localises their data for anticipatory action and makes
each trigger decision auditable.

## Status

This is a new repository. The foundation is being built in public with a
deterministic demo path, strong safety guardrails, and selective attribution to
reused, tested infrastructure from Kilimo Halisi. No operational alert or
payout should be treated as live until its relevant adapter, approvals, and
external credentials have been independently verified.

## Architecture

```text
authoritative forecast data -> ingest -> risk engine -> trigger engine
                                           |                |
                                      ward-level API   signed alerts + payout adapter
                                           |                |
                            web command centre / mobile / USSD <- audit ledger
```

## Data and standards

- Forecast inputs: Open-Meteo/GloFAS, ERA5, CHIRPS, NASA POWER, NDMA.
- Administrative boundaries: HDX COD-AB and verified Kenyan ward datasets.
- Standards: CAP 1.2, GeoJSON/OGC API Features, ISO 8601 UTC, HDX P-codes,
  STAC provenance, and SDG/Sendai indicator mappings.

All live data will retain source attribution, model version, and input hash.

## Local setup

```bash
cp .env.example .env
pnpm install
pnpm test
```

Infrastructure, migrations, and the deterministic demo seed will be introduced
with the first runnable risk vertical slice.

## Safety

Forecasts are probabilistic estimates, not certainty. Follow directives from
KMD, NDMA, and county governments. See `SECURITY.md` and `DO-NO-HARM.md`.

## Credits

Rezili is a distinct climate-resilience product. Where useful, it selectively
adapts verified infrastructure patterns from Kilimo Halisi; adapted source and
test provenance will be recorded alongside each imported component.