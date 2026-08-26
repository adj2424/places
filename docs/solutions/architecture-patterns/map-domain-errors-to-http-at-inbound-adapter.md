---
title: "Map domain error classes to HTTP at the inbound adapter"
date: 2026-08-26
category: architecture-patterns
module: places
problem_type: architecture_pattern
component: service_object
severity: medium
applies_when:
  - "An inbound HTTP adapter must translate caught domain errors into status codes and JSON bodies"
  - "A new places-slice domain error class is added or subclassed under GooglePlacesError or GoogleGeocodeError"
  - "POST /find-places (or a sibling route) catch blocks would otherwise rethrow placeholder Error strings into Express defaults"
  - "Living docs for inbound HTTP fields or status JSON are restated after an error-mapping change"
related_components:
  - "documentation"
tags:
  - "hexagonal-layout"
  - "inbound-adapter"
  - "domain-errors"
  - "http-error-mapping"
  - "find-places"
  - "geocoding"
  - "upstream-unavailability"
  - "living-docs"
---

# Map domain error classes to HTTP at the inbound adapter

## Context

`POST /find-places` has two failure envelopes at the HTTP edge. Zod `safeParse` failure returns **400** with `{ error: <Zod issue array> }` and never calls Google (`src/places/adapters/find-places-route.ts:82-95`). After that, both the geocode catch (`find-places-route.ts:107-111`) and the Nearby Search catch (`find-places-route.ts:118-121`) call `mapFindPlacesError` and `res.status(status).json(body)`. The geocode catch returns so a failed address lookup does not continue into search.

The live mapping is a class-order table in domain, not a dedicated adapter module. `mapFindPlacesError` lives in `src/places/domain/errors.ts:133-147`. There is no `map-find-places-error.ts` in the tree. The mapper returns HTTP status numbers (`400 | 500 | 502`) from domain (`errors.ts:128-131`). That sits in tension with hexagonal layout: AGENTS.md says domain must not import Express or HTTP types, and the feature recipe says map domain errors at the inbound adapter (**400** validation, **502** upstream unavailability, **500** unexpected). The current code keeps the function in domain while encoding adapter HTTP status and JSON `{ error: string }` there.

This mapping is pending in the working tree on `main` (uncommitted as of this writing). Do not treat it as merged.

Failed approaches (do not treat as live behavior):

- A parallel session implemented a finer-grained table: `GeocodeInvalidAddressError` as **400** with a Zod-like issue array; only Unavailable/quota as **502**; everything else **500** with a shared opaque `'places search unavailable'`, plus unique-origin geocode. The user asked to revert that entire change. It is not current behavior.
- An earlier session draft put the mapper in a dedicated adapter file `map-find-places-error.ts` with an opaque shared **502**/**500** string. That file is not in the tree; `find-places-route.ts:7` imports `mapFindPlacesError` from `../domain/errors.js`.

`docs/api.md` (working tree) documents unmatched geocode **400** as `{ "error": "invalid address" }` and **502**/**500** as `{ "error": "places search unavailable" }` (`docs/api.md:117-119`). Among living docs, `docs/api.md` wins for HTTP request/response fields and status JSON. Those documented strings are **not** what `mapFindPlacesError` currently emits. Agents must not copy the api.md strings as live adapter output until the mapper or the doc is aligned.

No files match `tests/**/*.test.ts` in this repo (pre-existing). This learning does not invent coverage.

## Guidance

Map find-places runtime failures by **domain error class**, in this order, via `mapFindPlacesError` (`src/places/domain/errors.ts:133-147`):

1. **`GeocodeInvalidAddressError`** → **400**, `body.error = error.message`. The constructor message is `'google geocoding invalid address'` (`errors.ts:79-82`, `errors.ts:134-136`). This is a string, not a Zod issue array. `ZERO_RESULTS` is the outbound path that throws this class (`geocoding.ts:140-141`).
2. **Any `GooglePlacesError`** → **502**, `'google places service unavailable'` (`errors.ts:138-140`). Nearby Search `fetch` throws, non-ok HTTP, and schema-invalid bodies all land here (`google.ts:71-86`). The mapper does not branch on Places subclasses.
3. **Remaining `GoogleGeocodeError`** → **502**, `'google geocoding service unavailable'` (`errors.ts:142-144`). `GeocodeInvalidAddressError` is a subclass (`errors.ts:79`) but is already handled in step 1. `UNKNOWN_ERROR` throws `GeocodeUnexpectedError` (`geocoding.ts:144-145`), not `GeocodeUnavailableError`, and still hits this branch.
4. **Anything else** → **500**, `'unknown error'` (`errors.ts:146`), including a thrown `response.json()`.

Keep Zod validation separate: request-shape failures stay **400** with `{ error: issues }` (`find-places-route.ts:92-94`). Do not fold those into `mapFindPlacesError`.

Outbound adapters throw the domain classes; they do not set HTTP status.

