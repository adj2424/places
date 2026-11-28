---
title: Scrollable Search Results - Plan
date: 2026-08-26
type: feat
topic: scrollable-search-results
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# Scrollable Search Results - Plan

## Goal Capsule

- **Objective:** Cap the nearby-explorer results list so a short list stays compact and a long list scrolls inside the panel instead of stretching the page.
- **Product authority:** This plan's Product Contract. Layout lives in `src/App.css`; markup lives in `src/results/PlaceList.tsx`.
- **Open blockers:** None.
- **Execution profile:** CSS-first. Drop the results `min-height`. Put a max-height on the results panel and overflow on the place-card list so the heading and count stay visible. Prove compact vs overflowing lists in the running app. Keep existing PlaceList unit tests green.
- **Stop if:** Pagination, virtualized rows, map height changes, Places API changes, or a new scroll library.
- **Product Contract preservation:** Product Contract authored in this plan (`ce-plan-bootstrap`).

## Product Contract

### Summary

The results panel grows with its content until a max height, then extra places scroll inside the list. Short searches stay compact. The Results heading and count stay visible while the cards scroll.

### Problem Frame

Nearby explorer already lists every place from `POST /find-places` in `PlaceList`, beside the search-area map. `.place-list` uses `min-height: 22rem` and has no max-height, so a large result set grows the page and pushes later places far below the map. A short list still occupies that 22rem empty stretch.

The owner wants the list to stay small when there are few places, and to stop growing at a predefined height when there are many, with the extra places reached by scrolling.

### Key Decisions

- **Grow until a max height, then scroll.** (session-settled: user-directed — chosen over always occupying the full predefined height: short lists should stay compact) Governs R1, R2, R5.
- **Heading and count stay visible while cards scroll.** Governs R4.

### Actors

- A1. Local explorer — the service owner in the browser, browsing search results.

### Requirements

**Sizing**

- R1. A short result list sizes to its content. The panel must not keep a large empty min-height when there are few or no place cards.
- R2. When the place cards would exceed the cap, the list stops growing and extra places are reached by scrolling inside the results panel.
- R3. Every place returned by the last successful search remains reachable. Do not truncate, paginate, or virtualize.

**Chrome**

- R4. The Results heading and the result count stay visible while the place cards scroll.
- R5. Idle, loading, error, and empty-success states stay compact. They do not inherit a tall empty panel.

### Key Flows

- F1. Few places
  - **Trigger:** A successful search returns a small place list.
  - **Actors:** A1
  - **Steps:** A1 searches. The results panel shows heading, count, and all cards without an internal scrollbar.
  - **Outcome:** The panel is only as tall as that content.
  - **Covered by:** R1, R3
- F2. Many places
  - **Trigger:** A successful search returns more cards than fit in the cap.
  - **Actors:** A1
  - **Steps:** A1 searches. The panel hits the cap. A1 scrolls the card list. Heading and count stay in view.
  - **Outcome:** Later cards are reachable without growing the page.
  - **Covered by:** R2, R3, R4
- F3. Non-list states
  - **Trigger:** Idle, loading, error, or empty success.
  - **Actors:** A1
  - **Steps:** The panel shows heading plus status copy. There is no card list to scroll.
  - **Outcome:** The panel stays compact.
  - **Covered by:** R5

### Acceptance Examples

- AE1. Covers R1 / F1. Given a successful search with two places, when the results panel renders, then both cards are visible without scrolling the list, and the panel is shorter than the overflow cap.
- AE2. Covers R2, R4 / F2. Given a successful search with enough places to exceed the cap, when A1 views results, then the panel does not grow past the cap, the heading and count remain visible, and A1 can scroll to the last card.
- AE3. Covers R5 / F3. Given idle, loading, error, or empty success, when that state renders, then the panel is compact and has no internal card scrollbar.
- AE4. Covers R3. Given a long overflowing list, when A1 scrolls to the end, then every returned place is still present. None are dropped to make the panel fit.

### Success Criteria

- Short lists do not leave a tall empty results column.
- Long lists no longer stretch the page past the cap.
- Heading and count remain readable while scrolling cards.
- Existing PlaceList behavior (sparse rows, tel/maps links, loading clears previous rows) is unchanged.

### Scope Boundaries

- In: results panel height and overflow for the existing PlaceList states.
- Out: map canvas height, search form, find-places client, pagination, virtualization, new dependencies.
- Deferred to follow-up: matching the two columns to a shared explicit height token beyond reusing the map canvas rem values already in `src/App.css`.

## Planning Contract

### Key Technical Decisions

