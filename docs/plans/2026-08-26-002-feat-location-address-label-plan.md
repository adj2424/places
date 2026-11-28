---
title: Location Mode Address Label - Plan
date: 2026-08-26
type: feat
topic: location-address-label
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# Location Mode Address Label - Plan

## Goal Capsule

- **Objective:** When current location is selected, the address field shows `Your Location` and stays uneditable until the user switches back to address.
- **Product authority:** This plan's Product Contract. Nearby-explorer XOR, map, and results stay as they are.
- **Open blockers:** None.
- **Execution profile:** Overlay the label in the search form. Keep typed address in state. Prove overlay, restore, and no-leak with Vitest. Smoke the mode toggle in the running app.
- **Stop if:** `Your Location` is written into address state, sent as `FindPlacesRequest.address`, or used as the map geocode string.
- **Product Contract preservation:** n/a — `ce-plan-bootstrap`.

## Product Contract

### Summary

When current location is the search origin, the address field shows `Your Location`, looks unused, and cannot be edited until the user switches back to address. Switching back restores the previous typed address. Search request XOR, map, and results do not change.

### Problem Frame

The explorer already uses one origin per search: a typed address or current location. Current location disables the address field and omits it from the request. The field still shows leftover typed text in heading color, so it still looks like the origin.

### Key Decisions

- **Show `Your Location` in the address field while current location is selected.** (session-settled: user-directed — chosen over muted leftover text, clearing the field, or hiding it: leftover text looked like the origin) Governs R1, R2, R3.

### Actors

- A1. Local explorer — the only human user.
- A2. Places service — unchanged `POST /find-places` XOR body.
- A3. Device geolocation — supplies coordinates for current-location search.

### Requirements

**Location-mode address field**

- R1. While current location is selected, the address field displays the exact string `Your Location`, including when the typed address is empty.
- R2. While current location is selected, the address field is disabled. A1 cannot edit it until they switch to address mode.
- R3. Switching back to address restores the previous typed address, including empty, and makes the field editable again.

**No leak**

- R4. `Your Location` is never stored as the typed address and is never sent as `FindPlacesRequest.address`.
- R5. Current-location submit still sends coordinates only. Map and results stay on the existing nearby-explorer contract.

### Key Flows

- F1. Switch to current location with leftover address
  - **Trigger:** A1 has typed an address, then selects current location.
  - **Actors:** A1
  - **Steps:** Mode becomes current location → field shows `Your Location` and is disabled.
  - **Outcome:** A1 can tell the typed address is not the origin.
  - **Covered by:** R1, R2

- F2. Switch back to address
  - **Trigger:** A1 is in current-location mode and selects address.
  - **Actors:** A1
  - **Steps:** Mode becomes address → prior typed value returns → field is editable.
  - **Outcome:** A1 can edit and submit that address again.
  - **Covered by:** R3, R4

- F3. Current-location search
  - **Trigger:** A1 submits while current location is selected.
  - **Actors:** A1, A3, A2
  - **Steps:** Read geolocation → build a coordinates body with no `address` key.
  - **Outcome:** The displayed `Your Location` string is not the request origin.
  - **Covered by:** R4, R5

### Acceptance Examples

- AE1. Leftover address is replaced
  - **Covers R1, R2.**
  - **Given:** The address field contains `12 Main St`.
  - **When:** A1 selects current location.
  - **Then:** The field shows `Your Location` and is disabled.

- AE2. Prior address restores
  - **Covers R3, R4.**
  - **Given:** AE1 has happened.
  - **When:** A1 selects address mode.
  - **Then:** The field shows `12 Main St`, is editable, and does not show `Your Location`.

- AE3. Empty typed address still labels location mode
  - **Covers R1.**
  - **Given:** The address field is empty.
  - **When:** A1 selects current location.
  - **Then:** The field shows `Your Location`.

- AE4. Geolocation denial does not submit the label
  - **Covers R4.**
  - **Given:** Current location is selected and a prior typed address exists.
  - **When:** Geolocation fails and the form falls back to address mode.
  - **Then:** The field shows the prior typed address, not `Your Location`.

- AE5. Location submit omits address
  - **Covers R5.**
  - **Given:** Current location is selected and a prior typed address exists.
  - **When:** A1 submits a successful location search.
  - **Then:** The body has lat/lng and no `address` key.

### Success Criteria

- A1 can switch to current location and immediately see `Your Location` instead of leftover typed text.
- Switching back restores the typed address.
- No search or map geocode uses `Your Location` as an address.

### Scope Boundaries

**In scope**

- Address-field display and disabled state while current location is selected.
- Component tests for overlay, restore, and no-leak.

**Out of scope**

- Changing `buildFindPlacesBody` XOR rules.
- Map, results list, radius, or categories.
- Persisting address across reloads.

**Deferred to Follow-Up Work**

