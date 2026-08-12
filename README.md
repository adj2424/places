# TypeScript microservice skeleton

Reusable, domain-agnostic Node.js TypeScript backend starter with slim ports-and-adapters layout, Express HTTP adapter, and an agent coding harness.

## Quick start

```bash
# Remove any orphan node_modules left from prior experiments, then:
cp .env.example .env
npm install
npm run typecheck
npm test
npm run dev
```

Then:

- `GET http://127.0.0.1:3000/health` → `{ "status": "ok", "checks": { "googlePlaces": "ok" } }` when Google Places is reachable (requires `GOOGLE_PLACES_API_KEY` in `.env` for a healthy response)
- `POST http://127.0.0.1:3000/echo` with `{ "message": "hi" }` → `{ "message": "hi" }`
- `POST http://127.0.0.1:3000/find-places` with `{ "latitude": 40.7, "longitude": -74, "radiusMeters": 500 }` → `{ "places": [...] }` (requires `GOOGLE_PLACES_API_KEY` in `.env`)

Copy `.env.example` to `.env` before `npm run dev` — Node `--env-file` fails if `.env` is missing.

## Docs

- **[AGENTS.md](./AGENTS.md)** — how humans and coding agents add features
- **[docs/architecture.md](./docs/architecture.md)** — layer map and boundaries

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run typecheck` | TypeScript check |
| `npm test` | Vitest suite |
| `npm run dev` | Start HTTP server (requires local `.env`) |