Do not invent a second mapper file. If you move HTTP status out of domain later, keep the class order and the live strings unless you also restate `docs/api.md` in the same change. Until then, treat `docs/api.md` as the living-docs winner for the documented HTTP contract, and treat `mapFindPlacesError` as what the process actually returns.

```typescript
export function mapFindPlacesError(error: unknown): MappedFindPlacesError {
  if (error instanceof GeocodeInvalidAddressError) {
    return { status: 400, body: { error: error.message } };
  }

  if (error instanceof GooglePlacesError) {
    return { status: 502, body: { error: 'google places service unavailable' } };
  }

  if (error instanceof GoogleGeocodeError) {
    return { status: 502, body: { error: 'google geocoding service unavailable' } };
  }

  return { status: 500, body: { error: 'unknown error' } };
}
```

(Source: `src/places/domain/errors.ts:133-147`.)

## Why This Matters

Callers and agents that trust `docs/api.md` will expect `"invalid address"` and `"places search unavailable"`. Live output is `'google geocoding invalid address'`, `'google places service unavailable'`, `'google geocoding service unavailable'`, or `'unknown error'`. A client that string-matches api.md will mis-handle every mapped failure.

The four-way split (invalid address vs Places upstream vs Geocoding upstream vs unknown) is coarser than the domain class tree: quota, 503, 500, and malformed Nearby Search bodies all collapse to **502** Places because they are `GooglePlacesError`. Geocoding `UNKNOWN_ERROR` is `GeocodeUnexpectedError`, not Unavailable, but still **502** via the remaining geocode branch. Finer tables (only Unavailable/quota as 502; else 500; Zod-shaped invalid address) were tried and reverted.

Putting `status: 400 | 500 | 502` on a domain type (`errors.ts:128-131`) makes the HTTP contract easy to call from the route, but it encodes adapter concerns in the layer AGENTS.md and `docs/architecture.md` say should stay free of HTTP. Future work that “fixes layout” must not silently change status or body strings.

Feature validation failures must not by themselves make health unhealthy. This mapper is find-places only; `/health` is a separate probe.

## When to Apply

- Implementing or changing `POST /find-places` catch paths, outbound Google adapters, or domain error subclasses.
- Documenting or asserting HTTP status and `error` strings: cite the mapper (`errors.ts:133-147`) for live output; cite `docs/api.md` only as the living-docs contract, and state the mismatch until they agree.
- Choosing where a new mapper lives: today it is in `src/places/domain/errors.ts`, imported by the route (`find-places-route.ts:7`). Do not assume `map-find-places-error.ts`.
- Interpreting Google Geocoding status codes: `ZERO_RESULTS` is the only path to **400**; `UNKNOWN_ERROR` is unexpected at the adapter but still **502** via remaining `GoogleGeocodeError` (`geocoding.ts:136-148`).
- Interpreting Nearby Search HTTP failures: they collapse to **502** Places-unavailable; `docs/api.md` **500** for unexpected Nearby is not live (`google.ts:71-86`, `errors.ts:138-140`).
- After a revert: do not restore the Zod-array invalid-address table, unique-origin geocode, or a dedicated adapter mapper file unless the user asks again.

## Examples

**Unmatched address (`ZERO_RESULTS`)** — mapper first branch.

Live: **400** `{ "error": "google geocoding invalid address" }` (`geocoding.ts:140-141`, `errors.ts:134-136`). `docs/api.md:117` shows `"invalid address"` (documented contract, not live output).

**Geocoding `UNKNOWN_ERROR`** — `GeocodeUnexpectedError`, remaining `GoogleGeocodeError`.

Live: **502** `{ "error": "google geocoding service unavailable" }` (`geocoding.ts:144-145`, `errors.ts:142-144`). Not **500**, and not the Places string.

**Nearby Search unexpected body (schema-invalid or HTTP 500)** — `GooglePlacesError`.

Live: **502** `{ "error": "google places service unavailable" }` (`google.ts:84-86`, `errors.ts:138-140`). `docs/api.md:119` documents **500** `"places search unavailable"`; that is not live.

**Unclassified throw** (neither Places nor Geocode error, including thrown `response.json()`).

Live: **500** `{ "error": "unknown error" }` (`errors.ts:146`). Not `"places search unavailable"`.

## Related

- [Find-places address XOR skipped Nearby Search (TS2454)](../logic-errors/find-places-address-xor-skipped-nearby-search.md) — same inbound adapter; still describes placeholder catch throws and unfinished 400/502 mapping (stale relative to this working tree).
- [Own live HTTP fields in docs/api.md](../documentation-gaps/live-http-fields-owned-by-docs-api.md) — still says live adapters do not return 502/500 JSON; restating that snapshot is a refresh, not this learning.
- [Living docs hexagonal slices](../documentation-gaps/living-docs-hexagonal-slices.md) — adapters validate at the HTTP edge; domain stays free of HTTP types. The 400/502/500 mapping recipe is in AGENTS.md, not that snapshot.
