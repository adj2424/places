# AGENTS.md

Portable coding harness for humans and agents. This file is authoritative for how to work in this repo.

## Commands

Run backend commands from `back/`.

```bash
cd back
cp .env.example .env   # once, before first `dev`
npm install            # from committed package.json / package-lock.json only
npm run typecheck
npm test
npm run dev
```

`typecheck` and `test` must not require a committed `.env`. `dev` requires a local `.env` (gitignored).

Run frontend commands from `front/`.

```bash
cd front
npm install
npm run dev
npm test
npm run lint
npm run build
```

The frontend build includes `tsc -b`. It has no separate `typecheck` script. See [README.md](./README.md) for running both processes and configuring CORS.

## Backend architecture map

| Concern                              | Location                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Health slice                         | `back/src/health/`                                                                                                                                                                         |
| Places slice                         | `back/src/places/`                                                                                                                                                                         |
| Shared Google HTTP client (intended) | `back/src/shared/client/`                                                                                                                                                                  |
| Shared logging                       | `back/src/shared/logging/`                                                                                                                                                                 |
| Config + `buildApp` wiring           | `back/src/composition/`                                                                                                                                                                    |
| Process listen entry                 | `back/src/main.ts`                                                                                                                                                                         |
| HTTP API reference (live fields)     | `docs/api.md`                                                                                                                                                                         |
| Documented solutions                 | `docs/solutions/` — past problems and patterns organized by category with YAML frontmatter (`module`, `tags`, `problem_type`); snapshots. Living docs plus composition win on layout. |
| Shared vocabulary                    | `CONCEPTS.md`                                                                                                                                                                         |
| Tests                                | `back/tests/<slice>/` for service/domain; HTTP via `supertest` and `buildApp(config, logger)`                                                                                              |

Dependency rule: `domain` and `service` never import Express or other adapter SDKs. HTTP is an inbound adapter only. Layers, HTTP surface, outbound adapters, and config: [docs/architecture.md](./docs/architecture.md).

## Backend rules

**Always**

- Add features as domain → service → adapters → `buildApp`.
- Run `typecheck` and existing `test` before claiming done.
- Update this file in the same change if layout or scripts change.
- When inbound HTTP fields, status codes, or JSON bodies change, restate `docs/api.md` in the same change.
- Bind locally by default (`HOST=127.0.0.1`); do not log request bodies by default.

**Ask first**

- Adding additional outbound ports beyond the approved Google Places Nearby Search and Geocoding adapters, persistence, auth, queues, or deploy tooling.
- Exposing the service beyond local use (needs a follow-up auth plan).
- Creating, expanding, or rewriting tests.

**Never**

- Create, add, expand, or rewrite test files unless the user explicitly asked for tests in that request. Help means change production code; do not “complete” the work with a new test.
- Put Express / HTTP types in `domain` or `service`.
- Invent empty `repository` / persistence folders “for later.”
- Rely on `.cursor/rules` or chat history as the source of truth.
- Treat orphan `node_modules` or leftover `.env` secrets as the project stack — install from committed manifests only.

## Add a backend feature

New functions live under `back/src/<name>/{domain,service,adapters}/`. Point at both `back/src/health/` and `back/src/places/` as examples — there is no single copy-me feature.

1. Domain — types / invariants under `back/src/<name>/domain/` (no framework imports).
2. Service — use case under `back/src/<name>/service/` calling domain only.
3. Adapters — inbound HTTP and outbound I/O under `back/src/<name>/adapters/` (validate at the HTTP edge; map domain errors there: **400** validation, **502** upstream unavailability, **500** unexpected).
4. Composition — register inside `buildApp` in `back/src/composition/build-app.ts` (same factory used by `back/src/main.ts` and tests: `buildApp(config, logger)`).
5. Tests — only if the user asked. Service/domain under `back/tests/<name>/`; HTTP via `supertest` and `buildApp(config, logger)`.
6. Verify — `npm run typecheck` and `npm test` (run existing tests; do not add new ones to make this step exist).

Exemplar references:

- Health: `back/src/health/domain/`, `back/src/health/service/`, `back/src/health/adapters/`
- Places: `back/src/places/domain/`, `back/src/places/service/`, `back/src/places/adapters/`
- Wiring: `back/src/composition/build-app.ts`

## Frontend architecture and rules

| Concern | Location |
| --- | --- |
| Search form and request body | `front/src/search/` |
| Places browser client, types and category catalog | `front/src/places/` |
| Search-area map and display geocoding | `front/src/map/` |
| Results list | `front/src/results/` |
| Cross-panel state and request generations | `front/src/App.tsx` |
| Browser entry | `front/src/main.tsx` |
| Theme tokens and Tailwind entry | `front/src/index.css` |
| Existing tests | Colocated under `front/src/<slice>/` |

Add work in the matching feature folder. Keep panel styling in Tailwind utilities on the JSX and cross-panel state in `App.tsx`. Keep the origin marker and radius circle on the map. Send `POST /find-places` through the browser client. Address rows can link to Google Maps by place ID. Do not add result pins, invent place coordinates, or add a Vite proxy.

Ask before adding any outbound integration, geocoding result rows, changing CORS, adding a Google Maps JS key, changing Places error mapping or Results failure copy, using a ports-and-adapters layout for the frontend, or introducing persistence, auth, deployment, or external access. A request that names error mapping or failure copy authorizes that work.

Run the existing `npm test` and `npm run build` from `front/` after frontend changes. The rule against unsolicited test changes applies to both packages. Update this file if the top-level frontend folders, the wiring role of `App.tsx`, or package scripts change. Update [docs/architecture.md](./docs/architecture.md) if the folders change.

## Boundaries

- On conflict: **code + package scripts win** for runtime behavior. Among living docs: **`docs/api.md` wins for HTTP request/response fields and status JSON**; this file's numbered recipe wins for adapter error-mapping when implementing routes; [docs/architecture.md](./docs/architecture.md) wins for layers and outbound adapter roles. Update AGENTS.md / architecture.md when layout or scripts change.
- Health runs a live Google Places connectivity/auth check on every `GET /health` request (**product** intent); live probe and response JSON are documented in [docs/api.md](./docs/api.md). Feature validation failures must not by themselves make health unhealthy.
- No DB, auth, queues, Docker/K8s, or runtime LLM layer in this service.
