---
title: Keep living docs aligned with hexagonal slices, not echo or skeleton recipes
date: 2026-08-12
last_refreshed: 2026-08-19
category: documentation-gaps
module: living-docs / hexagonal layout
problem_type: documentation_gap
component: documentation
severity: high
applies_when:
  - Adding a feature as domain then service then adapters then buildApp then tests
  - Updating AGENTS.md, README.md, docs/architecture.md, or CONCEPTS.md after a layout change
  - Agents or humans copying a feature recipe from living docs instead of the live tree
  - Deciding whether a historical plan or docs/solutions snapshot should be rewritten
symptoms:
  - Living docs still described an echo, application, or skeleton feature recipe after the live tree moved to hexagonal slices
  - Agents would copy the wrong tree under src and miss composition wiring in buildApp
root_cause: inadequate_documentation
resolution_type: documentation_update
related_components:
  - development_workflow
tags:
  - living-docs
  - hexagonal
  - agents-md
  - architecture
  - composition
  - feature-recipe
---

# Keep living docs aligned with hexagonal slices, not echo or skeleton recipes

## Context

Living docs were rewritten so a cold agent (or human) adding a feature follows **hexagonal slices**: domain → service → adapters → `buildApp` → tests. That rewrite is the current tree of `AGENTS.md`, `docs/architecture.md`, `README.md`, and `CONCEPTS.md`. Historical plans under `docs/plans/` and older `docs/solutions/` entries remain **snapshots**; they may still describe an echo vertical, a top-level `application` layer, and a skeleton/starter framing. The living-docs pass did not include leftover-code deletion.

The echo/application recipe originated when the TypeScript microservice skeleton was created (session history). A later find-places planning session still followed that AGENTS.md echo vertical. If an agent treats a snapshot plan, an old solution doc, a stale editor index, or chat memory as the operating contract, it will resurrect `POST /echo`, name the middle layer `application`, copy a single “echo exemplar,” or document health as `HEAD https://www.google.com` / `GOOGLE_API_KEY`. Living docs plus **composition wiring** are the layout source of truth. As of this writing, `src/` has no echo or `application` tree; `buildApp` registers health and places only.

What living docs now say (quoted from the current files):

- `AGENTS.md` architecture map lists Health (`src/health/`) and Places (`src/places/`) slices, an **intended** shared Google HTTP client at `src/shared/client/`, composition at `src/composition/`, and `docs/solutions/` as snapshots where “Living docs plus composition win on layout.” (`AGENTS.md:19–27`)
- The numbered recipe is `src/<name>/{domain,service,adapters}/` and explicitly: “Point at both `src/health/` and `src/places/` as examples — there is no single copy-me feature.” (`AGENTS.md:54–68`)
- Always: “Add features as domain → service → adapters → `buildApp` → tests.” Never: Express/HTTP types in `domain` or `service`. On conflict: “code + package scripts win”; “Composition wiring is the live tree.” (`AGENTS.md:35–49`, `AGENTS.md:71–73`)
- `README.md` titles the repo **Places service**, not a skeleton/starter, and documents only `GET /health` and `POST /find-places`. (`README.md:1–19`)
- `CONCEPTS.md` Hexagonal layout: “domain and **service** stay free of HTTP/framework types.” (`CONCEPTS.md:7–8`)
- `docs/architecture.md` HTTP surface is `/health` and `/find-places` only; health is described as Google Places connectivity/auth with a `googlePlaces` check. (`docs/architecture.md:36–41`)

What composition actually wires today (`src/composition/build-app.ts:11–28`): Express JSON app; slice `component` child loggers (`health` / `places`) passed into adapters and routes; `GooglePlacesHealthAdapter` + `HealthServiceImpl` + `registerHealthRoutes`; `GooglePlacesAdapter` + `PlacesServiceImpl` + `registerPlacesRoutes`. No echo registration. No import of `src/shared/client/`.

## Guidance

Treat **living docs + `buildApp`** as the layout contract. Do not teach or reintroduce patterns that living docs omitted on purpose.

### 1. Feature shape: named slices, two exemplars, middle layer is `service`

New work lives under `src/<name>/{domain,service,adapters}/`, then registration in `buildApp`, then tests (`AGENTS.md:54–63`). Point at **both**:

- Health: `src/health/domain/`, `src/health/service/`, `src/health/adapters/` (`AGENTS.md:67`)
- Places: `src/places/domain/`, `src/places/service/`, `src/places/adapters/` (`AGENTS.md:68`)

