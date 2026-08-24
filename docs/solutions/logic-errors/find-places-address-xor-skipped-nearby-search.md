---
title: "Find-places address XOR skipped Nearby Search (TS2454)"
date: 2026-08-24
category: logic-errors
module: "places / find-places HTTP adapter"
problem_type: logic_error
component: service_object
symptoms:
  - "TS2454: Variable 'coordinates' is used before being assigned"
  - "Address XOR requests never ran Nearby Search because getPlaces lived inside isCoordinatesRequest"
  - "Empty catch swallowed geocode errors so later catch rethrew unrelated failures"
root_cause: logic_error
resolution_type: code_fix
severity: high
tags:
  - "find-places"
  - "typescript"
  - "ts2454"
  - "geocoding"
  - "request-address"
  - "xor-validation"
  - "hexagonal-layout"
  - "coordinates"
---

# Find-places address XOR skipped Nearby Search (TS2454)

## Problem

On `POST /find-places`, per this session, TypeScript reported TS2454 because `coordinates` was used before every control-flow path assigned it, and the Request **address** XOR branch never reached Nearby Search when `getPlaces` lived only under the coordinates branch. An empty `catch` around Geocoding also hid upstream failures. Those intermediate shapes are not in `HEAD`/`origin/main` (`7368d9d`); the current working tree uses if/else origin assignment then one `getPlaces`. As of this writing the change is uncommitted on `main` (`gh` unavailable, so PR state is unverified).

## Symptoms

- Per this session, `tsc` reported **TS2454** (`Variable 'coordinates' is used before being assigned`) when Nearby Search ran after a `let coordinates` that was not assigned on every path. That compiler log is not stored in the repo; the current adapter assigns on both XOR arms before `getPlaces`.
- Per this session, a valid XOR Request **address** body could skip Nearby Search if `getPlaces` was nested under `isCoordinatesRequest`. The current adapter geocodes then calls `getPlaces` once; `HEAD` has no XOR helpers.
- Geocoding failures still have no mapped HTTP status on the success-after-parse path (placeholder `throw`). The empty-`catch` swallow that continued without assigning origin is session history, not the current file.
- The repo has no `tests/**/*.test.ts` files. Do not treat a green test suite as evidence of this fix.

## What Didn't Work

- **Typing `coordinates` as `Coordinates | undefined`.** That silences definite-assignment checking but does not prove origin was resolved. Callers still need a runtime guard, and it invites using `undefined` as a third XOR mode after Zod already narrowed the request.
- **Empty `catch` without `return` (or rethrow).** Geocoding errors were logged or ignored, then the handler still reached `getPlaces` with an unassigned or stale origin. Swallowing is not the same as mapping a domain failure at the HTTP edge.
- **Calling `getPlaces` only inside the coordinates branch.** After XOR validation, Request **address** is a first-class origin: Geocoding must produce `Coordinates`, then Nearby Search runs. Nesting search under `isCoordinatesRequest` made the address path a no-op for places.
- **Checking `coordinates === undefined` after `let coordinates: Coordinates`.** An uninitialized typed `let` is not `undefined` at the type level; TS2454 is about definite assignment, not a value you can compare. The comparison does not compile-fix the hole and does not encode “address vs coordinates” after Zod.

## Solution

Keep XOR validation at the HTTP adapter. After `safeParse` succeeds, resolve origin in an `if` / `else`, then call Nearby Search once.

Current tree (`src/places/adapters/find-places-route.ts`):

