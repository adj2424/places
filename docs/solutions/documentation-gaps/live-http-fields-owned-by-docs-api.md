---
title: Own live HTTP fields in docs/api.md, not README or architecture tables
date: 2026-08-26
category: documentation-gaps
module: living-docs / HTTP API
problem_type: documentation_gap
component: documentation
severity: high
applies_when:
  - "Inbound HTTP fields, status codes, or JSON bodies change in health or find-places adapters"
  - "Updating README.md, AGENTS.md, CONCEPTS.md, or docs/architecture.md that mention GET /health or POST /find-places"
  - "Callers need field types, XOR location rules, primaryTypes keys, total, or the Zod 400 envelope"
  - "Choosing between committed OpenAPI YAML/JSON, a served spec, and a static markdown reference"
  - "Product intent (Health checks, Upstream 502/500 JSON) diverges from live inbound adapter JSON"
symptoms:
  - "README and architecture omitted field types, primaryTypes keys, and total on the live success body"
  - "Docs described an intended health checks object and find-places 502/500 JSON that live adapters do not return"
  - "Callers could not reconstruct a request or response without reading inbound adapters"
root_cause: inadequate_documentation
resolution_type: documentation_update
related_components:
  - development_workflow
tags:
  - living-docs
  - http-api
  - docs-api
  - openapi-style
  - health
  - find-places
  - primary-type
  - composition
---

# Own live HTTP fields in docs/api.md, not README or architecture tables

## Context

README and architecture described inbound HTTP with a method/path table and thin JSON bullets. That surface omitted field types, Primary type catalog keys, and the `total` field on success. Architecture already sketched XOR-at-400 and a Zod-like 400 envelope, and also documented intended find-places **502** / opaque **500** JSON. README used bullets that included a non-live Health `checks.googlePlaces` object and a success body of `{ "places": [...] }` with no `total`. Live adapters do not return `checks` or mapped 502/500 JSON.

The gap was documentation ownership, not a production bug: Living docs mixed product intent with wire JSON. CONCEPTS **Health** still means a Google Places connectivity/auth check; CONCEPTS **Upstream unavailability** still means HTTP 502 with an opaque body. AGENTS.md’s feature recipe still maps adapter errors as **400** validation, **502** upstream unavailability, **500** unexpected (`AGENTS.md:64`). The running process does not match those product meanings today.

Per this session’s settled decisions (user-directed, 2026-08-26, still uncommitted on `main` — do not treat as merged):

1. Markdown OpenAPI-style (paths, requestBody, responses, components/schemas) — not a valid OpenAPI document, not codegen.
2. Static docs only — no new routes, no OpenAPI YAML, no Swagger UI.
3. Live adapters are the HTTP source of truth — document what the process returns today.
4. One field-level owner: `docs/api.md`; other Living docs link instead of restating schemas.
5. Drift note once in `docs/api.md` only: live JSON vs product intent in AGENTS/CONCEPTS.
6. Follow-up: README remains how-to-run plus a short feature pointer (key behaviors and the full Primary type key list), not a second field catalog.

What shipped in this working tree: `docs/api.md` plus pointer updates in `AGENTS.md`, `CONCEPTS.md`, `docs/architecture.md`, and `README.md`. Docs-only; no production behavior changes; no new tests.

## Guidance

Treat **live inbound adapters** as the HTTP source of truth, and keep **one field-level owner**.

**Owner.** `docs/api.md` is the HTTP API reference for live fields (`AGENTS.md:27`). When inbound HTTP fields, status codes, or JSON bodies change, restate `docs/api.md` in the same change (`AGENTS.md:41`). On conflict among Living docs, `docs/api.md` wins for HTTP request/response fields and status JSON; AGENTS.md’s numbered recipe wins for adapter error-mapping when implementing routes; architecture.md wins for layers and outbound adapter roles (`AGENTS.md:77`). Code plus package scripts still win for runtime behavior (`AGENTS.md:77`).

**Shape.** Write an OpenAPI-*style* markdown file: Info, Servers, Paths (operation, request body, responses, examples), then Components/schemas. Do not claim it is a valid OpenAPI 3 document. Do not add `/openapi.json`, Swagger UI, or codegen.

**Live vs product intent.** Product meaning stays in CONCEPTS (**Health**, **Upstream unavailability**) and in AGENTS/architecture role rows. The wire contract stays in `docs/api.md`. State the split once, in `docs/api.md` only (`docs/api.md:25-27`). CONCEPTS **Health** and **Upstream unavailability** link to `docs/api.md` and say those entries are product meaning, not the live wire (`CONCEPTS.md:37-48`). Architecture’s HTTP table points at `docs/api.md` for live JSON (`docs/architecture.md:37-46`).

**Document what adapters return today** (cite the defining lines; do not copy product intent as if it were live):

