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
  - Logger.error second argument must be a plain object, not a callback or array
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

When `loadConfig()` fails during process bootstrap, the app must exit — but a bare `process.exit(1)` with no log line makes local diagnosis impossible. Missing or invalid env vars (for example `GOOGLE_API_KEY`) should produce a loud structured JSON line on stdout before the process dies.

`loadConfig()` in `src/composition/config.ts` validates env with Zod and rethrows a plain `Error` whose message lists field paths and messages (`src/composition/config.ts:46-51`). `main.ts` catches that failure and logs it with a bootstrap logger before exiting (`src/main.ts:12-14`).

Two constraints shape the solution:

1. **Config is unavailable on failure** — `config.log.level` cannot be read when `loadConfig()` throws, so logging must use a fixed bootstrap level.
2. **`Logger.error` expects a plain object** — the second argument is `extra?: Record<string, unknown>`, not a callback or a bare array (`src/shared/logging/logger.ts`). The wrapper clones extras with `JSON.stringify` before passing them to Pino.

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

**After** (current `src/main.ts:9-15`):

```typescript
try {
  config = loadConfig();
  logger = createLogger(config.log.level);
} catch (error) {
  createLogger('error').error('load config failed', { error: (error as Error).message });
  process.exit(1);
}
```

The bootstrap logger is created only in the catch path; the normal path still uses `createLogger(config.log.level)` once config is valid.

### 2. Format Zod issues as `{ field, message }`, not `.format()` or `.flatten()`

`loadConfig()` catches `ZodError` and maps `error.issues` to `{ field, message }` pairs, joining them into the thrown `Error` message (`src/composition/config.ts:46-51`):

```typescript
const errors = (error as z.ZodError).issues.map(issue => ({
  field: issue.path.join('.'),
  message: issue.message
}));
throw new Error(`${errors.map(error => `${error.field}: ${error.message}`).join(', ')}`);
```

This preserves dotted field paths (e.g. `google.apiKey`) in the message. Prefer `issue.path.join('.')` over Zod's built-in formatters when you need human-readable, path-qualified output.

For structured log output (instead of a joined string), pass the mapped array inside an object key — see Examples below.

### 3. Pass a `Record` to `logger.error`, never a callback or raw array

`Logger.error` is typed as `(message: string, extra?: Record<string, unknown>) => void` (`src/shared/logging/logger.ts`). The `createLogger` wrapper maps `(message, extra)` to Pino's object-first call and JSON-clones `extra` when present.

**Correct** — wrap the errors array in an object:

```typescript
createLogger('error').error('load config failed', {
  errors: (error as z.ZodError).issues.map(issue => ({
    field: issue.path.join('.'),
    message: issue.message
  }))
});
```

**Incorrect** — passing a function as the second argument (TypeScript error: not assignable to `Record<string, unknown>`):

```typescript
logger.error('load config failed', (error) => ({ errors: [...] })); // ✗
```

**Incorrect** — passing the array directly (TypeScript error: array is not `Record<string, unknown>`):

```typescript
logger.error('load config failed', errors); // ✗
```

### 4. Keep bootstrap logging inline in `main.ts`

Formatting and logging for the bootstrap failure path belong in `main.ts`'s catch block, not in a separate `formatConfigLoadError` helper inside `config.ts`. `loadConfig()` should throw a concise `Error` (as it does today); `main.ts` owns the last-chance log line and `process.exit(1)`.

## Why This Matters

- **Silent exits waste debugging time** — without a stdout JSON line, a missing `.env` key looks like a hung or broken process.
- **Unreadable Zod output hides the failing field** — `.format()` nests `_errors` arrays that are hard to scan in one-line JSON log output.
- **Lost paths mislead fixes** — `.flatten()` collapses nested paths so `google.apiKey` may appear only as `google`.
- **Logger contract is strict** — violating `Record<string, unknown>` fails at compile time; even if it compiled, a callback would never be invoked by `emit`.

## When to Apply

- Any bootstrap path where config/env parsing can fail before a configured logger exists (`main.ts`, similar entrypoints).
- Logging `ZodError` validation failures where field paths matter (nested config objects like `google.apiKey` in `configSchema` at `src/composition/config.ts:19-29`).
- Any call to `createLogger` methods with structured context — always use a plain object for `extra`.

## Examples

### Readable Zod issue mapping (in `loadConfig` or inline in `main.ts` catch)

```typescript
// From src/composition/config.ts:47-50
const errors = (error as z.ZodError).issues.map(issue => ({
  field: issue.path.join('.'),
  message: issue.message
}));
```

Missing `GOOGLE_API_KEY` yields a message like `google.apiKey: Required` (path from `issue.path.join('.')`, message from Zod).

### Structured bootstrap log (recommended shape when logging issues directly)

```typescript
import { z } from 'zod';

} catch (error) {
  const bootstrap = createLogger('error');
  if (error instanceof z.ZodError) {
    bootstrap.error('load config failed', {
      errors: error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message
      }))
    });
  } else {
    bootstrap.error('load config failed', { error: (error as Error).message });
  }
  process.exit(1);
}
```

Emits a Pino JSON line on stdout like:

```json
{"level":50,"time":...,"pid":...,"hostname":...,"msg":"load config failed","errors":[{"field":"google.apiKey","message":"Required"}]}
```

### Current shipped behavior

`main.ts` logs the thrown `Error.message` string (which already contains joined field paths from `loadConfig`) via `{ error: (error as Error).message }` (`src/main.ts:13`). That satisfies the silent-exit fix; switching to `{ errors: [...] }` in the log object is optional enrichment.

## What Didn't Work

| Approach | Why it failed |
|----------|----------------|
| **Zod `.format()`** | Produces nested `_errors` objects, e.g. `{"_errors":[],"google":{"_errors":[],"apiKey":{"_errors":["Required"]}}}` — unreadable in one-line JSON log output. |
| **Zod `.flatten()`** | Flatter shape but loses full dotted paths; nested field `google.apiKey` may surface only under `google`. |
| **Callback as `logger.error` 2nd arg** | `Logger.error` expects `Record<string, unknown>`, not `(error) => ({...})` — TypeScript rejects it. |
| **Raw array as `logger.error` 2nd arg** | Arrays are not `Record<string, unknown>` — must wrap as `{ errors }`. |
| **`formatConfigLoadError` helper in `config.ts`** | Mixes bootstrap logging concerns into config loading; preference is inline handling in `main.ts` catch. |
| **`createLogger(config.log.level)` in catch** | `config` is undefined when `loadConfig()` throws — use `createLogger('error')` instead. |

## Related

- [Express HTTP adapter over Fastify (hexagonal)](../tooling-decisions/express-http-adapter-over-fastify-hexagonal.md) — tangential overlap on Zod at route boundary and logger wiring in tests; does not cover config bootstrap logging.
- `src/main.ts:5-15` — bootstrap try/catch and exit
- `src/composition/config.ts:32-52` — Zod parse and issue-to-message mapping
- `src/shared/logging/logger.ts` — `Logger` type, `createLogger`, and Pino-backed `extra` cloning
