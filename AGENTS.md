# AGENTS.md

Portable coding harness for humans and agents. This file is authoritative for how to work in this repo.

## Commands

```bash
cp .env.example .env   # once, before first `dev`
npm install            # from committed package.json / package-lock.json only
npm run typecheck
npm test
npm run dev
```

`typecheck` and `test` must not require a committed `.env`. `dev` requires a local `.env` (gitignored).

## Architecture map

| Concern | Location |
|---------|----------|
| Health slice | `src/health/` |
| Places slice | `src/places/` |
| Shared Google HTTP client (intended) | `src/shared/client/` |
| Shared logging | `src/shared/logging/` |
| Config + `buildApp` wiring | `src/composition/` |
| Process listen entry | `src/main.ts` |
| Documented solutions | `docs/solutions/` — past problems and patterns organized by category with YAML frontmatter (`module`, `tags`, `problem_type`); snapshots. Living docs plus composition win on layout. |
| Shared vocabulary | `CONCEPTS.md` |
| Tests | `tests/<slice>/` for service/domain; HTTP via `supertest` and `buildApp(config, logger)` |

Dependency rule: `domain` and `service` never import Express or other adapter SDKs. HTTP is an inbound adapter only. Layers, HTTP surface, outbound adapters, and config: [docs/architecture.md](./docs/architecture.md).

## Always / Ask first / Never

**Always**

- Add features as domain → service → adapters → `buildApp`.
- Run `typecheck` and existing `test` before claiming done.
- Update this file in the same change if layout or scripts change.
- Bind locally by default (`HOST=127.0.0.1`); do not log request bodies by default.

**Ask first**

- Adding additional outbound ports beyond the approved Google Places adapter, persistence, auth, queues, or deploy tooling.
- Exposing the service beyond local use (needs a follow-up auth plan).
- Creating, expanding, or rewriting tests.

**Never**

- Create, add, expand, or rewrite test files unless the user explicitly asked for tests in that request. Help means change production code; do not “complete” the work with a new test.
- Put Express / HTTP types in `domain` or `service`.
- Invent empty `repository` / persistence folders “for later.”
- Rely on `.cursor/rules` or chat history as the source of truth.
- Treat orphan `node_modules` or leftover `.env` secrets as the project stack — install from committed manifests only.

## Add a feature (numbered recipe)

New functions live under `src/<name>/{domain,service,adapters}/`. Point at both `src/health/` and `src/places/` as examples — there is no single copy-me feature.

1. Domain — types / invariants under `src/<name>/domain/` (no framework imports).
2. Service — use case under `src/<name>/service/` calling domain only.
3. Adapters — inbound HTTP and outbound I/O under `src/<name>/adapters/` (validate at the HTTP edge; map domain errors there: **400** validation, **502** upstream unavailability, **500** unexpected).
4. Composition — register inside `buildApp` in `src/composition/build-app.ts` (same factory used by `src/main.ts` and tests: `buildApp(config, logger)`).
5. Tests — only if the user asked. Service/domain under `tests/<name>/`; HTTP via `supertest` and `buildApp(config, logger)`.
6. Verify — `npm run typecheck` and `npm test` (run existing tests; do not add new ones to make this step exist).

Exemplar references:

- Health: `src/health/domain/`, `src/health/service/`, `src/health/adapters/`
- Places: `src/places/domain/`, `src/places/service/`, `src/places/adapters/`
- Wiring: `src/composition/build-app.ts`

## Boundaries

- On conflict: **code + package scripts win**; update AGENTS.md / architecture.md to match. Composition wiring is the live tree.
- Health runs a live Google Places connectivity/auth check on every `GET /health` request; feature validation failures must not by themselves make health unhealthy.
- No DB, auth, queues, Docker/K8s, or runtime LLM layer in this service.
