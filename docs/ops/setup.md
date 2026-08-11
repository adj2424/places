# Setup and operations

## Prerequisites

- **Node.js** ≥ 22 (`package.json` `engines`)
- **Google Maps Platform** — Places API (New) and Geocoding API enabled; billing alert recommended before first live sweep
- **Supabase** — project with PostGIS enabled for coverage geometry

## Environment

Copy `.env.example` to `.env` and fill required values:

| Variable | Required | Notes |
|----------|----------|-------|
| `GOOGLE_MAPS_API_KEY` | Yes | Places + Geocoding |
| `SUPABASE_URL` | Yes | |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side only |

Optional sweep, response, freshness, probe, and server settings are documented inline in `.env.example` with defaults.

## Scripts

Only these npm scripts exist today (`package.json`):

| Script | Purpose |
|--------|---------|
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest (unit tests) |
| `npm run test:watch` | Vitest watch mode |
| `npm run lint:arch` | Hexagonal dependency-direction check |
| `npm run dev` | `tsx src/main.ts` — loads config and logs redacted settings |

There is **no** `smoke` script yet; do not document one until it exists in `package.json`.

## Local run

```bash
npm install
cp .env.example .env   # then edit
npm run dev
```

`main.ts` currently resolves configuration only; adapters and HTTP are wired as lead-finder units land.

## Continuing implementation

See [implementation status](../status/implementation.md) for unit-by-unit progress against the lead-finder plan.
