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

Field-level request/response contract (live adapters): **[api.md](./api.md)**.

| Method | Path | Role |
|--------|------|------|
| `GET` | `/health` | Process reachability plus Google Places connectivity/auth (**product** intent); live JSON and probe behavior are in [api.md](./api.md) |
| `POST` | `/find-places` | Nearby search from coordinates or a request address (XOR) plus `radiusMeters`; validation at the HTTP edge |

Adapter error-mapping (**400** validation / unmatched geocode, **502** upstream unavailability, **500** unexpected) is applied on `POST /find-places` from domain error types. Health **503** is the probe unhealthy signal; it is distinct from find-places upstream unavailability.

## Outbound adapters

| Adapter | Location | Role |
|---------|----------|------|
| Google HTTP client | `src/shared/client/client.ts` | Shared `fetch` + API key + field mask (GET/POST) |
| Google Places nearby search | `src/places/adapters/google.ts` | `searchNearby` for find-places |
| Google Geocoding v3 | `src/places/adapters/geocoding.ts` | Address → unique lat/lng origin for find-places address mode; hardcoded `maps.googleapis.com` (does not use `GOOGLE_BASE_URL`) |
| Google Places health ping | `src/health/adapters/google-health.ts` | **Intended product:** Place Details GET for `/health` connectivity/auth. **Live today:** `HEAD https://www.google.com` — see [api.md](./api.md) |

Composition wires health and find-places services in `buildApp`.

Validation for find-places lives at the HTTP edge (Zod).

## Testing

- Service / domain: direct unit tests
- HTTP: `supertest` through `buildApp(config, logger)`
- Tests must not require a real Google key or a committed `.env`

## Config

Zod-validated config in `src/composition/config.ts` (`PORT`, `LOG_LEVEL`, `GOOGLE_API_KEY`, `GOOGLE_BASE_URL`). Ban raw `process.env` outside that module. Ship `.env.example`; keep `.env` gitignored. `GOOGLE_BASE_URL` is the Places host only; Geocoding uses a hardcoded Maps host. Address mode needs Geocoding API enabled on the same `GOOGLE_API_KEY`. `npm test` does not require a Google key.

## Health probe notes

**Intended product** (not necessarily live — see [api.md](./api.md)):

- Every `/health` request performs a live Google Places connectivity/auth check (no cache in v1).
- Missing or invalid API key yields unhealthy `/health`.
- Place Details must be enabled for the same Google Cloud project/key as Nearby Search; otherwise health may report fail while other APIs work.
- Health does not probe Geocoding. A Places-restricted key can leave geo mode and `/health` succeeding while address mode fails.
