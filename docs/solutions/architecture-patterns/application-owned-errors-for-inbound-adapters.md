---
title: Application-owned errors for inbound adapters (hexagonal)
date: 2026-08-11
category: architecture-patterns
module: hexagonal-adapters
problem_type: architecture_pattern
component: tooling
severity: medium
applies_when:
  - "Inbound HTTP routes need to catch or map upstream/quota failures from outbound adapters"
  - "An error type currently lives only under src/adapters/outbound and inbound code wants to import it"
  - "npm run lint:arch fails with inbound-must-not-import-outbound"
  - "Outbound adapters need provider-specific error subclasses without leaking outbound modules into inbound"
tags:
  - hexagonal
  - inbound-adapters
  - outbound-adapters
  - application-errors
  - lint-arch
  - dependency-rule
related_components:
  - development_workflow
  - documentation
---

# Application-owned errors for inbound adapters (hexagonal)

## Context

Hexagonal dependency direction requires inbound adapters to talk to outbound adapters only through application ports. That rule is documented in [hexagonal architecture](../../architecture/hexagonal.md) and enforced by `scripts/lint-arch.mjs` via `inbound-must-not-import-outbound`, which forbids imports from `adapters/inbound/**` into `adapters/outbound/**`.

HTTP-mappable failures create a practical trap. Outbound Google adapters surface provider-specific types such as `PlacesQuotaError`. The inbound HTTP sweep route needs to map quota exhaustion to HTTP 429. Importing `PlacesQuotaError` from `adapters/outbound/google/types.ts` violates the inbound→outbound ban even when the only intent is `instanceof` handling.

## Guidance

1. **Define shared HTTP-mappable errors in application.** `src/application/errors.ts` exports `QuotaExhaustedError` and `UpstreamAdapterError` as the types inbound maps to HTTP statuses.

2. **Outbound adapters may specialize those bases.** `PlacesAdapterError` extends `UpstreamAdapterError` and `PlacesQuotaError` extends `QuotaExhaustedError` in `src/adapters/outbound/google/types.ts`. Outbound code throws the specialized subclasses; inbound catches the application base.

3. **Inbound adapters import application errors only.** `src/adapters/inbound/http/sweep-route.ts` imports `QuotaExhaustedError` from `application/errors.js` and maps it to 429 — never from `adapters/outbound`.

4. **Keep the lint gate green.** After moving error types across layers, run `npm run lint:arch`.

## Why This Matters

- Catching a provider error by importing its outbound module creates a forbidden inbound→outbound edge.
- Inbound only needs “quota exhausted” / “upstream failed,” not Google-specific names — application bases are the stable HTTP-mapping contract.
- `PlacesQuotaError` remains useful inside the Google adapter while still satisfying `instanceof QuotaExhaustedError` for the HTTP layer.
- Matches the documented hexagonal story: inbound reaches outbound only through application ports.

## When to Apply

- Adding a new outbound adapter error that an inbound HTTP adapter must map to a status code.
- Refactoring catch blocks so an inbound module stops importing outbound modules solely for `instanceof`.
- Introducing a second outbound provider that shares the same HTTP-facing failure meanings — extend the application bases rather than teaching inbound about each provider type.
- Any change that would add a relative import from `src/adapters/inbound/**` into `src/adapters/outbound/**`.

## Examples

### Before (violates inbound → outbound)

```ts
// inbound HTTP route — DO NOT
import { PlacesQuotaError } from "../../outbound/google/types.js";

if (error instanceof PlacesQuotaError) {
  return reply.code(429).send({ error: "quota_exhausted", message: error.message });
}
```

### After (application-layer catch)

```ts
// src/adapters/outbound/google/types.ts
import { UpstreamAdapterError, QuotaExhaustedError } from "../../../application/errors.js";

export class PlacesQuotaError extends QuotaExhaustedError {
  constructor(message: string) {
    super(message);
    this.name = "PlacesQuotaError";
  }
}
```

```ts
// src/adapters/inbound/http/sweep-route.ts
import { QuotaExhaustedError } from "../../../application/errors.js";

if (error instanceof QuotaExhaustedError) {
  return reply
    .code(429)
    .send({ error: "quota_exhausted", message: error.message });
}
```

Thrown `PlacesQuotaError` instances remain catchable as `QuotaExhaustedError` because of inheritance, without the inbound route knowing about Google types.

## Related

- [Hexagonal architecture](../../architecture/hexagonal.md) — dependency rules enforced by `npm run lint:arch`
- [Docs-first AI harness](./docs-first-ai-harness.md) — adjacent; cites hexagonal/`lint:arch` but does not cover application-owned errors
- `src/application/errors.ts` — shared HTTP-mappable application errors
- `src/adapters/inbound/http/sweep-route.ts` — inbound catch of `QuotaExhaustedError` → 429
- `src/adapters/outbound/google/types.ts` — `PlacesQuotaError extends QuotaExhaustedError`
