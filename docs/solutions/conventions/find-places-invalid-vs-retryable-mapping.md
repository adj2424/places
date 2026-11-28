---
title: "Map Places HTTP failures by status, JSON shape, mode, and one type-cap sentence"
date: 2026-08-26
last_updated: 2026-08-26
category: conventions
module: places
problem_type: convention
component: frontend_stimulus
severity: medium
applies_when:
  - "Classifying POST /find-places HTTP misses in the browser client"
  - "Choosing PlaceList copy for invalid vs too-many-types vs retryable vs empty success"
  - "Debugging a gibberish address that still shows retryable copy"
  - "Debugging a type-cap miss that showed address or retryable copy"
  - "Clearing map notice so a Nominatim miss cannot outlive a failed list"
related_components:
  - "development_workflow"
  - "documentation"
tags:
  - "find-places"
  - "invalid-search"
  - "too-many-types"
  - "retryable-failure"
  - "http-400"
  - "http-500-html"
  - "placelist"
  - "error-mapping"
---

# Map Places HTTP failures by status, JSON shape, mode, and one type-cap sentence

## Context

Nearby explorer classifies `POST /find-places` misses in the browser, then maps a small set of kinds onto Results copy. Collapsing every miss into one retryable path hid unusable addresses. Collapsing every address-mode HTTP 400 `{ error: string }` into **Invalid search** hid a second caller-input miss: selected category keys that Places expands past Google’s included-primary-types cap.

Places (sibling service) maps `TooManyPrimaryTypesError` to HTTP **400** with `{ error: error.message }`. The constructor message is the exact sentence `google too many types included in primary types` (`../places/src/places/domain/errors.ts`). That body uses the same JSON *shape* as an unusable-address 400. Treating every address-mode 400 string as invalid made type-cap look like a spelling problem. Treating every coordinates-mode 400 string as retryable made type-cap look like a down service.

`CONCEPTS.md` names three distinct miss concepts plus empty success: **Invalid search**, **Too many types**, and **Retryable failure**. Live client kinds match that split: `'retryable' | 'invalid' | 'too-many-types'` (`src/places/types.ts:35-38`). PlaceList statuses are `idle` / `loading` / `success` / `invalid` / `too-many-types` / `error` (`src/results/PlaceList.tsx:3-9`). Client `'retryable'` is wired to PlaceList `'error'` in `App.tsx` — the UI does not use the string `'retryable'`.

A general classifier on `error` text is unsafe. Status and JSON shape stay the primary gates. The only allowed string match is **exact equality** on that one type-cap sentence. Non-400 responses (including HTML 500) stay `'retryable'` (`src/places/find-places-client.ts:43-45`). Sibling `docs/api.md` may lag live mapper strings; this client matches the live sentence constant, not a stale table and not a substring of HTML.

The search-area map geocode (Nominatim) is independent of Places. A Places failure must not leave the map-miss notice that means “Places succeeded but Nominatim could not place the address.”

Do not copy Places’ category-expansion tables into this app. The form cannot know expanded Google type counts. Catalog keys are a short checkbox list (`src/places/catalog.ts`); the cap is on expanded types after Places processes those keys.

## Guidance

### Four Results outcomes after a submitted search

Keep four user-visible outcomes. Do not overload `'invalid'` or `'error'` for type-cap.

1. **Invalid search** — PlaceList `status === 'invalid'`. Copy: “We couldn’t find that address. Check the spelling and try again.” (`src/results/PlaceList.tsx:43-51`). No Retry control; form submit is the retry.
2. **Too many types** — PlaceList `status === 'too-many-types'`. Copy: “Too many categories selected. Deselect some and search again.” (`src/results/PlaceList.tsx:54-62`). Same panel chrome (`aria-live="assertive"`, `text-danger`) as the other failures. Applies in **both** address and coordinates mode because `failureKind` matches the type-cap sentence **before** it branches on request mode (`src/places/find-places-client.ts:53-59`).
3. **Retryable failure** — PlaceList `status === 'error'`. Copy: “Search couldn’t be completed. Try again in a moment.” (`src/results/PlaceList.tsx:65-73`).
4. **Empty success** — PlaceList `status === 'success'` with `places.length === 0`. Copy: “No places found in this area.” (`src/results/PlaceList.tsx:78-84`). This is not an error.

Do not render Places `error` strings in the UI. PlaceList owns the three failure sentences.

### Classify in `findPlaces` by status, shape, one sentence, then request mode

`failureKind` (`src/places/find-places-client.ts:38-60`) is the only classifier for **non-OK HTTP** responses. Malformed **200** bodies and the outer `fetch` `catch` return `'retryable'` without calling it. For non-OK responses, gate order:

1. HTTP status is exactly `400`. Any other status → `'retryable'` (`:43-45`). HTML **500**, **502**, and other non-400 statuses never reach the string match.
2. JSON payload is a non-null object. Failed `response.json()` becomes `undefined` (`readJson`, `:30-35`); non-object / null → `'retryable'` (`:46-48`).
3. `payload.error` is a **string**. Missing field, arrays (Zod issue lists), numbers → `'retryable'` (`:49-52`).
4. If that string **equals** `TOO_MANY_TYPES_ERROR` (`google too many types included in primary types`, `:9`, `:53-55`) → `'too-many-types'` for **both** request modes. Use `===`. Do not substring, trim, case-fold, or invent aliases.
5. Else if the request is **not** address-mode (`isAddressRequest` at `:26-28`, check at `:56-58`) → `'retryable'`. Other coordinates 400 strings stay retryable.
6. Else → `'invalid'` (`:59`). Other address 400 strings stay invalid.

This is a named exception to “never inspect error text,” not a general classifier.