Always call the use-case layer **service**. Never call it `application` in living docs, recipes, or new folder names. `CONCEPTS.md` already uses “service” in Hexagonal layout (`CONCEPTS.md:7–8`). Snapshot plans that say `domain/` + `application/` + `adapters/http/` are historical.

### 2. Product framing: Places service; omit echo from living docs

`README.md` is the Places service: nearby no-website search plus a health probe that includes a Google Places connectivity/auth check (`README.md:1–3`). Documented HTTP examples are `/health` and `/find-places` only (`README.md:16–19`). Do not restore `POST /echo`, “skeleton,” or “starter” language in `AGENTS.md`, `README.md`, `CONCEPTS.md`, or `docs/architecture.md`.

Do not restore `POST /echo` from snapshots or stale indexes. `buildApp` does not register echo. Do not “helpfully” mention echo in living docs as a do-not-follow warning — living docs describe only the live tree.

### 3. On conflict, composition is the live tree

`AGENTS.md` Boundaries: “On conflict: **code + package scripts win**; update AGENTS.md / architecture.md to match. Composition wiring is the live tree.” (`AGENTS.md:73`) `docs/architecture.md` names `buildApp(config, logger)` as the registration path for process entry and tests. If a plan, solution snapshot, or leftover test still registers echo or a second app factory, ignore it for new work.

Keep `src/shared/client/` on the architecture map as **intended** even when unwired. `AGENTS.md` lists “Shared Google HTTP client (intended) | `src/shared/client/`” (`AGENTS.md:23`). `build-app.ts` constructs slice adapters directly (`src/composition/build-app.ts:16–20`). Do not delete the map row because it is unused, and do not claim it is already the runtime client.

### 4. Health and Google env: document the Places product, not leftover probe/env names

Living docs now say:

- Health is a live **Google Places** connectivity/auth check on every `GET /health`; feature validation failures must not by themselves make health unhealthy (`AGENTS.md:74`; `CONCEPTS.md` Health entry).
- README healthy example: `{ "status": "ok", "checks": { "googlePlaces": "ok" } }` requiring `GOOGLE_PLACES_API_KEY` (`README.md:18`).
- Architecture describes `/health` with a `googlePlaces` check and `src/health/adapters/google-health.ts` as the Places connectivity/auth ping.

**Do not** document as the product:

- Live `HEAD https://www.google.com` (that is what `GooglePlacesHealthAdapter.healthCheck` currently does: `src/health/adapters/google-health.ts:6–8`).
- `GOOGLE_API_KEY` / `GOOGLE_BASE_URL` as the documented operator contract (`loadConfig` currently parses those keys in `src/composition/config.ts`). That is leftover/live adapter mismatch. Living docs chose Places-product framing (`GOOGLE_PLACES_API_KEY`). Align code to living docs in a later pass; do not “fix” living docs back to the stub.

When writing health behavior in **new** living-doc edits, keep the Places-product wording. When writing a **bug** learning about the stub, cite `google-health.ts:6–8` and do not pretend the probe already hits Places.

### 5. Ask-first / Never stay in force

Keep (`AGENTS.md:41–52`, `AGENTS.md:75`):

- Ask first: extra outbound ports beyond the approved Google Places adapter; persistence; auth; queues; deploy tooling; exposing beyond local use.
- Never: Express/HTTP types in `domain` or `service`; empty `repository` / persistence folders “for later”; treating `.cursor/rules` or chat as source of truth; treating orphan `node_modules` or leftover `.env` secrets as the stack.
- No DB, auth, queues, Docker/K8s, or runtime LLM layer in this service.

### 6. Snapshots vs living docs

`docs/solutions/` is “past problems and patterns; snapshots. Living docs plus composition win on layout.” (`AGENTS.md:27`) Older solution text that still says `application` is not a license to rename `service/` back. Update snapshots only in a dedicated refresh; do not copy their layer names into `AGENTS.md`.

## Why This Matters

A cold agent that copies a snapshot plan’s echo/`application` recipe will put the next feature in a retired tree while `buildApp` only mounts health and find-places. That splits the codebase, reintroduces an echo HTTP surface living docs removed, and trains the next session to ignore `AGENTS.md`.

Calling the middle layer `application` in new docs or folders fights `CONCEPTS.md` and the live `src/*/service/` directories. Two names for one layer is how the echo/application recipe comes back.

Documenting the current health stub (`HEAD https://www.google.com`) or `GOOGLE_API_KEY` as the product would overwrite the Places-service contract the living-docs pass chose. Treating snapshot echo tests or a stale file index as the HTTP exemplar would do the same.

