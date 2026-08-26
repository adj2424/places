---
title: Change listen-port default only in loadConfig fallback and living caller docs
date: 2026-08-26
category: conventions
module: composition
problem_type: convention
component: development_workflow
severity: low
applies_when:
  - "Changing the process default listen port when PORT is unset"
  - "Updating loadConfig PORT fallback and living caller examples"
  - "Deciding whether docs/plans snapshots or HTTP timeout 3000 constants should change"
  - "A leftover gitignored .env still binds the previous PORT"
tags:
  - port
  - loadconfig
  - living-docs
  - snapshot
  - env
  - composition
related_components:
  - documentation
  - tooling
resolution_type: config_change
---

# Change listen-port default only in loadConfig fallback and living caller docs

## Context

The process listen port is not a second magic number in `src/main.ts`. Process entry calls `app.listen(config.server.port, …)` (`src/main.ts:20`) with no fallback. The only unset-`PORT` default is `loadConfig`: `port: Number(env.PORT ?? 3001)` (`src/composition/config.ts:38`), then Zod `z.coerce.number().int().positive()` (`src/composition/config.ts:22`).

This work is **pending on the local tree as of 2026-08-26**, uncommitted on `main`. Historical snapshots under `docs/plans/` still record the old default (for example nested-config AE1 `port=3000`). Those files are snapshots, not the operating contract.

Living callers were restated in the same change so how-to-run matches the new fallback: `.env.example` is `PORT=3001`; README base URL and curls use `127.0.0.1:3001` (`README.md:20`, `:32`, `:52`, `:60`); `docs/api.md` Servers and example `Host` lines document default **3001** (`docs/api.md:21`, `:52`, `:125`). `docs/architecture.md` names `PORT` among env fields and does not publish a numeric default (`docs/architecture.md:69`).

A gitignored `.env` that still has `PORT=3000` continues to bind 3000. That is override behavior (`env.PORT` present), not a failed default. (session history) The plan session flagged this leftover-`.env` caveat as expected R2 override, not a failed default. No tests were added; `AGENTS.md` forbids creating, expanding, or rewriting tests unless the user asked.

## Guidance

Change **only** the `??` fallback in `loadConfig`. Do not add a second default in `main.ts`. Restate living caller docs in the same change: `.env.example`, README how-to-run curls, and `docs/api.md` Servers plus example `Host` lines. Do not rewrite snapshot plans under `docs/plans/` to “correct” 3000. Do not invent a numeric default in `docs/architecture.md` when it only names `PORT`.

Treat millisecond `3000` as a timeout, not a port. `DEFAULT_GET_TIMEOUT_MS = 3000` in `src/shared/client/client.ts:16` is the GET abort default (`options.timeoutMs ?? DEFAULT_GET_TIMEOUT_MS` at `src/shared/client/client.ts:30`). Leave it unchanged when moving the listen port.

If an operator already has `PORT` set, the new fallback never runs. Unset or edit that env to pick up 3001.

## Why This Matters

Callers who copy `.env.example` or omit `PORT` and follow README curls talk to whatever `loadConfig` actually yields. Moving the fallback without restating living docs leaves a silent mismatch: the process listens on 3001 while curls still hit 3000 (or the reverse). Rewriting snapshot plans would erase the historical record and violate Living docs vs Snapshot: composition plus living docs win; snapshots stay as written.

A repo-wide replace of `3000` → `3001` would also retarget HTTP timeouts. That is a different constant with a different unit.

## When to Apply

- Changing the unset-`PORT` listen default in `loadConfig`.
- Restating operator examples after that default moves (README, `docs/api.md`, `.env.example`).
- Deciding whether a `3000` in the tree is a port, a plan snapshot, or a millisecond timeout.
- Explaining why a local `.env` still binds 3000 after the fallback change.

## Examples

**Fallback (before → after, local tree).** Before: `Number(env.PORT ?? 3000)`. After, current tree:

```ts
port: Number(env.PORT ?? 3001)
```

(`src/composition/config.ts:38`)

**Wrong grep “fix”.** A search that treats every `3000` as the old listen port would also hit `const DEFAULT_GET_TIMEOUT_MS = 3000` (`src/shared/client/client.ts:16`) and health GET timeout notes in snapshot plans. Those are milliseconds. Do not change them when changing `PORT`.

## Related

- [Keep living docs aligned with hexagonal slices](../documentation-gaps/living-docs-hexagonal-slices.md) — Living vs Snapshot for layout; leave `docs/plans/` as history.
- [Restate logger living docs when code diverges](../documentation-gaps/restate-logger-living-docs-when-code-diverges.md) — same restatement vs snapshot rule, logger product rather than listen port.
- [Own live HTTP fields in docs/api.md](../documentation-gaps/live-http-fields-owned-by-docs-api.md) — `docs/api.md` owns request/response JSON; Servers/Host examples may mention default `PORT`, but bind defaults still live in `loadConfig` / `.env.example` / README.
- [Bootstrap error logger for config load failures](../developer-experience/config-load-error-logging.md) — same `loadConfig` surface; Zod failure logging, not the PORT fallback.
- [CONCEPTS.md](../../../CONCEPTS.md) — Living docs vs Snapshot.
