# Places service — HTTP API (v1)

OpenAPI-style reference for the **live** inbound HTTP surface. Source of truth: `src/health/adapters/health-routes.ts`, `src/health/adapters/google-health.ts`, and `src/places/adapters/find-places-route.ts`.

Layer map and outbound adapters: [architecture.md](./architecture.md). Glossary: [CONCEPTS.md](../CONCEPTS.md).

## Info

| Field | Value |
|-------|-------|
| Title | Places service HTTP API |
| Version | v1 |
| Authentication | None |
| Content-Type | `application/json` for `POST /find-places` |
| JSON body limit | 32 KiB (`express.json` in `buildApp`) |

## Servers

| URL | Notes |
|-----|-------|
| `http://127.0.0.1:{PORT}` | Default `PORT` is **3000** (`src/composition/config.ts`). The process listens on all interfaces; `127.0.0.1` is the usual local caller convention. |

Process startup requires `GOOGLE_API_KEY`, `GOOGLE_PLACES_BASE_URL`, and `GOOGLE_GEOCODING_BASE_URL` (see `.env.example`). Missing config prevents listen; that is not an HTTP response.

## Living-docs drift

Product docs (CONCEPTS **Health** / **Upstream unavailability**, AGENTS adapter error-mapping recipe, architecture **role** rows) describe intended Google Places connectivity/auth and mapped **400** / **502** / **500** find-places errors. **This file documents what the running process returns today.** When they differ, trust this file for request/response JSON and status bodies.

---

## Paths

### `GET /health`

Liveness-style probe. Runs a live outbound check on every request (no cache).

**Operation:** healthCheck

**Outbound probe (live):** `HEAD https://www.google.com`. Does not use `GOOGLE_API_KEY` or Google Places APIs. A **200** here does **not** guarantee find-places will succeed.

#### Responses

| Status | Body | When |
|--------|------|------|
| **200** | `{ "status": "ok" }` | Probe returned an HTTP 2xx |
| **503** | `{ "status": "unhealthy" }` | Probe completed with a non-2xx status |

**Example — healthy**

```http
GET /health HTTP/1.1
Host: 127.0.0.1:3000
```

```json
{
  "status": "ok"
}
```

**Example — unhealthy**

```json
{
  "status": "unhealthy"
}
```

#### Out of contract

- No `checks` object (e.g. `googlePlaces`) in the live response.
- If `fetch` throws (network error), Express default error handling applies — not the JSON shapes above.

---

### `POST /find-places`

Nearby search centered on a **search origin**: caller coordinates or a geocoded **request address** (see [CONCEPTS.md](../CONCEPTS.md)). Returns places mapped from Google Nearby Search.

**Operation:** findPlaces

#### Request body

