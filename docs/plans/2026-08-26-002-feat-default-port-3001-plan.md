---
title: "Change default listen port to 3001"
date: 2026-08-26
type: feat
topic: default-port-3001
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# Change default listen port to 3001

## Goal Capsule

**Objective:** Make the process default listen port **3001** when `PORT` is unset, and restate living caller docs and the env example so local how-to-run matches that default.

**Product authority:** This plan's Product Contract. After the pass, `src/composition/config.ts` plus living docs win. Snapshot plans under `docs/plans/` stay history.

**Open blockers:** None.

**Execution profile:** Small config default plus living-doc restatement. `execution: code` means `ce-work` may edit files in this repo. Do not add, expand, or rewrite tests. Prove with `npm run typecheck` and existing `npm test`.

**Stop if:** Scope expands into `HOST` binding, Docker/CI, rewriting snapshot plans, or changing HTTP timeouts (including `DEFAULT_GET_TIMEOUT_MS = 3000`).

**Product Contract preservation:** Product Contract created in this bootstrap (no upstream brainstorm).

## Product Contract

### Summary

When `PORT` is absent, `loadConfig` yields listen port 3001. Living operator docs and `.env.example` show that default. Set `PORT` still overrides. Historical plan snapshots that recorded 3000 stay as written.

### Problem Frame

The Zod loader falls back to 3000. README curls, `docs/api.md` Servers and `Host` examples, and `.env.example` still teach that number. Local callers following living docs hit the wrong default after the code change unless those files move together.

### Key Decisions

- **Default is 3001** — (session-settled: user-directed — chosen over keeping 3000: the request is to change the unset-`PORT` fallback) Governs R1, R2.
- **Living docs and examples only** — (session-settled: user-directed — chosen over rewriting historical plan files that mention port 3000 as a past decision) Governs R3, R4, R5.
- **`PORT` env still overrides** — Governs R2.
- **Millisecond 3000 values are not ports** — Governs R6.

### Actors

- A1. Local operator running `npm run dev` and curling the service.
- A2. Implementer following living docs for the listen URL.

### Requirements

- R1. Unset `PORT` makes `loadConfig` produce `config.server.port` **3001**.
- R2. A present numeric `PORT` still becomes `config.server.port`; invalid values still fail Zod (positive integer).
- R3. `.env.example` uses `PORT=3001`.
- R4. `README.md` base URL and curl examples use `127.0.0.1:3001` for the default.
- R5. `docs/api.md` Servers row and example `Host` lines document default `PORT` **3001**.
- R6. HTTP timeouts and other millisecond `3000` constants stay unchanged.
- R7. `src/main.ts` keeps listening on `config.server.port` with no extra default.

### Acceptance Examples

- AE1. `loadConfig` with no `PORT` key yields `server.port === 3001`. Covers R1.
- AE2. `loadConfig({ PORT: "4000" })` yields `server.port === 4000`. Covers R2.
- AE3. README health curl uses `http://127.0.0.1:3001/health`. Covers R4.
- AE4. `docs/api.md` Servers notes default `PORT` is **3001**. Covers R5.

### Success Criteria

An operator who copies `.env.example` (or omits `PORT`) and follows README curls talks to the process on **3001**. Snapshot plans still mention 3000 where they recorded the old default.

### Scope Boundaries

**In scope:** `loadConfig` numeric fallback, `.env.example`, `README.md`, `docs/api.md` Servers and Host examples.

**Out of scope:** `HOST` listen address, Docker/K8s/CI, Google env keys, inbound JSON fields.

**Deferred to Follow-Up Work:** None.

**Snapshots (leave written):** `docs/plans/**` including nested-config AE1 `port=3000` and the OpenAPI plan's default-3000 notes. `docs/solutions/**`. Health GET **3000ms** timeout in `src/shared/client/client.ts`.

## Planning Contract

### Key Technical Decisions

- KTD1. **Change only the `??` fallback in `loadConfig`.** `port: Number(env.PORT ?? 3001)` then existing Zod `.positive()`. Do not add a second default in `main.ts`. Cites R1, R7.
- KTD2. **Restate living caller docs in the same change as the default.** `docs/api.md` owns the Servers row; README owns how-to-run curls; `.env.example` is the operator template. Do not add a numeric default to `docs/architecture.md` (it names `PORT` without a number). (session-settled: user-directed — living docs only, chosen over rewriting `docs/plans/`) Cites R3, R4, R5.
- KTD3. **Do not add tests for this pass.** No `tests/` files pin `3000` today. AGENTS.md forbids creating tests unless the user asked. Cites verification via typecheck and existing test suite.

