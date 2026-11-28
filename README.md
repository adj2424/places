# Places

Nearby Explorer searches for places without websites from an address or your current location. It shows the search area, result listings, and the number of Google Nearby Search calls.

- `front/` contains the React and Vite browser app.
- `back/` contains the Node.js and Express API.

## Backend quick start

Use Node.js 22.22.2 or later on the Node 22 line to run both packages, including the frontend test dependencies.

```bash
cd back
cp .env.example .env
npm install
npm run typecheck
npm test
npm run dev
```

Copy `.env.example` to `.env` before `npm run dev` — Node `--env-file` fails if `.env` is missing. Set `GOOGLE_API_KEY` and the Google base URLs in `.env` for find-places (and for process startup).

## Frontend quick start

From the repository root, start the API using the backend steps above. In a second terminal, run:

```bash
cd front
npm install
npm run dev
```

Open http://localhost:3000. Vite uses port **3000** and the browser calls the API directly at `http://127.0.0.1:3001`. The API allows `http://localhost:3000` through CORS by default. If you open the UI at a different origin, set `CORS_ORIGIN` in `back/.env` to that exact origin and restart the API.

Set `VITE_PLACES_BASE_URL` when the API uses a different URL. Run frontend checks from `front/` with `npm test`, `npm run lint`, and `npm run build`. The build runs TypeScript and produces the Vite bundle.

## HTTP API

Base URL: `http://127.0.0.1:3001` (default `PORT`). No authentication. Full field reference: **[docs/api.md](./docs/api.md)**.

### `GET /health`

Liveness probe with a live outbound check on every request.

| Status | Body |
|--------|------|
| **200** | `{ "status": "ok" }` |
| **503** | `{ "status": "unhealthy" }` |

```bash
curl -s http://127.0.0.1:3001/health
```

### `POST /find-places`

Nearby search from Google Places. Send JSON with `Content-Type: application/json`.

**Key behavior**

- **Two location modes (pick one):** coordinates (`latitude` + `longitude`) **or** a request `address` string — not both.
- **`radiusMeters` required:** positive number, max **50000** meters.
- **`primaryTypes` optional:** filter by this service's category keys (not Google type strings like `restaurant`). Allowed values:

  `automotive`, `business`, `culture`, `education`, `entertainmentAndRecreation`, `facilities`, `finance`, `foodAndDrink`, `geographicalAreas`, `government`, `healthAndWellness`, `housing`, `lodging`, `naturalFeatures`, `placesOfWorship`, `services`, `shopping`, `sports`, `transportation`
- **200 response:** `{ "places": [...], "total": <n>, "googlePlacesApiCalls": <n> }` — each place has `id` plus optional `name`, `address`, `phone`, `types`, `primaryType`.
- **400 validation:** `{ "error": [ ... ] }` when the body fails Zod checks at the HTTP edge.

**Coordinates example**

```bash
curl -s -X POST http://127.0.0.1:3001/find-places \
  -H "Content-Type: application/json" \
  -d '{"latitude":40.7,"longitude":-74,"radiusMeters":500,"primaryTypes":["foodAndDrink"]}'
```

**Address example**

```bash
curl -s -X POST http://127.0.0.1:3001/find-places \
  -H "Content-Type: application/json" \
  -d '{"address":"1600 Amphitheatre Parkway, Mountain View, CA","radiusMeters":1000}'
```

**Sample 200 body**

```json
{
  "places": [
    {
      "id": "ChIJN1t_tDeuEmsRUsoyG83frY4",
      "name": "Example Cafe",
      "address": "123 Main St",
      "phone": "+1 212-555-0100",
      "types": ["cafe", "food"],
      "primaryType": "cafe"
    }
  ],
  "total": 1,
  "googlePlacesApiCalls": 1
}
```

For status codes, XOR rules, and live vs intended behavior, see **[docs/api.md](./docs/api.md)**.

## Docs

- **[docs/api.md](./docs/api.md)** — HTTP API reference (request/response fields, status codes, examples)
- **[AGENTS.md](./AGENTS.md)** — how humans and coding agents add features
- **[docs/architecture.md](./docs/architecture.md)** — layer map and boundaries
- **[CONCEPTS.md](./CONCEPTS.md)** — shared vocabulary

## Backend scripts

Run these from `back/`.

| Script | Purpose |
|--------|---------|
| `npm run typecheck` | TypeScript check |
| `npm test` | Vitest suite |
| `npm run dev` | Start HTTP server (requires local `.env`) |