- Playwright or other browser E2E.

## Planning Contract

### Key Technical Decisions

- KTD1. **Overlay the label; do not mutate address state.** Render `Your Location` as the input `value` only while mode is location. Keep typed text in `address`. `chooseMode` must not call `setAddress('Your Location')`. (session-settled: user-directed — chosen over muted leftover text, clearing, or hiding: overlay is the how that keeps R3 restore free and blocks R4 leak on geolocation fallback) Governs R1, R3, R4.
- KTD2. **Muted disabled styles on search-form text and number inputs.** Location-mode `Your Location` uses heading color today, so the substitution still looks active. Style `:disabled` with `var(--muted)` and a quieter background. Covers R2.

### Assumptions

None. Confirmed scope includes the `Your Location` substitution, disabled editing, and restore on switch-back.

### Implementation Constraints

- Follow `src/results/PlaceList.test.tsx`: Vitest, `jsdom`, `render`/`screen` from `@testing-library/react`. Use `fireEvent`. Do not add `@testing-library/user-event`.
- Do not change `src/search/search-request.ts`. Existing `src/search/search-request.test.ts` already proves location bodies omit `address`.
- Do not change `src/App.tsx` search/geocode routing. Address-mode geocode reads `body.address`; leaking the label would Nominatim-search `Your Location`.

### Sequencing

U1 first (behavior and tests). U2 can land in the same change set; it only styles the disabled field U1 already sets.

## Implementation Units

### U1. Location-mode address overlay

- **Goal:** Current-location mode shows `Your Location` in the address field without storing or submitting that string.
- **Requirements:** R1, R2, R3, R4, R5. KTD1.
- **Dependencies:** None.
- **Files:**
  - `src/search/SearchForm.tsx` (modify)
  - `src/search/SearchForm.test.tsx` (create)
- **Approach:**
  1. Keep `address` as typed text only.
  2. Bind the address input value to `Your Location` when mode is location, else `address`.
  3. Keep the field disabled when mode is not address.
  4. Leave geolocation fallback as `setMode('address')` with no address rewrite.
- **Execution note:** Start with a failing component test for AE1 and AE2.
- **Patterns to follow:** `src/search/SearchForm.tsx` `chooseMode` / `disabled={disabled || mode !== 'address'}`. `src/results/PlaceList.test.tsx` for RTL style. `src/search/search-request.test.ts` for the XOR body contract U1 must not break.
- **Test scenarios:**
  - Covers AE1. Address contains `12 Main St`; select current location; field value is `Your Location` and the input is disabled.
  - Covers AE2. After AE1, select address; field value is `12 Main St`, enabled, and not `Your Location`.
  - Covers AE3. Empty address; select current location; field value is `Your Location`.
  - Covers AE4. Mock `getCurrentPosition` failure after a leftover address; fallback shows the leftover address, not `Your Location`.
  - Covers AE5. Mock a successful `getCurrentPosition`; `onSubmitSearch` body has lat/lng and no `address` key.
  - Location radio disabled when geolocation is unavailable still does not write `Your Location` into address state.
- **Verification:** `npm test` includes the new SearchForm cases. Switching modes in the running app matches AE1 and AE2.

### U2. Disabled field unused appearance

- **Goal:** The disabled address field looks unused, not like an active origin.
- **Requirements:** R2. KTD2.
- **Dependencies:** U1.
- **Files:**
  - `src/App.css` (modify)
- **Approach:** Add `:disabled` styles on `.search-form__row` text and number inputs using `var(--muted)` and a quieter background than `var(--bg)`. Radius stays covered because it shares those selectors.
- **Patterns to follow:** Existing `--muted` token in `src/index.css`. Submit-button `:disabled` opacity in `src/App.css` as the only current disabled pattern.
- **Test scenarios:**
  - Test expectation: none -- visual styling. U1 already asserts the field is disabled and shows `Your Location`.
- **Verification:** In the running app, current-location mode shows muted `Your Location`. Address mode keeps heading-color editable text.

## Verification Contract

| Check | Command or method | Proves |
|---|---|---|
| Unit tests | `npm test` | U1 overlay, restore, geolocation fallback, location body has no `address` |
| Existing XOR tests | `npm test` (`src/search/search-request.test.ts`) | Location bodies still omit `address` |
| Smoke mode toggle | Run the app, type an address, select current location, switch back | AE1 and AE2 in the real form |

## Definition of Done

- R1–R5 hold in the form and in `npm test`.
- `Your Location` is not in address state, request bodies, or map geocode.
- `src/search/search-request.ts`, map, and results are unchanged.
- Abandoned experiments are not left in the diff.

## Appendix

Related nearby-explorer contract: `docs/plans/2026-08-26-001-feat-nearby-explorer-plan.md` (XOR origin, address vs current location). This plan does not amend that file.
