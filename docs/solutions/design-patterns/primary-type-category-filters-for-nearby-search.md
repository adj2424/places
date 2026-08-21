---
title: Filter nearby search with service-owned primary type categories
date: 2026-08-21
category: design-patterns
module: places
problem_type: design_pattern
component: service_object
severity: medium
applies_when:
  - "Callers should filter Nearby Search by coarse category keys this service owns, not raw Google type strings"
  - "A successful Nearby Search omits places when empty and must not be treated as a schema failure"
  - "Adding a category means updating the domain PrimaryTypes map rather than exposing Google type lists at HTTP"
tags:
  - places
  - nearby-search
  - primary-types
  - category-filters
  - hexagonal-layout
  - outbound-adapter
  - google-places
  - http-validation
---

# Filter nearby search with service-owned primary type categories

## Context

Nearby search used to send Google Places Nearby Search a location circle only. Callers of `POST /find-places` could not narrow the query by place category: the HTTP body was `{ latitude, longitude, radiusMeters }`, the `PlacesService` port took those three arguments, and the outbound adapter’s request body contained only `locationRestriction`. Google’s Nearby Search type vocabulary is a long list of raw strings (`restaurant`, `cafe`, `hospital`, and so on). Exposing those strings on this service’s HTTP surface would have made callers depend on Google’s type names and would have scattered type lists through the route, the service, and the adapter.

The friction: how does a hexagonal Places slice own a coarse category vocabulary that HTTP callers can send, while still speaking Google’s `includedPrimaryTypes` list on the wire — without putting Google-specific expansion in the service, and without treating an empty Nearby Search payload as a schema failure?

The implementation is committed on local `main` as of this writing. This learning file is new and was not part of that commit.

Early wiring used `.map` over category keys, which produced nested arrays (`string[][]`) instead of the flat `string[]` Nearby Search expects (session history). A later live call that sent a whole expanded category list returned HTTP 400 `INVALID_ARGUMENT`; prior sessions attributed that to Google capping `includedPrimaryTypes` at 50 types (session history). Category catalogs were later shortened; those historical overflow counts are not current-tree sizes.

## Guidance

Own category keys in domain. Validate those keys at the HTTP edge. Expand them to Google type strings only in the outbound adapter, and flatten them. Treat a missing `places` array on a successful Nearby Search response as “no results,” not as a parse failure.

**Domain owns the vocabulary.** `src/places/domain/google.ts` exports `PrimaryTypes`, a const object whose keys are this service’s category names (`automotive`, `foodAndDrink`, `healthAndWellness`, …) and whose values are arrays of Google primary-type strings (`src/places/domain/google.ts:262`). `PrimaryType` is `keyof typeof PrimaryTypes` (`src/places/domain/google.ts:284`). Those keys are the contract callers use. They are not Google’s type strings. For example, `restaurant` is a value under `foodAndDrink` (`src/places/domain/google.ts:93-94`); it is not a valid HTTP `primaryTypes` item.

The same file types Google’s Nearby Search payload with `places` optional:

```11:13:src/places/domain/google.ts
export type GooglePlacesResponse = {
  places?: GooglePlace[];
};
```

**The port carries category keys, not expanded Google types.** `PlacesService.getPlaces` takes `primaryTypes: PrimaryType[]` as a required argument (`src/places/domain/port.ts:4-8`). The service layer does not look up `PrimaryTypes`. It forwards the array and still applies the no-website filter:

```8:16:src/places/service/places-service.ts
  async getPlaces(
    latitude: number,
    longitude: number,
    radiusMeters: number,
    primaryTypes: PrimaryType[]
  ): Promise<GooglePlace[]> {
    const places = await this.googlePlacesAdapter.getPlaces(latitude, longitude, radiusMeters, primaryTypes);
    return places.filter(place => hasNoWebsite(place.websiteUri));
  }
```

**HTTP validates keys and normalizes omission to `[]`.** The inbound adapter’s Zod schema takes `primaryTypes` as an optional array whose items are `z.enum(Object.keys(PrimaryTypes) …)` (`src/places/adapters/find-places-route.ts:26-31`). Invalid keys fail at the edge with HTTP 400 and never reach Google (`src/places/adapters/find-places-route.ts:36-49`). After a successful parse, the route calls the service with `primaryTypes ?? []` (`src/places/adapters/find-places-route.ts:53-54`). Omitted `primaryTypes` therefore becomes an empty `PrimaryType[]` before it leaves the inbound adapter.