- **Health (`GET /health`).** The route maps `ok` → **200** and anything else → **503**, body `{ status: result }` (`src/health/adapters/health-routes.ts:6-10`). The outbound adapter issues `HEAD https://www.google.com` and returns `'ok'` when `response.ok`, else `'unhealthy'` (`src/health/adapters/google-health.ts:7-16`). There is no `checks` object. The probe does not use `GOOGLE_API_KEY` or Places APIs. If `fetch` throws, Express default error handling applies — not those JSON shapes (`docs/api.md:69-72`). A **200** here does not guarantee find-places will succeed.

- **Find-places request (`POST /find-places`).** Zod at the HTTP edge (`src/places/adapters/find-places-route.ts:28-68`): `radiusMeters` finite, positive, max **50000** (`:32`); `latitude` optional finite **−90..90** (`:30`); `longitude` optional finite **−180..180** (`:31`); `primaryTypes` optional array of Primary type catalog keys (`:34`). XOR via `superRefine`: both Request address and coordinates → `both address and coordinates are provided` on path `['address']` (`:45-51`); only one of lat/lng → `either address or coordinates are required` on `['latitude', 'longitude']` (`:54-60`); neither mode → `neither address nor coordinates are provided` on `[]` (`:63-67`). Address mode requires non-empty `address.trim()` and omitted lat/lng (`:70-72`); coordinates mode requires both numbers and empty/whitespace address (`:74-76`). Extra JSON properties are stripped by Zod (not rejected): the schema is `z.object` without `.strict()` (`src/places/adapters/find-places-route.ts:28-35`); Zod 3 default is strip (`docs/api.md:84`).

- **Find-places success and validation.** Failed `safeParse` → **400** `{ error: parsedInput.error.issues }` (`src/places/adapters/find-places-route.ts:80-94`). Success maps Nearby place fields (`id`, optional `name` from `displayName.text`, `address` from `formattedAddress`, `phone` from `nationalPhoneNumber`, `types`, `primaryType`) and sets `total` to `places.length` (`:123-132`). Omitted `primaryTypes` is passed as `[]` (`:113`). `websiteUri` is not copied onto the public body (`:124-131`). After a valid body, geocode or Nearby Search failures are caught and rethrown as a placeholder `Error` (`:106-108`, `:116-118`); the route does **not** return documented **502** or opaque **500** JSON. Callers may see Express defaults (often **500**, not JSON) (`docs/api.md:185-187`).

- **JSON body limit.** `express.json({ limit: '32kb' })` in `buildApp` (`src/composition/build-app.ts:15`).

- **Primary type catalog.** HTTP allow-list is `Object.keys(PrimaryTypes)` (`src/places/adapters/find-places-route.ts:34`). Keys on `PrimaryTypes` (`src/places/domain/google-places.ts:262-282`): `automotive`, `business`, `culture`, `education`, `entertainmentAndRecreation`, `facilities`, `finance`, `foodAndDrink`, `geographicalAreas`, `government`, `healthAndWellness`, `housing`, `lodging`, `naturalFeatures`, `placesOfWorship`, `services`, `shopping`, `sports`, `transportation`. Callers send these Primary type keys, not Google strings such as `restaurant` (CONCEPTS **Primary type** / **Primary type catalog**).

**Pointers in sibling Living docs.** Architecture keeps a method/path **role** table and links for fields (`docs/architecture.md:37-44`). README stays how-to-run plus a short feature pointer (XOR, radius max, Primary type keys, 200/`total`, 400 envelope) and links to `docs/api.md` for the field catalog (`README.md:18-83`). Do not duplicate Zod paths, Health out-of-contract notes, or 502/500 live-vs-intent in README.

**When adapters change.** Update `docs/api.md` in the same change (`AGENTS.md:41`). If product intent still differs from the wire, keep the single drift note in `docs/api.md` (`docs/api.md:25-27`); do not restate conflicting JSON in CONCEPTS, architecture, or README.

## Why This Matters

Agents and humans copying HTTP from README or architecture will invent `checks.googlePlaces`, find-places **502** bodies, or Google type strings as `primaryTypes`. Those shapes are product intent or glossary meaning, not the live wire. Callers then debug “wrong docs” as if the service were broken.

A single field-level owner (`docs/api.md`) stops schema drift across Living docs. Product intent can still live in CONCEPTS **Health** / **Upstream unavailability** and in the AGENTS error-mapping recipe so implementers know the *target* mapping (`AGENTS.md:64`) without pretending it is already on the wire.

OpenAPI-*style* markdown is readable in git and in agent context without implying codegen or a second runtime surface. Static docs-only matches this repo’s “no extra HTTP product” boundary.

Documenting live **Health** (`HEAD https://www.google.com`, `{ status }` only) also prevents treating a **200** probe as a Places API auth check — which AGENTS product intent still describes (`AGENTS.md:78`) but `src/health/adapters/google-health.ts:7-8` does not perform.

