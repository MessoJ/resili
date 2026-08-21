# Architectural Decisions

| Date | Decision | Reason |
| --- | --- | --- |
| 2026-08-20 | Build a new resili codebase rather than rename Kilimo Halisi. | The climate-risk domain requires a new core; only verified, domain-neutral infrastructure may be adapted. |
| 2026-08-20 | Use deterministic seeded data for every stage demo. | Safety-critical demos must remain credible when external APIs are unavailable. |
| 2026-08-20 | Treat authoritative forecast providers as inputs, not competitors. | resili implements local impact-based decision support and must not impersonate Kenyan warning authorities. |
| 2026-08-20 | Default payouts to a mock adapter until sandbox credentials and callbacks are verified. | Money movement requires explicit two-person approval, idempotency, auditability, and externally verified configuration. |