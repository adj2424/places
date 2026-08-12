# Architecture

Slim ports-and-adapters (hexagonal) layout for a Node 22+ TypeScript microservice.

## Layers

```
HTTP client
    ↓
feature adapters (Express routes under src/health/, src/places/, …)
    ↓
service / domain (per vertical slice)
    ↓
outbound adapters (Google client, Places API)
```

`composition/` loads config, constructs services, and builds the Express app. `main.ts` only listens.

## Dependency rule

- Domain and service layers must not import Express, HTTP types, or client SDKs.
- Adapters depend inward on domain/service ports.
- Outbound Google I/O lives under `src/shared/client/` and `src/places/adapters/`, wired from `src/composition/build-app.ts`.

## Composition root

`buildApp(deps)` in `src/composition/build-app.ts` is the **single** registration path:

- Process entry: `loadConfig()` → `buildApp` → `listen`
- Tests: `buildApp` → `supertest(app)` (no listen required)

Do not re-register routes differently in tests.

## HTTP surface (v1)

| Method | Path | Role |
|--------|------|------|
| `GET` | `/health` | Process + Google Places connectivity/auth (`{ "status": "ok" \| "unhealthy", "checks": { "googlePlaces": "ok" \| "fail" } }`); returns **503** when Google Places check fails |
| `POST` | `/find-places` | Nearby no-website search — body `{ "latitude", "longitude", "radiusMeters" }` |

## Outbound adapters

| Adapter | Location | Role |
|---------|----------|------|
| Google HTTP client | `src/shared/client/client.ts` | Shared `fetch` + API key + field mask (GET/POST) |
| Google Places nearby search | `src/places/adapters/google.ts` | `searchNearby` for find-places |
| Google Places health ping | `src/places/adapters/google-health.ts` | Place Details GET for `/health` connectivity/auth |

Composition wires health and find-places services in `buildApp`.

Validation for find-places lives at the HTTP edge (Zod).

## Testing

- Service / domain: direct unit tests
- HTTP: `supertest` through `buildApp`
- Inject stub health check and Places service so tests do not require a real Google key

## Config

Zod-validated config in `src/composition/config.ts` (`PORT`, `LOG_LEVEL`, optional `GOOGLE_PLACES_API_KEY`, `GOOGLE_BASE_URL`). Ban raw `process.env` outside that module. Ship `.env.example`; keep `.env` gitignored. `npm test` does not require a Google key.

## Health probe notes

- Every `/health` request performs a live Place Details ping (no cache in v1).
- Missing or invalid API key yields unhealthy `/health`.
- Place Details must be enabled for the same Google Cloud project/key as Nearby Search; otherwise health may report fail while other APIs work.