**The outbound adapter is the only place that expands keys.** `GooglePlacesAdapter.getPlaces` includes `includedPrimaryTypes: primaryTypes.flatMap(primaryType => PrimaryTypes[primaryType])` in the Nearby Search JSON body (`src/places/adapters/google.ts:55-56`). Use `flatMap`, not `map`: `.map` nests one array per category (session history). For `primaryTypes: []` that `flatMap` yields `[]`, so the request body contains `includedPrimaryTypes: []`. This repo does not document what Google Nearby Search does with an empty `includedPrimaryTypes` list; do not infer that from this code.

Empty nearby responses are handled on the way back. The adapter schema marks `places` optional (`src/places/adapters/google.ts:17-19`), matching the domain type. After a successful parse the adapter returns `parsed.data.places ?? []` (`src/places/adapters/google.ts:87`). A 2xx body that omits `places` is therefore “no places,” not a `GoogleGenericError` from shape validation.

This is Hexagonal layout applied to a filter vocabulary: domain holds the map; the inbound adapter validates caller keys; the outbound adapter maps to Google’s field; the service stays a use case (pass-through plus the existing website filter). Composition binds a Child logger with `component: 'places'` (`src/composition/build-app.ts:17`) and passes it into the Google adapter (`src/composition/build-app.ts:22`). The adapter may bind a further child for the Nearby Search request (`src/places/adapters/google.ts:38-41`) and logs the category keys on the request (`src/places/adapters/google.ts:45`). Invalid `primaryTypes` is caller validation (400), distinct from Upstream unavailability.

## Why This Matters

If Google type strings leak onto `POST /find-places`, every caller must know Google’s vocabulary, and changing a category’s membership means an HTTP breaking change or duplicated lists. Keeping `PrimaryTypes` in domain makes membership a single edit (`src/places/domain/google.ts:262`). Zod’s enum is derived from `Object.keys(PrimaryTypes)` (`src/places/adapters/find-places-route.ts:30`), so adding a category key extends both the map and the HTTP allow-list without a second hardcoded enum in the route.

If expansion lived in the service, the use case would import Google’s wire shape and would be the wrong place to change when Nearby Search’s field name or list semantics change. The service’s job here is still “find nearby places with no website” (`src/places/service/places-service.ts:14-15`). Category expansion is an outbound-adapter concern (`src/places/adapters/google.ts:56`).

If `GooglePlacesResponse.places` stayed required, a successful empty Nearby Search that omits `places` would fail `safeParse` and throw `GoogleGenericError` (`src/places/adapters/google.ts:79-83` on parse failure). Making `places` optional in both the domain type (`src/places/domain/google.ts:12`) and the Zod schema (`src/places/adapters/google.ts:18`), then coalescing with `?? []` (`src/places/adapters/google.ts:87`), keeps “no results” as an empty array the service can filter.

Normalizing omitted `primaryTypes` at the HTTP edge (`primaryTypes ?? []` at `src/places/adapters/find-places-route.ts:54`) keeps the port’s `primaryTypes: PrimaryType[]` required (`src/places/domain/port.ts:8`) and keeps `flatMap` well-defined. Callers that omit the field still produce `includedPrimaryTypes: []` on the Google request (`src/places/adapters/google.ts:56`). What Google does with that empty list is outside this repo’s documented behavior.

Prior sessions treated Google Nearby Search as capping `includedPrimaryTypes` at 50 types (session history). This repo does not encode that cap. As of this writing no single category list in `PrimaryTypes` exceeds 16 members; concatenating several selected categories can still exceed 50. Growing a category back to a full Google table, or requesting many categories at once, can make Google return 400 `INVALID_ARGUMENT`. That is not this service’s caller HTTP 400 (unknown category keys); living docs map Google 4xx to find-places **500**.

## When to Apply

Apply this split when an inbound caller should name a service-owned category (or similar coarse key) and an outbound vendor API wants a different, expanded vocabulary.