- KTD1. **Max-height, not fixed height.** The results panel uses `max-height` so short content shrinks. (session-settled: user-directed — chosen over always occupying the full predefined height: short lists stay compact) Instantiates R1, R2, R5.
- KTD2. **Overflow on the card list, not the section.** Put `overflow: auto` on `.place-list ul` (or a new `.place-list__*` wrapper around that `ul`). Do not overflow `.place-list` itself, and do not use sticky on `h2`. Instantiates R4. Existing success markup is already `h2` + `.place-list__meta` + `ul`.
- KTD3. **Remove `.place-list { min-height: 22rem }`.** That rule is what keeps idle, loading, and one-result panels tall. Compact-when-few cannot land while it remains. Instantiates R1, R5.
- KTD4. **Cap with the map canvas rem values.** Use `28rem` by default and `18rem` at `max-width: 800px`, the same tokens as `.search-area-map__canvas`. Apply the cap to the scrollable list, not as a copy of the old `22rem` min-height. The grid already uses `align-items: start`, so columns need not be equal height. Instantiates R2.

### Assumptions

None. Scope was confirmed before research. The heading-stays-visible default was confirmed with the rest of the scope.

### Implementation Constraints

- Layout CSS lives in `src/App.css`. There are no CSS modules or per-component stylesheets.
- Follow existing BEM: `.place-list`, `.place-list__meta`. A scroll wrapper, if added, is `.place-list__*`.
- Do not reuse `.search-area-map { overflow: hidden }` (Leaflet clip) or `.visually-hidden { overflow: hidden }`.
- Vitest + jsdom (`npm test`) cannot prove overflow. Do not add computed-style assertions as the proof for R2.

### Sequencing

U1 is the only unit. CSS can land without an App or map change. Touch `PlaceList.tsx` only if a BEM wrapper is required for KTD2.

## Implementation Units

### U1. Compact-then-scroll results panel

- **Goal:** Short PlaceList states shrink to content. Long card lists cap and scroll while heading and count stay visible.
- **Requirements:** R1, R2, R3, R4, R5. KTD1, KTD2, KTD3, KTD4. F1, F2, F3. AE1–AE4.
- **Dependencies:** None.
- **Files:** `src/App.css`, `src/results/PlaceList.tsx` (only if a BEM wrapper is needed), `src/results/PlaceList.test.tsx`
- **Approach:**
  1. Remove `.place-list { min-height: 22rem }` (KTD3).
  2. Set `max-height` on the card list to `28rem`, and `18rem` inside the existing `@media (max-width: 800px)` block (KTD1, KTD4).
  3. Set `overflow: auto` on that same list, not on `.place-list` (KTD2).
  4. Keep idle, loading, error, and empty branches without a `ul` so they stay compact after the min-height is gone (R5).
  5. Do not change how many places are rendered (R3).
- **Execution note:** This is mostly CSS. Prefer browser smoke for overflow over jsdom style assertions.
- **Patterns to follow:** `src/App.css` PlaceList and map canvas rules. Existing `PlaceList` success structure (`h2`, meta, `ul`).
- **Test scenarios:**
  - Existing PlaceList tests still pass: sparse row, tel href, maps href, total copy, loading clears previous rows.
  - Covers AE1. Two place cards: heading, count, and both cards are in the document. No truncation.
  - Covers AE4. A long list still renders every `places` item. Length matches the input array.
  - Do not assert computed `max-height` or `overflow` in jsdom.
- **Verification:** `npm test` stays green. In `npm run dev`, a 1–2 place search stays compact (AE1). A large search caps the list, keeps heading and count visible, and scrolls to the last card (AE2). Idle, loading, error, and empty stay compact (AE3). Repeat at a viewport under 800px for the 18rem cap.

## Verification Contract

| Gate | Command / check | Proves |
|------|-----------------|--------|
| Unit tests | `npm test` | Existing PlaceList contract still holds; all places still render |
| Types | `npm run build` | CSS-only change still compiles |
| Lint | `npm run lint` | ESLint clean |
| Smoke few places | Running Vite app, 1–2 results | Compact panel, no list scrollbar (AE1) |
| Smoke many places | Running Vite app, enough results to overflow | Cap, heading and count visible, last card reachable by scroll (AE2, AE4) |
| Smoke other states | Idle, in-flight search, failed search, empty 200 | Compact panel, no card scrollbar (AE3) |
| Smoke narrow | Viewport under 800px with many results | 18rem cap still scrolls |

Sibling Places (`../places` `npm run dev`) is required for live smokes. It is not a frontend CI job.

## Definition of Done

- U1 meets its Verification.
- AE1–AE4 are covered by tests or named smoke checks.
- `.place-list` no longer has `min-height: 22rem`.
- No pagination, virtualization, map edits, or API edits.
- Abandoned-attempt wrappers or unused overflow classes are not left in the tree.

## Sources & Research

- Current results chrome: `src/App.css` (`.place-list` min-height 22rem, no max-height; `.search-area-map__canvas` 28rem / 18rem).
- Results markup: `src/results/PlaceList.tsx` (heading and count sit above `ul` only in the success-with-places branch).
- Tests: `src/results/PlaceList.test.tsx` (RTL role/text/href only; jsdom environment in `vite.config.ts`).
- Origin layout intent: `docs/plans/2026-08-26-001-feat-nearby-explorer-plan.md` U5 (map and list side by side; no results-list height cap).