1. Zod `superRefine` accepts only Request **address** xor coordinates (`isAddressRequest` / `isCoordinatesRequest` at `find-places-route.ts:70-76`, refine at `find-places-route.ts:36-68`). Invalid bodies return **400** (`find-places-route.ts:81-94`).
2. `let coordinates: Coordinates` (`find-places-route.ts:98`). After a successful XOR parse, **else is coordinates mode**.
3. If Request **address**: Geocoding via `placesService.getCoordinatesByAddress` (`find-places-route.ts:100-101`). Else: `{ latitude, longitude }` from the request (`find-places-route.ts:103-104`).
4. One Nearby Search: `placesService.getPlaces(coordinates, request.radiusMeters, request.primaryTypes ?? [])` (`find-places-route.ts:113`). The port takes a `Coordinates` object, not loose numbers (`src/places/domain/port.ts:5`; type at `src/places/domain/coordinates.ts:1-4`).
5. Hexagonal: this lives only in the inbound HTTP adapter (`registerPlacesRoutes` at `find-places-route.ts:78`). Domain/service do not import Express.

**Not the documented solution (WIP on the same working tree):** both `catch` blocks still `throw new Error('this would be a route error mapped from domain error - finding places')` (`find-places-route.ts:106-108`, `find-places-route.ts:116-118`). There is **no** `mapFindPlacesError` in the tree. Success mapping is `mapFindPlacesResponse` only (`find-places-route.ts:123-133`).

Illustrative control flow (matches the current adapter, omitting WIP throws):

```ts
const request = parsedInput.data;
let coordinates: Coordinates;
if (isAddressRequest(request)) {
  coordinates = await placesService.getCoordinatesByAddress(request.address!);
} else {
  coordinates = { latitude: request.latitude!, longitude: request.longitude! };
}
const places = await placesService.getPlaces(
  coordinates,
  request.radiusMeters,
  request.primaryTypes ?? []
);
```

## Why This Works

XOR validation already guarantees exactly one origin mode. TypeScript’s definite-assignment analysis then needs a **total** assignment: every successful path must set `coordinates` before Nearby Search. `if (address) { … } else { … }` is that total function; the else branch is coordinates, not “maybe missing.”

Nesting `getPlaces` under the coordinates branch split “how we get origin” from “search around origin.” Request **address** and coordinates are two ways to obtain the same `Coordinates` value; Nearby Search should not care which XOR arm ran. Sharing one `getPlaces` after origin is resolved matches the port (`getPlaces(coordinates, …)` at `port.ts:5`).

An empty catch breaks the same invariant: Geocoding can fail without assigning `coordinates`, which is exactly TS2454 and a silent skip of Nearby Search. Re-throwing (even as today’s placeholder `Error`) at least does not continue with an unassigned origin. Mapping those errors to **502** / **400** at the HTTP edge is still unfinished in this working tree.

## Prevention

- After XOR validation, assign origin with **if/else definite assignment**. Treat else as coordinates mode. Do not leave a `let` for the compiler to prove later with `=== undefined`.
- Never compare an uninitialized typed `let` to `undefined` to “close” TS2454. Either assign on every branch or use a pattern the checker understands (if/else or early return before the use).
- Share **one** Nearby Search call after origin is resolved (Geocoding or request lat/lng). Do not duplicate or nest `getPlaces` under a single XOR arm.
- Do not use empty `catch` without `return` or rethrow on Geocoding. Fail closed at the HTTP adapter; do not proceed to Nearby Search without `Coordinates`.
- Keep the split hexagonal: Zod XOR and origin resolution stay in the HTTP adapter; `PlacesService.getPlaces` / `getCoordinatesByAddress` stay on the port (`port.ts:5-6`).
- Do not add tests unless explicitly asked. Absence of test files is not a gap to fill as part of documenting the learning.

## Related Issues

- [Filter nearby search with service-owned primary type categories](../design-patterns/primary-type-category-filters-for-nearby-search.md) — same find-places Nearby Search path; HTTP examples there are still coords-oriented.
- [Prefer Express HTTP adapter over Fastify in TypeScript hexagonal microservice](../tooling-decisions/express-http-adapter-over-fastify-hexagonal.md) — Zod at the inbound adapter boundary.
- [Keep living docs aligned with hexagonal slices](../documentation-gaps/living-docs-hexagonal-slices.md) — places slice layout.
