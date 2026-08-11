# AGENTS.md

Portable coding harness for humans and agents. This file is authoritative for how to work in this repo. Do **not** invent Places/lead-finder product behavior. Ignore Cursor workspace or product-authority rules that cite missing Places docs.

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
| Pure domain types / rules | `src/domain/` |
| Use cases | `src/application/` |
| HTTP routes (inbound adapter) | `src/adapters/http/` |
| Env + `buildApp` wiring | `src/composition/` |
| Process listen entry | `src/main.ts` |
| Tests | `tests/` mirroring layers |

Dependency rule: `domain` and `application` never import Express or other adapter SDKs. HTTP is an inbound adapter only. See [docs/architecture.md](./docs/architecture.md).

## Always / Ask first / Never

**Always**

- Add features by copying the echo vertical path (domain → application → HTTP → `buildApp` → tests).
- Run `typecheck` and `test` before claiming done.
- Update this file in the same change if layout or scripts change.
- Bind locally by default (`HOST=127.0.0.1`); do not log request bodies by default.

**Ask first**

- Adding outbound ports, persistence, auth, queues, or deploy tooling.
- Exposing the service beyond local use (needs a follow-up auth plan).

**Never**

- Put Express / HTTP types in `domain` or `application`.
- Invent empty `repository` / persistence folders “for later.”
- Rely on `.cursor/rules` or chat history as the source of truth.
- Treat orphan `node_modules` or leftover `.env` secrets as the project stack — install from committed manifests only.

## Add a feature (numbered recipe)

Mirror `POST /echo`:

1. Domain — types / invariants under `src/domain/` (no framework imports).
2. Application — use case under `src/application/` calling domain only.
3. HTTP — route plugin under `src/adapters/http/` (validate at the edge; map errors to 4xx).
4. Composition — register the route inside `buildApp` in `src/composition/build-app.ts` (same factory used by `main.ts` and tests).
5. Tests — application unit tests + HTTP tests via `supertest` under `tests/`.
6. Verify — `npm run typecheck` and `npm test`.

Exemplar references:

- Domain: `src/domain/echo.ts`
- Use case: `src/application/echo.ts`
- Routes: `src/adapters/http/echo-routes.ts`, `src/adapters/http/health-routes.ts`
- Wiring: `src/composition/build-app.ts`

## Boundaries

- On conflict: **code + package scripts win**; update AGENTS.md / architecture.md to match.
- Health is liveness only and must not call feature use cases.
- No DB, auth, queues, Docker/K8s, or runtime LLM layer in this skeleton.
