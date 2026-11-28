---
title: Dev Port Defaults - Plan
date: 2026-08-26
type: feat
topic: dev-port-defaults
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# Dev Port Defaults - Plan

## Goal Capsule

- **Objective:** Make this app’s Vite origin `http://127.0.0.1:3000` and the Places client default `http://127.0.0.1:3001`, and align living run docs and tests.
- **Product authority:** This plan’s Product Contract.
- **Open blockers:** None.
- **Execution profile:** Config + one client constant + one test assertion + README. Smoke `npm run dev` for the Vite origin.
- **Stop if:** Sibling Places repo edits, Vite proxy, historical `docs/plans/` rewrites, or `vite preview` port changes.
- **Product Contract preservation:** n/a — `ce-plan-bootstrap`.

## Product Contract

### Summary

The explorer will listen on port 3000 in local dev. It will call Places at port 3001 by default. README and the client test will match those defaults so a CORS plugin and a sibling Places process can be aimed at the right pair.

### Problem Frame

Vite currently binds 5173 with no `server` block. The client and README still treat Places as `http://127.0.0.1:3000`. Putting Vite on 3000 without moving the Places default would collide on one machine. The operator asked for Vite 3000 and Places 3001 in this frontend, without changing the sibling repo or old plan write-ups.

### Key Decisions

- **Vite 3000, Places client 3001.** (session-settled: user-directed — chosen over keeping Vite 5173 or Places 3000: same-port clash) Governs R1, R2, R3.
- **This frontend only; living docs only.** (session-settled: user-directed — chosen over editing sibling Places or rewriting historical plans) Governs R4, R5.
- **Keep direct `fetch` and a CORS plugin.** Governs R6.

### Actors

- A1. Local operator — runs Places and this SPA, enables a localhost CORS plugin.
- A2. Places service — `POST /find-places` on whatever port it actually listens on.

### Requirements

**Defaults**

- R1. `npm run dev` binds port 3000. If 3000 is already taken, the process fails instead of silently moving, so README’s origin stays true.
- R2. With no `VITE_PLACES_BASE_URL`, Places requests go to `http://127.0.0.1:3001/find-places`.
- R3. `VITE_PLACES_BASE_URL` still overrides the default when set and non-empty.

**Docs and tests**

- R4. README’s run steps, CORS example, and optional env note use Vite 3000 and Places 3001. README tells A1 to start the sibling Places process on 3001 (its code default may still be 3000).
- R5. Do not rewrite `docs/plans/` or other snapshot docs. Do not edit the sibling Places repo.
- R6. Do not add a Vite proxy. CORS plugin remains required: origin `http://127.0.0.1:3000` to Places `http://127.0.0.1:3001`.

### Key Flows

- F1. Local run with matching ports
  - **Trigger:** A1 follows README.
  - **Actors:** A1, A2
  - **Steps:** Start Places on 3001. Enable CORS for 3000→3001. Start this app. Search `fetch`es `:3001/find-places`.
  - **Outcome:** No EADDRINUSE between the two defaults. Search reachability still depends on CORS, not a proxy.
  - **Covered by:** R1, R2, R4, R6

### Acceptance Examples

- AE1. Covers R2. Given no env override, When `findPlaces` runs, Then `fetch` is called at `http://127.0.0.1:3001/find-places`.
- AE2. Covers R4, R6. Given README, When A1 sets up CORS, Then the documented pair is `http://127.0.0.1:3000` → `http://127.0.0.1:3001`.

### Scope Boundaries

- In: Vite listen port, Places client default URL, `find-places-client` test URL, README.
- Out: Sibling Places listen-port code; historical plans; `vite preview` (stays Vite’s preview default); proxy; search/UI behavior.

### Deferred to Follow-Up Work

- Change sibling Places’ default listen port to 3001 in that repo so `npm run dev` there matches this README without `PORT=3001`.

## Planning Contract

### Key Technical Decisions

