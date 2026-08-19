---
title: Restate logger living docs when live Pino product diverges from CE documentation
date: 2026-08-19
category: documentation-gaps
module: documentation / logging
problem_type: documentation_gap
component: documentation
severity: medium
applies_when:
  - Live logger implementation changed (native Pino, pretty output, child loggers) but CE living docs still describe a retired wrapper or JSON contract
  - An agent following CONCEPTS, architecture, solutions, or a still-live plan would reconstruct logging code the tree no longer has
  - A docs-only pass is scoped to restatement without fixing pre-existing test or typecheck drift in logger code
tags:
  - living-docs
  - logger
  - pino
  - documentation-restatement
  - concepts
  - composition
  - ce-docs
related_components:
  - tooling
  - development_workflow
---

# Restate logger living docs when live Pino product diverges from CE documentation

## Context

The live logger is native Pino with colorized pretty local output, slice `component` child loggers at composition, and Error-first bootstrap on config-load failure. CE living docs and one still-live plan still described a message-first `(message, extra?)` port, JSON-on-stdout as the operator contract, extra `JSON.stringify` cloning, and optional `Writable` destination seams.

Following those stale docs would rebuild a wrapper the codebase no longer has. A docs-only restatement pass aligned living artifacts with `src/shared/logging/logger.ts`, `src/main.ts`, and `src/composition/build-app.ts` without changing logger implementation or tests (those were already red from drift).

This learning complements the broader hexagonal living-docs recipe in [living-docs-hexagonal-slices.md](./living-docs-hexagonal-slices.md). That doc covers layout and slice shape; this one covers **logger product restatement** when implementation diverges from documentation.

## Guidance

Treat **live logger code + composition wiring** as the product authority. Restate living docs and any still-live plan sections that read as current how-to. Leave intentional snapshots unchanged.

### 1. Know the live logger product (read these first)

| Contract | Live source |
|----------|-------------|
| `Logger = pino.Logger` | `src/shared/logging/logger.ts` |
| Pretty colorized local output | `pino-pretty` transport with `colorize: true` in `createLogger` |
| Slice children at composition | `logger.child({ component: 'health' \| 'places' })` in `build-app.ts` — no composition-time `adapter` children |
| Error-first bootstrap | `createLogger('error').error(error, 'load config failed')` in `main.ts` catch |
| Mixed Pino call styles | Object-first (`logger.info({ port }, 'listening')`) and message-only are both valid |

Do not document a four-method `(message, extra?)` port, extra cloning, or JSON-only stdout as the operator product.

**Mixed Pino call styles (all valid):** object-first with context (`logger.info({ port }, 'listening')`), message-only when sufficient (`this.logger.info('google api health check passed')`), and Error-first for bootstrap (`createLogger('error').error(error, 'load config failed')`). Docs must not prescribe a single message-first port shape.

### 2. Living vs snapshot — what to rewrite

| Artifact class | Action this pass |
|----------------|------------------|
| `CONCEPTS.md` logging terms | Restate bootstrap and child logger entries |
| `docs/architecture.md` composition section | Add slice child bindings matching `buildApp` |
| Current-path solutions (e.g. config-load bootstrap) | Rewrite as live recipe, not wrapper snapshot |
| Still-live plan with implementation how-to (2026-08-18 pino plan) | Rewrite Product Contract and IUs as **shipped product**, not rebuild recipe |
| Named-event logging plan (2026-08-12) | **Snapshot** — do not rewrite |
| Other solutions with flat `logger` in `buildApp` snippets | **Intentional drift** for wiring lessons — but fix stale **bootstrap call shapes** when cited (e.g. express HTTP solution `main.ts` block) |

Living docs plus composition win on layout (`AGENTS.md`). Snapshot plans and older solutions may be wrong; agents must not reconstruct retired patterns from them.

### 3. Docs-only verification when gates are red

When logger tests or `typecheck` fail from pre-existing drift (missing `LogLevel` export, tests expecting `createLogger(level, Writable)` and NDJSON parsing), a docs-only pass:

- Does **not** fix `src/` or `tests/` to green the gates
- Verifies restatement by **cold-read** and **grep** instead

**Grep checklist (stale vocabulary should not appear in restated files):**

- `message-first` / `(message, extra?)` as the documented port
- `JSON.stringify` extra cloning as logger contract
- `Record<string, unknown>` as the logger extra type
- `JSON-on-stdout` or "structured JSON line on stdout" as operator product
- Composition docs that pass one flat logger everywhere with no `child({ component })`

**Positive signals:**