Exactly one **location mode** is required, plus `radiusMeters`. Extra JSON properties are stripped by Zod (not rejected).

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `radiusMeters` | number | yes | Finite, **positive**, maximum **50000** |
| `latitude` | number | coordinates mode | Finite, **−90** to **90** |
| `longitude` | number | coordinates mode | Finite, **−180** to **180** |
| `address` | string | address mode | Non-empty after `trim()`; must not be sent with `latitude` / `longitude` |
| `primaryTypes` | string[] | no | Each element must be a [primary type catalog](#primarytype) key |

**Location modes (XOR)**

| Mode | Body shape |
|------|------------|
| **Coordinates** | `latitude`, `longitude`, `radiusMeters`; `address` absent or whitespace-only |
| **Request address** | non-empty `address`, `radiusMeters`; `latitude` and `longitude` omitted |

**Custom validation messages** (Zod `superRefine`):

| Condition | `message` | `path` |
|-----------|-----------|--------|
| Both address and coordinates | `both address and coordinates are provided` | `["address"]` |
| Only one of lat/lng | `either address or coordinates are required` | `["latitude", "longitude"]` |
| Neither mode | `neither address nor coordinates are provided` | `[]` |

Standard Zod issues (type, range, unknown `primaryTypes` key, etc.) use default Zod `message` / `path` values.

#### Responses

| Status | Body | When |
|--------|------|------|
| **200** | [FindPlacesResponse](#findplacesresponse) | Valid body; Nearby Search completed |
| **400** | `{ "error": <Zod issue array> }` | Request failed Zod `safeParse` (no Google call) |

**Example — coordinates mode**

```http
POST /find-places HTTP/1.1
Host: 127.0.0.1:3000
Content-Type: application/json

{
  "latitude": 40.7,
  "longitude": -74,
  "radiusMeters": 500,
  "primaryTypes": ["foodAndDrink"]
}
```

```json
{
  "places": [
    {
      "id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
      "name": "Example Cafe",
      "address": "123 Main St, New York, NY",
      "phone": "+1 212-555-0100",
      "types": ["cafe", "food", "point_of_interest"],
      "primaryType": "cafe"
    }
  ],
  "total": 1
}
```

Optional place fields are omitted when Google omitted them. `website` / `websiteUri` is **not** exposed on the public body.

**Example — address mode**

```json
{
  "address": "1600 Amphitheatre Parkway, Mountain View, CA",
  "radiusMeters": 1000
}
```

The server geocodes the request address, uses the **first** geocode result as the search origin, then runs Nearby Search. Callers do not receive resolved coordinates in the response.

**Example — validation error (400)**

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

Issue objects follow [Zod's `ZodIssue`](https://zod.dev) shape (`code`, `path`, `message`, and other fields Zod may include).

#### Behavior notes (live)

- **`total`:** Count of items in `places` (same length as the array).
- **`primaryTypes` omitted:** Passed to the service as `[]` (empty `includedPrimaryTypes` on the Google request).
- **Website filter:** Not applied today — places with a website may appear in results.
- **Paging:** Single Nearby Search call; no client paging parameter.

#### Out of contract

After a **valid** body, Geocoding or Nearby Search failures are caught and rethrown as an internal placeholder error. The route does **not** return documented **502** or opaque **500** JSON. Callers may see Express default errors (often **500**, not JSON). Wrong HTTP method, unknown paths, oversize body, and malformed JSON are handled by Express/middleware — not the Zod **400** envelope.

---

## Components (schemas)

### HealthStatus

| Value | Meaning |
|-------|---------|
| `"ok"` | Health probe succeeded |
| `"unhealthy"` | Health probe failed |

Serialized as `{ "status": HealthStatus }` only.

### FindPlacesRequest

See [request body](#request-body) table. TypeScript name in route: `FindPlacesRequest`.

### FindPlacesResponse

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `places` | [NearbyPlace](#nearbyplace)[] | yes | Results (may be empty) |
| `total` | number | yes | `places.length` |

### NearbyPlace

Public mapping from Google Nearby Search (website field excluded).

| Field | Type | Required | Source (Google) |
|-------|------|----------|-----------------|
| `id` | string | yes | Place id |
| `name` | string | no | `displayName.text` |
| `address` | string | no | `formattedAddress` — display on a **nearby place**, not the request **address** field |
| `phone` | string | no | `nationalPhoneNumber` |
| `types` | string[] | no | `types` |
| `primaryType` | string | no | Google's classification for that place — not the same as request [Primary type](#primarytype) keys |

### ZodErrorBody

| Field | Type | Description |
|-------|------|-------------|
| `error` | array | Zod validation issues |

### PrimaryType

Request-time category keys (this service's catalog). Send these keys in `primaryTypes`, not Google type strings such as `restaurant`.

Allowed values (from `PrimaryTypes` in `src/places/domain/google-places.ts`):

`automotive`, `business`, `culture`, `education`, `entertainmentAndRecreation`, `facilities`, `finance`, `foodAndDrink`, `geographicalAreas`, `government`, `healthAndWellness`, `housing`, `lodging`, `naturalFeatures`, `placesOfWorship`, `services`, `shopping`, `sports`, `transportation`