## When to Apply

- Changing inbound HTTP fields, status codes, or JSON bodies — restate `docs/api.md` in the same change (`AGENTS.md:41`).
- Adding or editing Living docs that mention HTTP — link to `docs/api.md`; do not copy field tables except README’s short how-to pointers.
- Mapping adapter errors while implementing routes — follow AGENTS **400** / **502** / **500** (`AGENTS.md:64`); until those mappings exist on the wire, `docs/api.md` remains the live JSON owner (`AGENTS.md:77`).
- Describing **Health** vs **Upstream unavailability** — use CONCEPTS product meaning; cite `docs/api.md` for live status JSON.
- Describing Nearby place, Request address, Search origin, Primary type, or Primary type catalog — use those CONCEPTS names; put request/response fields only in `docs/api.md`.
- Do **not** apply this pattern to invent OpenAPI YAML, Swagger UI, or new documentation routes. Do **not** “fix” docs by writing intended 502/500 JSON as if live.

## Examples

### Before: method/path table as if it were the field contract

Architecture listed `GET /health` and `POST /find-places` with product roles (Places connectivity/auth; XOR plus radius) and already named XOR-at-400 plus a 400 issue-array body, but not field types, Primary type keys, or `total` (`docs/architecture.md:37-44` now points at `docs/api.md` instead of restating schemas). HEAD README used thin JSON bullets (including a non-live `checks` object), not curl. Readers had no single owner for “what JSON comes back today.”

### After: live OpenAPI-style path + schema, product intent elsewhere

**Health live responses** (`src/health/adapters/health-routes.ts:8-10`):

```json
{ "status": "ok" }
```

**200** when the probe is `'ok'`; **503** `{ "status": "unhealthy" }` otherwise. No `checks` object (`docs/api.md:69-70`).

**Find-places XOR 400** (`src/places/adapters/find-places-route.ts:45-51` and `:91-93`):

```json
{
  "error": [
    {
      "code": "custom",
      "path": ["address"],
      "message": "both address and coordinates are provided"
    }
  ]
}
```

**Find-places 200** includes `total` equal to `places.length` (`src/places/adapters/find-places-route.ts:132`), not a Google result count from another API.

**Upstream unavailability (product, not live).** CONCEPTS still specifies HTTP 502 with an opaque body (`CONCEPTS.md:43-45`). Live catch blocks throw a placeholder Error (`src/places/adapters/find-places-route.ts:106-108`, `:116-118`). Document the live catch in `docs/api.md` Out of contract (`docs/api.md:185-187`); do not paste a 502 JSON example as current behavior.

### Ownership split (same change)

| Concern | Wins |
|---------|------|
| Live request/response fields and status JSON | `docs/api.md` (`AGENTS.md:77`) |
| Adapter error-mapping when implementing | AGENTS numbered recipe (`AGENTS.md:64`) |
| Layers / outbound adapter roles | `docs/architecture.md` |
| Runtime behavior | code + package scripts (`AGENTS.md:77`) |
| Product meaning of Health / Upstream unavailability | `CONCEPTS.md` (with live-wire pointer) |
| How to run + short feature pointer | `README.md` |

### README pointer vs field catalog

README may list Primary type keys and XOR/radius/`total`/400 at a glance (`README.md:39-47`) and must send readers to `docs/api.md` for status codes, XOR validation paths, and live vs intended behavior (`README.md:83`). Do not add a second Zod issue table or Health `checks` example in README.

Merge state: this Living-docs split is in the working tree on `main` as of 2026-08-26 and is uncommitted; do not cite it as merged.

## Related

- [Keep living docs aligned with hexagonal slices](./living-docs-hexagonal-slices.md) — layout/recipe. Already splits product Health vs the current adapter `HEAD https://www.google.com`, but still lists documenting that HEAD probe as an anti-pattern for living-docs *product* text. Complementary, not a merge target; refresh so it names `docs/api.md` as the live field catalog.
- [Restate logger living docs when live Pino product diverges](./restate-logger-living-docs-when-code-diverges.md) — same restatement pattern, different product (logger vs inbound HTTP).
- [Filter nearby search with service-owned primary type categories](../design-patterns/primary-type-category-filters-for-nearby-search.md) — owns Primary type catalog keys; README may list keys, but the field catalog lives only in `docs/api.md`.
- [Prefer Express HTTP adapter over Fastify](../tooling-decisions/express-http-adapter-over-fastify-hexagonal.md) — inbound HTTP is Express + Zod at the route edge; `docs/api.md` is sourced from those adapters.
- [Find-places address XOR skipped Nearby Search](../logic-errors/find-places-address-xor-skipped-nearby-search.md) — live request shape (address XOR coordinates) as current-wire evidence.