- KTD1. **Set `server.port` and `server.strictPort` in `vite.config.ts`.** Instantiates R1. (chosen over `vite --port 3000` in `package.json`: one config object already owns Vite + Vitest)
- KTD2. **Change only `DEFAULT_BASE_URL` in the client.** Instantiates R2, R3. Leave `resolveBaseUrl` and `src/vite-env.d.ts` unchanged.
- KTD3. **README must require `PORT=3001` (or equivalent) for sibling Places.** Instantiates R4. The sibling still defaults to 3000 until a follow-up. `VITE_PLACES_BASE_URL` remains the escape hatch if Places stays on 3000 — then Vite cannot also use 3000.

### Implementation Constraints

- No new dependencies.
- Do not add a `server.proxy` block.
- Product Contract unchanged after bootstrap: n/a.

### Sources & Research

- `vite.config.ts` has no `server` today (implicit 5173). `package.json` `dev` is `vite`.
- `src/places/find-places-client.ts` `DEFAULT_BASE_URL` is `http://127.0.0.1:3000`.
- `src/places/find-places-client.test.ts` asserts that URL.
- `README.md` is the only living run doc that names 5173/3000.
- `docs/solutions/` has no port/CORS learnings.
- External Vite docs were not fetched; `server.port` / `strictPort` follow the existing `defineConfig` pattern.

## Implementation Units

### U1. Vite listen port 3000

- **Goal:** Dev server binds 3000 and fails if that port is taken.
- **Requirements:** R1
- **Dependencies:** None
- **Files:** `vite.config.ts`
- **Approach:** Add `server.port: 3000` and `server.strictPort: true` beside existing `plugins` / `test` per KTD1. Do not add proxy.
- **Patterns to follow:** Current `defineConfig` in `vite.config.ts`.
- **Test scenarios:** Test expectation: none -- listen port is proven by `npm run dev`, not Vitest.
- **Verification:** Dev server reports origin `http://127.0.0.1:3000`. Occupied 3000 does not silently pick another port.
- **Execution note:** Smoke `npm run dev` for this unit.

### U2. Places client default 3001

- **Goal:** Default `fetch` target is port 3001; env override still works.
- **Requirements:** R2, R3. Covers AE1.
- **Dependencies:** None
- **Files:** `src/places/find-places-client.ts`, `src/places/find-places-client.test.ts`
- **Approach:** Update `DEFAULT_BASE_URL` per KTD2. Update the existing default-URL assertion. Do not add a new env-override test unless the current suite already covers it.
- **Patterns to follow:** `resolveBaseUrl` in `src/places/find-places-client.ts`; fetch stub in `src/places/find-places-client.test.ts`.
- **Test scenarios:**
  - Covers AE1. Given no `VITE_PLACES_BASE_URL`, when `findPlaces` is called with a stubbed `fetch`, then the first argument is `http://127.0.0.1:3001/find-places`.
  - Edge: existing success/retryable/invalid cases still pass; only the default URL string changes.
- **Verification:** `npm test` green. Client default and the existing fetch-URL assertion use `http://127.0.0.1:3001`. README still names the old Places URL until U3.

### U3. Living README

- **Goal:** Run instructions match R1–R2 and teach the sibling `PORT` gap.
- **Requirements:** R4, R5, R6. Covers AE2.
- **Dependencies:** U1, U2
- **Files:** `README.md`
- **Approach:** Keep the three-step story (Places, CORS plugin, `npm run dev`). Replace 5173 with 3000 and Places 3000 with 3001. State how to start sibling Places on 3001. Keep the no-proxy sentence and `VITE_PLACES_BASE_URL` note with the new default. Do not edit `docs/plans/`.
- **Patterns to follow:** Current README structure.
- **Test scenarios:** Test expectation: none -- documentation. Check AE2 by reading the CORS line.
- **Verification:** README never cites 5173 or Places-on-3000 as the default pair.

## Verification Contract

- `npm test` — proves AE1 / U2.
- `npm run lint` and `npm run build` — no config regressions.
- `npm run dev` — proves U1 origin 3000.
- Manual CORS + Places-on-3001 — proves F1 if Places is available; if sibling still listens on 3000, expect fetch miss unless env override (per KTD3).

## Definition of Done

- Vite default origin is 3000 with strict port.
- Client default base URL is `http://127.0.0.1:3001`.
- README and the client test match.
- Historical plans unchanged. Sibling Places unchanged.
- No proxy. Abandoned experimental config removed from the diff.