### Assumptions

- An existing gitignored `.env` with `PORT=3000` will keep binding 3000 until the operator edits or unsets it. That is override behavior (R2), not a failed default.
- `docs/architecture.md` and `AGENTS.md` need no edit unless a later read finds a numeric 3000 (research found none).

### Implementation Constraints

- Ban `process.env` outside `src/composition/config.ts`.
- Do not log request bodies; do not add outbound ports, persistence, or deploy tooling.
- CONCEPTS **Living docs** vs **Snapshot**: composition plus living docs win; do not "correct" plan history.

### Sequencing

U1 (config default) then U2 (living docs and `.env.example`). Same change; U2 must not ship without U1.

### Sources & Research

- Default: `src/composition/config.ts` (`env.PORT ?? 3000`).
- Listen: `src/main.ts` `app.listen(config.server.port)`.
- Living callers: `README.md`, `docs/api.md` Servers and `Host: 127.0.0.1:3000`.
- Operator template: `.env.example`.
- Must not touch: `src/shared/client/client.ts` `DEFAULT_GET_TIMEOUT_MS = 3000`.
- Learnings: `docs/solutions/documentation-gaps/living-docs-hexagonal-slices.md`, `docs/solutions/documentation-gaps/live-http-fields-owned-by-docs-api.md`.
- External research: skipped (local pattern is the single fallback plus living docs).

## Implementation Units

### U1. Default port in loadConfig

**Goal:** Unset `PORT` yields `config.server.port` 3001.

**Requirements:** R1, R2, R6, R7

**Dependencies:** None

**Files:** `src/composition/config.ts`

**Approach:**

1. Replace the numeric fallback `3000` with `3001` on `env.PORT ?? …` only.
2. Leave Zod `.int().positive()`, Google required keys, and `main.ts` listen wiring unchanged.

**Patterns to follow:** Nested `Config.server.port` from flat `PORT` in `loadConfig`.

**Test scenarios:** Test expectation: none -- no existing tests pin the default; do not add test files (KTD3).

**Verification:** The fallback literal in `loadConfig` is 3001. `DEFAULT_GET_TIMEOUT_MS` is still 3000. `npm run typecheck` and `npm test` pass.

### U2. Restate living caller docs and env example

**Goal:** How-to-run and API Servers match default 3001.

**Requirements:** R3, R4, R5; Covers AE3, AE4

**Dependencies:** U1

**Files:** `.env.example`, `README.md`, `docs/api.md`

**Approach:**

1. Set `.env.example` `PORT=3001`.
2. Update README base URL and the three curl URLs from `:3000` to `:3001`.
3. Update `docs/api.md` Servers default note and both example `Host:` lines to 3001.
4. Do not rewrite `docs/plans/` or `docs/solutions/`.

**Patterns to follow:** CONCEPTS Living docs; `docs/api.md` Servers as the documented listen URL; README as how-to-run with a link to the API file.

**Execution note:** This is packaging/docs alignment; prefer a cold read of living files over new unit coverage.

**Test scenarios:** Test expectation: none -- documentation and env template only.

**Verification:** Grep of living paths (`README.md`, `docs/api.md`, `.env.example`, `src/composition/config.ts`) shows default listen **3001**, not **3000**. Grep of `src/shared/client` still shows timeout 3000. Snapshot plans under `docs/plans/` still contain historical 3000 where they did before.

## Verification Contract

- `npm run typecheck`
- `npm test` (existing suite; do not add tests)
- Cold read: README curls, `docs/api.md` Servers and Host examples, `.env.example`, and `loadConfig` fallback all say 3001
- Negative: `src/shared/client/client.ts` timeout unchanged; `docs/plans/` not edited

## Definition of Done

- R1–R7 satisfied
- U1 and U2 complete
- No new test files
- No HOST, CI, Docker, or timeout changes
- Abandoned-attempt edits are not left in the diff
