---
title: Recursive nearby search
date: 2026-11-26
type: feat
execution: code
artifact_contract: ce-unified-plan/v1
product_contract_source: ce-brainstorm
---

# Recursive nearby search

## Goal Capsule

Callers can discover more than 20 distinct matching places within the radius they requested. The product decisions below govern both address and coordinate searches on `POST /find-places`. There are no open product blockers.

## Product Contract

### Summary

Search the requested circle first. When Google returns a full set of results, search smaller circles covering that area and merge the places found at every level. The result is a best-effort list. [Google Nearby Search](https://developers.google.com/maps/documentation/places/web-service/nearby-search)

### Requirements

- R1. Use the original search origin and radius for the first call and apply the requested place types throughout.
- R2. When a circle returns 20 raw results, recursively cover its portion of the requested area with smaller search circles, subject to R3. A circle returning fewer than 20 needs no further calls.
- R3. Use a fixed 50-meter minimum for subdivision in the Places search service. Search an original circle of 50 meters or less once at its requested radius.
- R4. Keep qualifying results from every level, deduplicate by Google place ID and exclude places outside the original radius.
- R5. A capped terminal circle ends only its own branch. Continue other branches and return the usual successful response with `places` and `total`, where `total` counts the returned places.
- R6. If any Nearby Search call fails, propagate its existing error and fail the whole request.

### Key Decisions

- Keep the subdivision threshold in code (session-settled: user-directed — chosen over an environment setting because the caller wants a fixed service rule).
- Omit the proposed `possiblyIncomplete` field. The returned count describes discovered places.

### Success Criteria

- A circle yielding 19 matches takes one Nearby Search call.
- A capped child can yield new places through a second subdivision, even when its initial 20 results are duplicates of places already found.
- Overlapping searches can return more than 20 distinct places in total. Each in-radius place found appears once.
- A 30-meter request that returns 20 results terminates after one search and returns the ordinary response. A capped 50-meter child likewise terminates while sibling searches continue.

## Planning Contract

Product Contract changed at R6 to record the caller's decision on failed subdivisions. R1–R5 retain their original meaning.

Use the Places service to coordinate a request-local, sequential traversal. This keeps at most one Google request in flight per search and makes the first failure decisive. At the maximum accepted radius of 50 km, the floor is reached after 11 splits. If every intersecting cell returns 20 results at every level, the disk intersects roughly 3.3 million terminal cells, plus their parents. This theoretical upper-end workload can make a synchronous request impractical. The plan introduces no separate call budget.

## Implementation Units

### U1. Cover a circle with searchable subareas

Add pure geometry helpers under `src/places/domain/`, alongside `coordinates.ts`. Work in an origin-centered disk measured in meters using a spherical azimuthal equidistant projection. The root owns the disk inside its bounding square. Split a capped node's **square** into four equal squares. Skip squares whose closest point to the origin lies outside the original disk. Retain square bounds as the recursion state so overlapping Google query circles never cause the same grid cell to be visited twice.

Query each retained child at its square center (converted back by great-circle destination bearing and distance). Its radius is the greater of 50 meters and the square's half-diagonal. This circle covers the square because the inverse projection preserves radial distances and contracts tangential distances on the sphere. Use consistent earth-radius units, longitude wrapping, and a pole-safe center conversion. Include boundary points and allow for floating-point rounding in coverage calculations. Always query the root using the caller's exact radius. A query at or below the floor is terminal.

### U2. Collect and merge results using the existing adapters

Extend the internal place representation in `src/places/domain/google-places.ts` and the field mask and parser in `src/places/adapters/google.ts` to read `places.location`. Preserve the public response mapping. A root hit is already inside the requested circle by Google's restriction. For child-only hits, confirm membership by great-circle distance from the original origin before adding the ID. If a child hit cannot be placed because coordinates are missing or invalid, treat it as an invalid upstream payload via the adapter's existing malformed-response path.

In `src/places/service/places-service.ts`, own the fixed 50-meter constant and use U1 to visit children in a fixed order. Use the length of each raw adapter result to decide whether to split, before deduplication, radius checks, or other filtering. Accumulate first-seen qualifying places by ID in request-local insertion order. Pass the original primary types to every search. Preserve current inclusion behavior for website fields. Return the collection only after all branches succeed. Let an adapter rejection unwind immediately to the existing route mapper in `src/places/adapters/find-places-route.ts`. Preserve address geocoding once per request and the separate health probe.

### U3. Document the API behavior

After U2, revise the single-call description in `docs/api.md`. Explain best-effort coverage, the count of unique returned places, and failure of the entire request if a subdivision fails. Preserve the existing error mapping for each failure class.

## Verification Contract

During implementation run `npm run typecheck` and `npm test`, including the existing `tests/composition/build-app.test.ts`. Exercise the following cases with temporary, deterministic Google responses through the service or HTTP entry point. Keep verification local and leave test files untouched.

- Check original radii of 30, 50, and 51 meters, with 19 versus 20 hits. Only the capped 51-meter request should issue child queries, each at 50 meters.
- Sample coverage at quadrant corners, the original perimeter, high latitudes, poles and the antimeridian. Check that shared edges have no gaps and every nonterminal child has a smaller query radius than its parent.
- Return duplicate IDs across parent and children, including a capped child containing only previously seen IDs. Introduce a new in-radius ID in its grandchild and an outside ID in an overlapping child. Check unique IDs, total, boundary inclusion and absence of internal coordinates in the response.
- Return 20 hits from a terminal child and a fresh hit from a later sibling. Verify both branches contribute. Repeat with a sibling failure after earlier successes and compare its status and body to the same failure on the root. No further calls should start.
- Exercise coordinate and address input with the same origin. Check identical Places calls and filters, with one geocode call only for address input.

## Definition of Done

R1–R6 work through the public endpoint, the verification scenarios pass, and the API reference describes the response callers receive.
