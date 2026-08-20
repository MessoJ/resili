# Security Policy

## Reporting vulnerabilities

Do not disclose vulnerabilities in public issues. Contact the project owners
privately and include reproducible evidence. Do not include credentials, phone
numbers, precise household locations, or payout data in a report.

## Safety-critical controls

- Alerts must be signed, source-attributed, probabilistic, and rate limited.
- Payouts require an idempotency key, two distinct approvers, a complete audit
  trail, and a verified sandbox/production callback before settlement.
- PII is minimised; public location data is generalised to the ward level.
- Secrets belong only in local environment variables or approved secret stores.
- Dependencies and payment integrations require review before production use.