On `!response.ok`, `findPlaces` returns `{ ok: false, kind: failureKind(...) }` (`:72-74`) and does not pass Places `error` text onward. Malformed **200** bodies (`:77-92`) and the outer `catch` around `fetch` (`:95-97`) are `'retryable'`.

### App wiring: map three kinds; clear map notice on Places failure

After `findPlaces` returns and the request generation is still current (`src/App.tsx:83-86`), a failure path (`:88-100`):

- `result.kind === 'invalid'` → `setStatus('invalid')`
- `result.kind === 'too-many-types'` → `setStatus('too-many-types')`
- else → `setStatus('error')` (covers `'retryable'`)
- always `setPlaces([])`, `setTotal(null)`, `searchFlags.current.placesOk = false`, `setMapNotice(null)`

`MAP_MISS_NOTICE` is shown only when Places succeeded **and** Nominatim missed (`src/App.tsx:12-13`, `:42-49`, `:103-107`). Nominatim does not classify Places failures.

### What not to do

- Do not copy Places PrimaryTypes expansion into this frontend. Handling is after submit, via the 400 sentence Places already computed.
- Do not cap catalog checkboxes at Google’s expanded-type limit to “prevent” the miss; that limit is not checkbox count.
- Do not treat every 400 as invalid. Coordinates-mode 400 with a non-type-cap string is retryable (`find-places-client.ts:56-59`).
- Do not assume a gibberish address is `'invalid'`. If Places answers with non-400 (for example HTML 500) or non-object JSON, this client stays `'retryable'` (`:43-48`).

## Why This Matters

- **Wrong bucket trains the wrong action.** Invalid search asks for a different address. Too many types asks to deselect categories. Retryable failure asks to wait and submit again. Empty success says the area has no matches.
- **A general error-text classifier still rots.** Status `!== 400` short-circuits before any string compare (`find-places-client.ts:43-45`), so HTML 500 stays retryable even if the page contains similar English.
- **All-400-as-invalid is too wide.** Coordinates-mode 400 and 400 with `error` as a non-string stay retryable unless the type-cap sentence matched first.
- **Independent geocoders.** Showing “Search results are still shown” after Places failed implies a list exists. Failure always clears the notice (`App.tsx:99`).

## When to Apply

- Adding or changing Places HTTP error handling, `FindPlacesFailure.kind`, `failureKind`, or PlaceList failure status / copy.
- Debugging “gibberish address looked retryable,” “type-cap looked like a bad address,” “type-cap on current location looked like a down service,” or “map said results are still shown but the list is an error.”
- Touching Nominatim display geocode vs Places `POST /find-places` — keep classification and notices independent.
- Refreshing this convention when Places changes the type-cap HTTP status or the exact `error` sentence; update `TOO_MANY_TYPES_ERROR` in lockstep (`find-places-client.ts:9`), do not broaden matching.

## Examples

### Invalid vs too-many-types vs retryable vs empty success

| Situation | Client result | PlaceList status | User-facing copy |
| --- | --- | --- | --- |
| Address or coordinates, HTTP 400, `{ error: "google too many types included in primary types" }` | `{ ok: false, kind: 'too-many-types' }` | `'too-many-types'` | Too many categories selected. Deselect some and search again. |
| Address search, HTTP 400, JSON `{ error: "<other string>" }` | `{ ok: false, kind: 'invalid' }` | `'invalid'` | We couldn’t find that address. Check the spelling and try again. |
| Address search, HTTP 500 HTML / non-JSON | `{ ok: false, kind: 'retryable' }` | `'error'` | Search couldn’t be completed. Try again in a moment. |
| Address search, HTTP 400, `{ error: [] }` | `{ ok: false, kind: 'retryable' }` | `'error'` | Search couldn’t be completed. Try again in a moment. |
| Coordinates search, HTTP 400, `{ error: "<other string>" }` | `{ ok: false, kind: 'retryable' }` | `'error'` | Search couldn’t be completed. Try again in a moment. |
| `fetch` throws (network / CORS) | `{ ok: false, kind: 'retryable' }` | `'error'` | Search couldn’t be completed. Try again in a moment. |
| HTTP 200, `places: []`, `total: 0` | `{ ok: true, data: { places: [], total: 0 } }` | `'success'` | No places found in this area. |

App maps the three kinds (`App.tsx:92-98`): `'invalid'` → `'invalid'`, `'too-many-types'` → `'too-many-types'`, anything else → `'error'`.

### What did not work (live traps)

- **Classify every 400 string by contents.** Only `TOO_MANY_TYPES_ERROR` is matched, and only with `===`. HTML 500 still stays retryable.
- **Treat all 400 as invalid.** Coordinates-mode 400 with a non-type-cap string is retryable.
- **Assume a bad-looking address is invalid.** Places may return non-400 HTML instead of 400 JSON.
- **Cap checkboxes by Google’s expanded-type limit.** That limit is not catalog checkbox count. Handling is the post-submit 400 sentence.

### Map notice vs Places failure

Places fail → `placesOk = false`; `setMapNotice(null)`; status `'invalid'`, `'too-many-types'`, or `'error'` (`App.tsx:88-100`). Places succeed and Nominatim miss → `MAP_MISS_NOTICE`. Do not set the miss notice while Places is in flight or already failed.

## Related

- [Vite listens on 3000; Places client defaults to 3001](../tooling-decisions/vite-default-port-3000-places-on-3001.md) — same client file and CORS/HTML debugging, different problem (ports, not kind mapping).
- [Leaflet Circle.getBounds crashes when the layer is not on the map](../runtime-errors/leaflet-circle-getbounds-unmapped-layer.md) — map fit crash; Places HTTP kinds are unrelated.