- Bootstrap docs show Error-first then message string
- Architecture or CONCEPTS describe slice `component` children
- Pino plan no longer forbids `pino-pretty` or mandates wrapper rebuild

Prior docs-only precedent: `docs/plans/2026-08-12-003-docs-living-docs-hexagonal-plan.md` — do not use green `npm test` / `typecheck` as proof when code drift is explicitly out of scope.

### 4. Files updated in this restatement (reference set)

- `CONCEPTS.md` — Bootstrap logger, Child logger
- `docs/architecture.md` — composition child bindings
- `docs/solutions/developer-experience/config-load-error-logging.md` — native Pino bootstrap path
- `docs/plans/2026-08-18-001-refactor-pino-logger-plan.md` — restated as current product

Orchestration plan: `docs/plans/2026-08-19-001-docs-logger-ce-docs-restatement-plan.md`.

## Why This Matters

- **Stale docs recreate deleted code** — a message-first wrapper is easy to "fix back" when docs still teach it.
- **Wrong operator expectations** — JSON-on-stdout docs mislead local debugging when output is pretty text.
- **Wrong composition wiring** — flat logger everywhere hides slice `component` children that aid log filtering.
- **Green gates are not always available** — documenting the verification substitute prevents either blocking on unrelated test debt or "fixing" code outside scope.

## When to Apply

- Logger implementation or composition wiring changed and CE docs lag.
- A still-live plan's Product Contract or IUs contradict `buildApp` or `createLogger`.
- Bootstrap or config-load solution still references a custom logger port.
- You scope a **docs-only** restatement with explicit carve-out for pre-existing logger test/typecheck drift.

## Examples

### Live logger factory (product authority)

```typescript
// src/shared/logging/logger.ts
export type Logger = pino.Logger;

export function createLogger(level: LevelWithSilent): Logger {
  return pino({
    level,
    transport: {
      target: 'pino-pretty',
      options: { colorize: true }
    }
  });
}
```

### Composition children (not flat logger everywhere)

```typescript
// src/composition/build-app.ts
const healthLogger = logger.child({ component: 'health' });
const placesLogger = logger.child({ component: 'places' });
// passed into adapters, routes, and services for each slice
```

### Bootstrap (Error-first, not message-then-extra)

```typescript
// src/main.ts
} catch (error) {
  createLogger('error').error(error as Error, 'load config failed');
  process.exit(1);
}
```

### Before vs after in living docs

| Stale doc claim | Restated claim |
|-----------------|----------------|
| Logger port is `(message, extra?: Record<string, unknown>)` | `Logger = pino.Logger`; native call shapes |
| Operator sees JSON on stdout | Colorized pretty local output is the product |
| Pass root `logger` into every adapter | One `child({ component })` per slice at composition |
| Bootstrap: `logger.error('load config failed', { error })` | `createLogger('error').error(error, 'load config failed')` |
| Pino plan: keep wrapper, forbid pretty | Plan describes shipped native Pino + pretty as product |

## What Didn't Work

| Approach | Why it failed |
|----------|----------------|
| Surgical sentence patches across many files | Left contradictory wrapper requirements in still-live plan IUs |
| Rewriting every logging plan and flat-logger solution snippets | Named-event plan is historical; some solutions intentionally show flat logger for other lessons |
| Fixing logger tests/code to green gates during docs pass | Expands scope; drift was pre-existing and unrelated to doc accuracy |
| Documenting composition-time `adapter` children | `buildApp` only binds `component` children; adapters may child further internally |
| Using `npm test` / `typecheck` alone as done signal | Failed on `LogLevel` import and NDJSON logger tests while docs were already correct |

## Related

- [Keep living docs aligned with hexagonal slices](./living-docs-hexagonal-slices.md) — general living-vs-snapshot layout recipe
- [Express HTTP adapter over Fastify](../tooling-decisions/express-http-adapter-over-fastify-hexagonal.md) — flat `buildApp` snippet kept; bootstrap call shape aligned with live `main.ts`
- [Bootstrap error logger and Zod issue mapping](../developer-experience/config-load-error-logging.md) — config-load bootstrap after restatement
- `docs/plans/2026-08-19-001-docs-logger-ce-docs-restatement-plan.md` — orchestration plan for this pass
- `docs/plans/2026-08-18-001-refactor-pino-logger-plan.md` — restated as shipped logger product
- `CONCEPTS.md` — Bootstrap logger, Child logger, Living docs, Snapshot
- `src/shared/logging/logger.ts`, `src/main.ts`, `src/composition/build-app.ts` — live authority
