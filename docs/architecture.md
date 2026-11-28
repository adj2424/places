# Architecture

The React and Vite app in `front/` calls the Node.js and Express API in `back/`. Each package has its own npm manifest and lockfile.

How to add a feature: [AGENTS.md](../AGENTS.md). Glossary: [CONCEPTS.md](../CONCEPTS.md).

## Backend

The backend uses a ports-and-adapters (hexagonal) layout.

### Layers

```
HTTP client
    ↓
feature adapters (Express routes under back/src/health/, back/src/places/, …)
    ↓
service / domain (per slice)
    ↓
outbound adapters (Google client, Places Nearby Search, Geocoding)
```

`composition/` loads config, constructs services, and builds the Express app. `main.ts` only listens.

### Dependency rule

- Domain and service layers must not import Express, HTTP types, or client SDKs.
- Adapters depend inward on domain/service ports.
- Outbound Google I/O lives under `back/src/shared/client/` (intended shared client) and slice adapters, wired from `back/src/composition/build-app.ts`.

### Composition root

`buildApp(config, logger)` in `back/src/composition/build-app.ts` is the **single** registration path:

- Process entry: `loadConfig()` → `createLogger` → `buildApp(config, logger)` → `listen`
- Tests: `buildApp(config, logger)` → `supertest(app)` (no listen required)
- Composition binds one Pino child per slice (`component: 'health'` / `'places'`) and passes that child into routes and outbound adapters. Adapters may create further children.

Do not re-register routes differently in tests.

### HTTP surface (v1)

Field-level request/response contract (live adapters): **[api.md](./api.md)**.

| Method | Path | Role |
|--------|------|------|
| `GET` | `/health` | Process reachability plus Google Places connectivity/auth (**product** intent); live JSON and probe behavior are in [api.md](./api.md) |
| `POST` | `/find-places` | Nearby search from coordinates or a request address (XOR) plus `radiusMeters`; validation at the HTTP edge |

Adapter error-mapping (**400** validation / unmatched geocode, **502** upstream unavailability, **500** unexpected) is applied on `POST /find-places` from domain error types. Health **503** is the probe unhealthy signal; it is distinct from find-places upstream unavailability.

### Outbound adapters

| Adapter | Location | Role |
|---------|----------|------|
| Google HTTP client | `back/src/shared/client/client.ts` | Shared `fetch` + API key + field mask (GET/POST) |
| Google Places nearby search | `back/src/places/adapters/google.ts` | `searchNearby` for find-places |
| Google Geocoding v3 | `back/src/places/adapters/geocoding.ts` | Resolves a request address to the search origin using `GOOGLE_GEOCODING_BASE_URL` |
| Google Places health ping | `back/src/health/adapters/google-health.ts` | **Intended product:** Place Details GET for `/health` connectivity/auth. **Live today:** `HEAD https://www.google.com` — see [api.md](./api.md) |

Composition wires health and find-places services in `buildApp`.

Validation for find-places lives at the HTTP edge (Zod).

### Testing

- Service / domain: direct unit tests
- HTTP: `supertest` through `buildApp(config, logger)`
- Tests must not require a real Google key or a committed `.env`

### Config

Zod-validated config in `back/src/composition/config.ts` (`PORT`, `CORS_ORIGIN`, `LOG_LEVEL`, `GOOGLE_API_KEY`, `GOOGLE_PLACES_BASE_URL`, `GOOGLE_GEOCODING_BASE_URL`). Read environment values in that module. Use `back/.env.example` to create the gitignored `back/.env`. Address mode needs Geocoding API enabled on the same `GOOGLE_API_KEY`. `npm test` does not require a Google key.

### Health probe notes

**Intended product** (not necessarily live — see [api.md](./api.md)):

- Every `/health` request performs a live Google Places connectivity/auth check (no cache in v1).
- Missing or invalid API key yields unhealthy `/health`.
- Place Details must be enabled for the same Google Cloud project/key as Nearby Search; otherwise health may report fail while other APIs work.
- Health does not probe Geocoding. A Places-restricted key can leave geo mode and `/health` succeeding while address mode fails.

## Frontend

```
front/src/main.tsx          React entry
    ↓
front/src/App.tsx           search state, request generation, panel layout
    ├─ front/src/search/    address or coordinates, radius, category selection
    ├─ front/src/places/    POST /find-places client, types, category catalog
    ├─ front/src/map/       Leaflet search area and Nominatim display geocode
    └─ front/src/results/   results, API call count, and failure states
```

The search form sends either coordinates or a trimmed address. It accepts a radius from 1 to 50,000 meters and sends category keys from the Places catalog. The browser fetches the API at `VITE_PLACES_BASE_URL` or `http://127.0.0.1:3001`. The backend allows the Vite origin through CORS. See [README.md](../README.md) for setup and [api.md](./api.md) for JSON fields.

A coordinate search uses its coordinates to center the map immediately. In address mode, `App` sends the address to Places for search and runs Nominatim in parallel for the display origin. A Nominatim miss can show a map notice while results still appear. The generation guard ignores stale responses from both requests. The lazy-loaded map fits the origin marker and radius circle to the search area.

The results panel handles idle, loading, successful, invalid-address, too-many-types, and retryable failure states. An empty 200 is a success. It displays `googlePlacesApiCalls` when present and uses the returned place ID for Google Maps links. Place rows have no coordinates.

Panel styles use Tailwind utilities on the JSX. Theme tokens and the Tailwind entry live in `front/src/index.css`. Leaflet CSS loads with the map module. Frontend tests live alongside the code.

## Historical documents

[Plans](./plans/) and [solutions](./solutions/) preserve decisions from both packages. Paths and operating assumptions in older snapshots refer to the layout in use when they were written.
