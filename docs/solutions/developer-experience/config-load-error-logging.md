---
title: Bootstrap error logger and Zod issue mapping for config load failures in main.ts
date: 2026-08-12
category: developer-experience
module: composition
problem_type: developer_experience
component: development_workflow
severity: low
applies_when:
  - Logging config validation failures before loadConfig succeeds and a config-scoped logger exists
  - Using native Pino Error-first then message at bootstrap
  - Formatting Zod validation errors for human-readable startup failure messages
  - Keeping bootstrap failure handling inline in main.ts without a separate helper
tags:
  - config
  - zod
  - logging
  - bootstrap
  - typescript
  - main
  - error-handling
related_components:
  - tooling
  - documentation
---

# Bootstrap error logger and Zod issue mapping for config load failures in main.ts

## Context

When `loadConfig()` fails during process bootstrap, the app must exit — but a bare `process.exit(1)` with no log line makes local diagnosis impossible. Missing or invalid env vars should produce a loud pretty error line before the process dies.

`loadConfig()` in `src/composition/config.ts` validates env with Zod and rethrows a plain `Error` whose message lists field paths and messages. `main.ts` catches that failure and logs it with a bootstrap logger before exiting.

Two constraints shape the solution:

1. **Config is unavailable on failure** — `config.log.level` cannot be read when `loadConfig()` throws, so logging must use a fixed bootstrap level.
2. **Logger is native Pino** — `createLogger` returns `pino.Logger`. Bootstrap uses Error-first then a message string, not a custom `(message, extra?)` port.

## Guidance

### 1. Bootstrap logger in `main.ts` catch block

Use `createLogger('error')` so config-load failures always emit at error severity regardless of the (unloaded) `LOG_LEVEL`.

**Before** (silent failure — no log before exit):

```typescript
try {
  config = loadConfig();
  logger = createLogger(config.log.level);
} catch {
  process.exit(1);
}
```

**After** (current `src/main.ts`):

```typescript
try {
  config = loadConfig();
  logger = createLogger(config.log.level);
} catch (error) {
  createLogger('error').error(error as Error, 'load config failed');
  process.exit(1);
}
```

The bootstrap logger is created only in the catch path; the normal path still uses `createLogger(config.log.level)` once config is valid. Local output is colorized pretty.

### 2. Format Zod issues as `{ field, message }` in the thrown Error, not `.format()` or `.flatten()`

`loadConfig()` catches `ZodError` and maps `error.issues` to `{ field, message }` pairs, joining them into the thrown `Error` message:

```typescript
const errors = (error as z.ZodError).issues.map(issue => ({
  field: issue.path.join('.'),
  message: issue.message
}));
throw new Error(`${errors.map(error => `${error.field}: ${error.message}`).join(', ')}`);
```

This preserves dotted field paths (e.g. `google.apiKey`) in the message. Prefer `issue.path.join('.')` over Zod's built-in formatters when you need human-readable, path-qualified output.

The live bootstrap path logs that `Error` with Pino (`error` then `'load config failed'`). Do not invent a message-then-extra-Record wrapper around it.

### 3. Keep bootstrap logging inline in `main.ts`

Formatting and logging for the bootstrap failure path belong in `main.ts`'s catch block, not in a separate `formatConfigLoadError` helper inside `config.ts`. `loadConfig()` should throw a concise `Error` (as it does today); `main.ts` owns the last-chance log line and `process.exit(1)`.

## Why This Matters

- **Silent exits waste debugging time** — without a log line, a missing `.env` key looks like a hung or broken process.
- **Unreadable Zod output hides the failing field** — `.format()` nests `_errors` arrays that are hard to scan.
- **Lost paths mislead fixes** — `.flatten()` collapses nested paths so `google.apiKey` may appear only as `google`.

## When to Apply

- Any bootstrap path where config/env parsing can fail before a configured logger exists (`main.ts`, similar entrypoints).
- Logging `ZodError` validation failures where field paths matter (nested config objects like `google.apiKey`).

## Examples

### Readable Zod issue mapping (in `loadConfig`)

```typescript
const errors = (error as z.ZodError).issues.map(issue => ({
  field: issue.path.join('.'),
  message: issue.message
}));
```

Missing Google API key yields a message like `google.apiKey: Required` (path from `issue.path.join('.')`, message from Zod).

### Current shipped behavior

```typescript
} catch (error) {
  createLogger('error').error(error as Error, 'load config failed');
  process.exit(1);
}
```

`loadConfig()` already joined field paths into `Error.message`. Pino receives the `Error` first, then the message string.

## What Didn't Work

| Approach | Why it failed |
|----------|----------------|
| **Zod `.format()`** | Produces nested `_errors` objects that are hard to scan. |
| **Zod `.flatten()`** | Flatter shape but loses full dotted paths; nested field `google.apiKey` may surface only under `google`. |
| **`formatConfigLoadError` helper in `config.ts`** | Mixes bootstrap logging concerns into config loading; preference is inline handling in `main.ts` catch. |
| **`createLogger(config.log.level)` in catch** | `config` is undefined when `loadConfig()` throws — use `createLogger('error')` instead. |

## Related

- [Express HTTP adapter over Fastify (hexagonal)](../tooling-decisions/express-http-adapter-over-fastify-hexagonal.md) — tangential overlap on Zod at route boundary and logger wiring in tests; does not cover config bootstrap logging.
- `src/main.ts` — bootstrap try/catch and exit
- `src/composition/config.ts` — Zod parse and issue-to-message mapping
- `src/shared/logging/logger.ts` — `Logger = pino.Logger`, `createLogger`
- [CONCEPTS.md](../../../CONCEPTS.md) — Bootstrap logger
