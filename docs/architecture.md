# Architecture

Slim ports-and-adapters (hexagonal) layout for a Node 22+ TypeScript Places service.

How to add a feature: [AGENTS.md](../AGENTS.md). Glossary: [CONCEPTS.md](../CONCEPTS.md).

## Layers

```
HTTP client
    ↓
feature adapters (Express routes under src/health/, src/places/, …)
    ↓
service / domain (per slice)
    ↓
outbound adapters (Google client, Places Nearby Search, Geocoding)
```

`composition/` loads config, constructs services, and builds the Express app. `main.ts` only listens.

## Dependency rule

- Domain and service layers must not import Express, HTTP types, or client SDKs.
- Adapters depend inward on domain/service ports.
- Outbound Google I/O lives under `src/shared/client/` (intended shared client) and slice adapters, wired from `src/composition/build-app.ts`.

## Composition root

`buildApp(config, logger)` in `src/composition/build-app.ts` is the **single** registration path:

- Process entry: `loadConfig()` → `createLogger` → `buildApp(config, logger)` → `listen`
- Tests: `buildApp(config, logger)` → `supertest(app)` (no listen required)
- Composition binds one Pino child per slice (`component: 'health'` / `'places'`) and passes that child into routes and outbound adapters. Adapters may create further children.

Do not re-register routes differently in tests.

## HTTP surface (v1)

| Method | Path | Role |
|--------|------|------|
| `GET` | `/health` | Process + Google Places connectivity/auth (`{ "status": "ok" \| "unhealthy", "checks": { "googlePlaces": "ok" \| "fail" } }`); returns **503** when Google Places check fails |
| `POST` | `/find-places` | Nearby no-website search. Geo mode: `{ "latitude", "longitude", "radiusMeters" }` with no request address. Address mode: non-empty `"address"` plus `"radiusMeters"` (no lat/lng); geocodes then Nearby Search. Mixed or neither is **400** |

Find-places HTTP errors (distinct from health **503**):

| Status | When |
|--------|------|
| **400** | Invalid caller body: Zod at the HTTP edge (no Google call), or unmatched/ambiguous/partial geocode after Geocoding — `{ "error": issue array }` |
| **502** | Upstream unavailability (Places or Geocoding 5xx, timeout, network; Geocoding `OVER_QUERY_LIMIT` / `UNKNOWN_ERROR`) — opaque `{ "error": "places search unavailable" }` |
| **500** | Unexpected failures (bugs, Places 4xx, malformed Places 2xx, Geocoding `REQUEST_DENIED` / `OVER_DAILY_LIMIT` / unlisted status / missing location) — same opaque body as 502 |

Do not echo Google's status to callers. Health **503** stays the probe's unhealthy signal; it is not the find-places unavailability status.

## Outbound adapters

| Adapter | Location | Role |
|---------|----------|------|
| Google HTTP client | `src/shared/client/client.ts` | Shared `fetch` + API key + field mask (GET/POST) |
| Google Places nearby search | `src/places/adapters/google.ts` | `searchNearby` for find-places |
| Google Geocoding v3 | `src/places/adapters/geocoding.ts` | Address → unique lat/lng origin for find-places address mode; hardcoded `maps.googleapis.com` (does not use `GOOGLE_BASE_URL`) |
| Google Places health ping | `src/health/adapters/google-health.ts` | Place Details GET for `/health` connectivity/auth |

Composition wires health and find-places services in `buildApp`.

Validation for find-places lives at the HTTP edge (Zod).

## Testing

- Service / domain: direct unit tests
- HTTP: `supertest` through `buildApp(config, logger)`
- Tests must not require a real Google key or a committed `.env`

## Config

Zod-validated config in `src/composition/config.ts` (`PORT`, `LOG_LEVEL`, `GOOGLE_API_KEY`, `GOOGLE_BASE_URL`). Ban raw `process.env` outside that module. Ship `.env.example`; keep `.env` gitignored. `GOOGLE_BASE_URL` is the Places host only; Geocoding uses a hardcoded Maps host. Address mode needs Geocoding API enabled on the same `GOOGLE_API_KEY`. `npm test` does not require a Google key.

## Health probe notes

- Every `/health` request performs a live Place Details ping (no cache in v1).
- Missing or invalid API key yields unhealthy `/health`.
- Place Details must be enabled for the same Google Cloud project/key as Nearby Search; otherwise health may report fail while other APIs work.
- Health does not probe Geocoding. A Places-restricted key can leave geo mode and `/health` succeeding while address mode fails.
