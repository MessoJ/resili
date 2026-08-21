# resili Engineering Rules

## Scope

resili is climate-risk and anticipatory-action infrastructure for the Lake
Victoria Basin. Do not add unrelated marketplace, health-triage, or social
features.

## Conventions

- Use TypeScript strict mode with no `any`, named exports, and Zod validation
  for every external API input.
- Use `kebab-case.ts` for utilities and `PascalCase.tsx` for React components.
- Every table requires UUID `id`, `created_at`, `updated_at`, soft deletion,
  enforced foreign keys, and PostGIS `geography` for spatial data.
- Keep every component independently testable and add tests in the same change.
- Keep `main` demoable; use deterministic seed data rather than stage-time APIs.

## Climate safety guardrails

- Never state that flooding "will" happen; communicate likelihood, source,
  model version, and uncertainty.
- Attribute weather warnings to KMD/NDMA and never impersonate them.
- Sign outbound alerts and protect public endpoints with rate limits.
- Generalise public report locations to ward level and hash/minimise phone PII.
- Require public trigger rules, two-person payout approval, idempotency, and
  audit entries for every trigger or payment action.