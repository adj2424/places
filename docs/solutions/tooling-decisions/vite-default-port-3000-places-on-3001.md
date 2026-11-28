---
title: Vite listens on 3000; Places client defaults to 3001
date: 2026-08-26
category: tooling-decisions
module: vite-places
problem_type: tooling_decision
component: tooling
severity: medium
applies_when:
  - "This SPA must listen on port 3000 by default"
  - "Places and Vite must not share the same local port"
related_components:
  - "documentation"
  - "development_workflow"
tags:
  - "vite"
  - "strict-port"
  - "places-base-url"
  - "local-dev"
  - "cors"
---

# Vite listens on 3000; Places client defaults to 3001

## Context

This frontend talks to the sibling Places service with browser `fetch`. It does not add a Vite proxy (`README.md:5`). Two processes therefore need two TCP ports, plus a CORS path from the page origin to the API origin.

As of this writing the split lives in the **working tree**, not a merged PR: Vite 8 (`package.json:38`) `defineConfig` binds the UI at `server.port` 3000 with `strictPort: true` (`vite.config.ts:11-14`). The Places client default is `http://127.0.0.1:3001` (`src/places/find-places-client.ts:7`). Colocated tests assert that origin on the POST URL (`src/places/find-places-client.test.ts:49-51`). README tells operators to start Places with `PORT=3001`, enable CORS so `http://127.0.0.1:3000` can fetch `http://127.0.0.1:3001`, and documents a PowerShell `$env:PORT` equivalent (`README.md:9-16`, `README.md:18`, `README.md:27`).

This repo does not own Places’ listen fallback. A sibling checkout at `../places` currently uses `env.PORT ?? 3001` (`../places/src/composition/config.ts:38`) and documents `http://127.0.0.1:3001` (`../places/README.md:20`). This frontend’s README still hedges that Places “may still be 3000” (`README.md:9`) for older checkouts or a `.env` that sets `PORT=3000`.

Living docs vs snapshots: `CONCEPTS.md` names README, AGENTS.md, `docs/architecture.md`, and the glossary as the current contract; older plans and solution writeups are snapshots (`CONCEPTS.md:7-14`). Port numbers in a snapshot plan are not the operating recipe if the live tree or README disagrees.

## Guidance

Keep three facts aligned:

1. **UI origin.** Vite listens on 3000 and will not silently pick another port (`vite.config.ts:12-13`). If 3000 is taken, the dev server fails instead of drifting.
2. **API origin.** With no `VITE_PLACES_BASE_URL`, `resolveBaseUrl()` returns `DEFAULT_BASE_URL` (`src/places/find-places-client.ts:7-14`). `findPlaces` POSTs to that base plus `/find-places` (`src/places/find-places-client.ts:60`).
3. **Operator loop.** Start Places on 3001 first (`README.md:9-16`), CORS-allow the Vite origin (`README.md:18`), then `npm run dev` (`README.md:20-25`). Optional env override is only for a Places URL that is **not** `http://127.0.0.1:3001` (`README.md:27`).

Do not introduce a Vite proxy to hide CORS (`README.md:5`). Do not set `VITE_PLACES_BASE_URL` to `http://127.0.0.1:3000` while the UI occupies 3000: `fetch` would hit this SPA, not Places (`src/places/find-places-client.ts:9-12`, `src/places/find-places-client.ts:60`). README states that prohibition (`README.md:27`). Env override only changes the fetch URL; it does not bind a second listener.

Treat README and the live client/config as source for how to run. Snapshot plans under `docs/plans/` are history (`CONCEPTS.md:12-14`).

## Why This Matters

On `HEAD` this SPA used Vite’s implicit 5173 (no `server` block) and a Places client default of `:3000`. Putting Vite on 3000 **without** moving the client off 3000 would have made `fetch` hit this SPA, or failed with `EADDRINUSE` if Places still held 3000. Binding the UI to 3000 with `strictPort` keeps the CORS origin stable. Matching the **client default** to `:3001` aims `findPlaces` at Places instead of the Vite process.

If someone overrides the client to `:3000` while Vite owns 3000, searches fail in a confusing way (HTML/SPA from Vite instead of JSON). A Places **process** still on 3000 plus Vite `strictPort` is a bind clash (`Port 3000 is already in use`), not an env-override miss. Tests that pin `http://127.0.0.1:3001/find-places` (`src/places/find-places-client.test.ts:49-51`) catch a default-URL regression; they do not catch a bad operator env pointing at 3000.

## When to Apply

- Running this app locally against sibling Places.
- Changing `vite.config.ts` `server` options, `DEFAULT_BASE_URL`, or `VITE_PLACES_BASE_URL` docs.
- Debugging “Failed to fetch”, HTML error pages from `findPlaces`, or CORS errors between 3000 and 3001.
- Reviewing unmerged working-tree port/CORS work (this split is pending until committed/merged).
- Writing or reading snapshot plans: prefer living README plus the tree over plan units for ports.

## Examples

**Pending working-tree defaults (not a PR).** Vite:

```ts
// vite.config.ts:11-14
server: {
  port: 3000,
  strictPort: true,
},
```

Client default and env trim (`src/places/find-places-client.ts:7-14`):

```ts
const DEFAULT_BASE_URL = 'http://127.0.0.1:3001'

function resolveBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_PLACES_BASE_URL
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.replace(/\/$/, '')
  }
  return DEFAULT_BASE_URL
}
```

Test pin (`src/places/find-places-client.test.ts:49-51`):

```ts
expect(fetchMock.mock.calls[0]?.[0]).toBe(
  'http://127.0.0.1:3001/find-places',
)
```

**Operator: Places on 3001, UI on 3000.** From README (`README.md:9-16`): `cd ../places` then `PORT=3001 npm run dev`; PowerShell: `cd ../places; $env:PORT='3001'; npm run dev`. Then CORS for `http://127.0.0.1:3000` → `http://127.0.0.1:3001` (`README.md:18`), then this repo’s `npm run dev`.

**Anti-pattern: env to 3000 while Vite binds 3000.** `VITE_PLACES_BASE_URL=http://127.0.0.1:3000` does not occupy a port; `fetch` targets the Vite origin and gets the SPA (`src/places/find-places-client.ts:9-12`). README forbids pointing the env at 3000 while the app is on 3000 (`README.md:27`). If a Places process is already on 3000, Vite with `strictPort: true` (`vite.config.ts:13`) fails to bind.

**Living vs snapshot.** If a snapshot still teaches Places-on-3000 and Vite-on-5173, ignore it for operations; living README plus `CONCEPTS.md:7-9` win.

## Related

- GitHub issue search skipped (`gh` not available).
- No overlapping `docs/solutions/` learning (existing Leaflet `getBounds` writeup is a different problem).