- Adding or changing Nearby Search category membership: edit `PrimaryTypes` in `src/places/domain/google.ts`. Do not add a parallel list in the route or adapter.
- Extending `POST /find-places` with another optional filter that maps to a Google request field: validate at the HTTP adapter, pass a domain type through the port and service, map in `GooglePlacesAdapter`.
- Handling vendor payloads that omit a collection when empty: type the field optional and coalesce to `[]` in the outbound adapter, as with `places` (`src/places/domain/google.ts:12`, `src/places/adapters/google.ts:18,87`).
- Rejecting unknown category keys: keep the Zod enum derived from `Object.keys(PrimaryTypes)` so invalid keys stay HTTP 400 (`src/places/adapters/find-places-route.ts:30,36-49`).
- Expanding keys for Google: flatten with `flatMap` (or equivalent). Keep each category list, and the flattened union of selected categories, inside any `includedPrimaryTypes` size limit you are relying on (session history).

Do not apply this by putting `includedPrimaryTypes` or `PrimaryTypes[...]` lookups in `PlacesServiceImpl`. Do not accept raw Google type strings on the HTTP body unless the domain contract is deliberately changed. Do not treat an omitted `places` array as malformation after this change.

## Examples

**Before:** nearby search had no category argument. The port was `getPlaces(latitude, longitude, radiusMeters)`. The route schema had no `primaryTypes` field and called `placesService.getPlaces(latitude, longitude, radiusMeters)`. The Google adapter POST body was only `locationRestriction`. `GooglePlacesResponse.places` was required, the Zod schema required `places`, and the adapter returned `parsed.data.places` with no `?? []`.

**After (current tree):** callers send this service’s keys, not Google types. A valid body looks like:

```json
{
  "latitude": 40.7128,
  "longitude": -74.006,
  "radiusMeters": 1000,
  "primaryTypes": ["foodAndDrink", "shopping"]
}
```

Zod accepts those keys because they are keys of `PrimaryTypes` (`src/places/adapters/find-places-route.ts:30`). The route passes `["foodAndDrink", "shopping"]` into the service (`src/places/adapters/find-places-route.ts:54`). The adapter expands them:

```55:56:src/places/adapters/google.ts
        body: JSON.stringify({
          includedPrimaryTypes: primaryTypes.flatMap(primaryType => PrimaryTypes[primaryType]),
```

`foodAndDrink` contributes `restaurant`, `cafe`, `bar`, and the rest of that list (`src/places/domain/google.ts:93-109`); `shopping` contributes `store`, `supermarket`, and siblings (`src/places/domain/google.ts:205-221`). The service never performs that expansion; it still drops places that have a website (`src/places/service/places-service.ts:14-15`).

A body that uses a Google type as if it were a category key is invalid. `"primaryTypes": ["restaurant"]` fails the enum (the key is `foodAndDrink`, not `restaurant`) and the route returns 400 (`src/places/adapters/find-places-route.ts:30,46-48`).

**Omitted `primaryTypes` becomes `includedPrimaryTypes: []`.** If the client sends only `latitude`, `longitude`, and `radiusMeters`, Zod leaves `primaryTypes` undefined (optional at `src/places/adapters/find-places-route.ts:30` and `FindPlacesRequest` at `src/places/adapters/find-places-route.ts:11`). The route supplies `[]` via `primaryTypes ?? []` (`src/places/adapters/find-places-route.ts:54`). `[].flatMap(...)` is `[]`, so the Google JSON includes `"includedPrimaryTypes": []` (`src/places/adapters/google.ts:56`). This service does not document Google’s interpretation of that empty list.

**Empty Nearby Search body:** a 2xx response `{}` or `{ "places": [] }` both become `GooglePlace[]`. Optional `places` plus `parsed.data.places ?? []` (`src/places/adapters/google.ts:18,87`) is what makes the omitted-field case an empty list instead of a schema error. The service then filters that list for missing websites and the route maps it to `{ places, total }` as before (`src/places/adapters/find-places-route.ts:65-74`).

## Related

- [Prefer Express HTTP adapter over Fastify](../tooling-decisions/express-http-adapter-over-fastify-hexagonal.md) — Zod at the find-places edge; does not cover category keys.
- [Keep living docs aligned with hexagonal slices](../documentation-gaps/living-docs-hexagonal-slices.md) — places slice layout; not the Nearby Search body.
- Living `docs/architecture.md` HTTP table still lists the find-places body as `{ latitude, longitude, radiusMeters }` only; that table has not yet picked up optional `primaryTypes`.