Keeping `src/shared/client/` on the map as intended prevents a “drive-by delete unused folder” while still admitting `buildApp` does not wire it yet.

## When to Apply

- Editing `AGENTS.md`, `docs/architecture.md`, `README.md`, or `CONCEPTS.md` (layout, recipe, HTTP surface, glossary).
- Adding a feature: choose slice paths from the living recipe, not from `docs/plans/` or an echo/`application` snapshot.
- Writing or refreshing `docs/solutions/`: if a snapshot still says `application` or echo, do not promote those names into living docs; composition + current `AGENTS.md` win.
- Documenting health, Google env, or outbound clients: use Places-product framing (`GOOGLE_PLACES_API_KEY`, Places connectivity/auth). Cite `google-health.ts` only when describing **actual** probe behavior, and label the HEAD-to-google.com call as leftover mismatch, not the documented product.
- Reviewing agent output that recreates `POST /echo`, `src/application/`, a single echo exemplar, skeleton/starter README, or Fastify/`inject` as the test path.

## Examples

### After: living recipe (follow this)

From current `AGENTS.md`:

1. Domain under `src/<name>/domain/` (no framework imports).
2. Service under `src/<name>/service/` calling domain only.
3. Adapters under `src/<name>/adapters/` (validate at HTTP edge).
4. Register in `src/composition/build-app.ts` via `buildApp(config, logger)`.
5. Tests under `tests/<name>/`; HTTP via `supertest` and `buildApp(config, logger)`.
6. Exemplars: **both** `src/health/` and `src/places/`. Wiring: `src/composition/build-app.ts`.

`buildApp` today (`src/composition/build-app.ts:16–26`):

```typescript
const healthLogger = logger.child({ component: 'health' });
const placesLogger = logger.child({ component: 'places' });

const googlePlacesHealthCheck = new GooglePlacesHealthAdapter(healthLogger);
const healthService = new HealthServiceImpl(googlePlacesHealthCheck);

const googlePlacesAdapter = new GooglePlacesAdapter(config.google, placesLogger);
const placesService = new PlacesServiceImpl(googlePlacesAdapter);

registerHealthRoutes(app, healthService, healthLogger);
registerPlacesRoutes(app, placesService, placesLogger);
```

Logger wiring detail: [Restate logger living docs when code diverges](./restate-logger-living-docs-when-code-diverges.md).

### Before: do not resurrect in living docs

| Anti-pattern | Why it is wrong now |
|--------------|---------------------|
| Copy `POST /echo` / an `application/` folder as the feature template | Not in `buildApp`; README omits echo (`README.md:16–19`); live `src/` has no echo tree |
| Name the use-case folder `application/` | Living docs and live slices use `service` (`AGENTS.md:59`; `CONCEPTS.md:7–8`) |
| Point only at echo or only at health as “the” exemplar | “there is no single copy-me feature” (`AGENTS.md:56`) |
| Call the repo a TypeScript skeleton/starter | README is “Places service” (`README.md:1`) |
| Document health as `HEAD https://www.google.com` | Probe code does that (`google-health.ts:6–8`); living docs specify Google Places + `GOOGLE_PLACES_API_KEY` |
| Drop `src/shared/client/` from the map because `buildApp` does not import it | Map marks it **intended** (`AGENTS.md:23`) |
| Treat skeleton-era plans or echo-era solutions as current layout | Snapshots; living docs + composition win (`AGENTS.md:27`, `AGENTS.md:73`) |

### Health: two layers of truth (do not collapse them)

- **Product / living docs:** live Google Places connectivity/auth; `checks.googlePlaces`; `GOOGLE_PLACES_API_KEY` (`AGENTS.md:74`, `README.md:18`, `docs/architecture.md`).
- **Current adapter (verified):** `fetch('https://www.google.com', { method: 'HEAD' })` (`src/health/adapters/google-health.ts:6–8`). Do not claim `/health` hits the Places API until `google-health.ts` is changed to match living docs.

## Related

- [Express HTTP adapter over Fastify (hexagonal)](../tooling-decisions/express-http-adapter-over-fastify-hexagonal.md) — inbound HTTP library choice; complementary, not a duplicate. Living docs win on layout recipe.
- [Restate logger living docs when code diverges](./restate-logger-living-docs-when-code-diverges.md) — logger product restatement when live Pino diverges from CE docs; complements this layout recipe.
- [Bootstrap error logger for config load failures](../developer-experience/config-load-error-logging.md) — `loadConfig` failure logging in `main.ts`; not a layout recipe.
