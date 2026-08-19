---
title: Prefer Express HTTP adapter over Fastify in TypeScript hexagonal microservice
date: 2026-08-11
last_refreshed: 2026-08-19
category: tooling-decisions
module: http-adapter
problem_type: tooling_decision
component: tooling
severity: medium
applies_when:
  - "Choosing or swapping the HTTP framework for a TypeScript hexagonal microservice"
  - "Inbound HTTP adapter must stay replaceable without touching domain or service layers"
  - "HTTP tests need to use supertest against an Express app instead of Fastify inject()"
  - "Edge validation is handled with Zod at the route boundary"
tags:
  - express
  - fastify
  - hexagonal-architecture
  - typescript
  - zod
  - supertest
  - http-adapter
  - nodejs
related_components:
  - testing_framework
  - documentation
  - development_workflow
---

# Prefer Express HTTP adapter over Fastify in TypeScript hexagonal microservice

## Context

This skeleton originally planned Fastify for the inbound HTTP adapter. The settled tooling decision (plan KTD2) is Express instead: keep a slim hexagonal layout, treat HTTP as an inbound adapter only, and test through a shared `buildApp` factory with `supertest` rather than Fastify’s `inject` API. The durable point is not “Express is better in general,” but that swapping the HTTP library must not leak framework types into `domain` / `service`, and docs + manifests must stay aligned with the code that actually runs.

At the current tree, the runtime dependency is Express (`express` in `package.json` dependencies; no Fastify package). Composition builds an Express app in `src/composition/build-app.ts`. Routes live in vertical-slice adapters (`src/health/adapters/`, `src/places/adapters/`). Domain and service modules have no Express imports. Process entry loads config via `loadConfig`, creates a logger, and passes both into `buildApp`. `AGENTS.md` and `docs/architecture.md` document Express + `supertest` as the project contract.

## Guidance

Prefer Express as the HTTP adapter for this service, and keep hexagonal boundaries intact when adding or changing HTTP surface area.

**1. Single app factory, no listen in tests**

`buildApp` is the only registration path. It constructs Express, applies JSON parsing, wires health and places services, registers their routes, and returns the app without listening:

```11:28:src/composition/build-app.ts
export function buildApp(config: Config, logger: Logger): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  const healthLogger = logger.child({ component: 'health' });
  const placesLogger = logger.child({ component: 'places' });

  const googlePlacesHealthCheck = new GooglePlacesHealthAdapter(healthLogger);
  const healthService = new HealthServiceImpl(googlePlacesHealthCheck);

  const googlePlacesAdapter = new GooglePlacesAdapter(config.google, placesLogger);
  const placesService = new PlacesServiceImpl(googlePlacesAdapter);

  registerHealthRoutes(app, healthService, healthLogger);
  registerPlacesRoutes(app, placesService, placesLogger);

  return app;
}
```

Process entry and HTTP tests load config, create a logger, and pass both into `buildApp`. The factory does not listen. Do not re-register routes in a second, test-only wiring path.

**2. Keep Express types at the adapter edge**

Route modules may import Express types and register handlers on `Express`. Health routes delegate to an injected service:

```5:11:src/health/adapters/health-routes.ts
export function registerHealthRoutes(app: Express, healthService: HealthService, logger: Logger): void {
  app.get('/health', async (_req, res) => {
    const result = await healthService.healthCheck();
    const statusCode = result === 'ok' ? 200 : 503;
    logger.info({ status: result }, 'health check result');
    res.status(statusCode).json({ status: result });
  });
}
```

Validate request bodies at the HTTP edge (Zod), then call an injected service. Places maps Zod failures to 4xx without pulling Express into domain:

```29:45:src/places/adapters/find-places-route.ts
export function registerPlacesRoutes(app: Express, placesService: PlacesService, logger: Logger): void {
  app.post('/find-places', async (req: Request, res: Response) => {
    const parsedInput = findPlacesBodySchema.safeParse(req.body);
    if (!parsedInput.success) {
      logger.error(
        {
          method: req.method,
          path: req.path,
          statusCode: 400,
          errors: parsedInput.error.errors
        },
        'invalid request'
      );
      res.status(400).json({
        error: 'invalid body: latitude, longitude, and radiusMeters are required'
      });
      return;
    }
```

**3. Domain and service stay framework-free**

Domain ports and types live under each vertical slice (`src/places/domain/`, `src/health/domain/`) with no Express imports. Services depend on domain ports only (`src/places/service/places-service.ts`, `src/health/service/health-service.ts`).

**4. Test HTTP with `supertest(app)`, not Fastify inject**

HTTP adapter tests import `supertest`, build the app via `buildApp`, and issue requests without listening. Use `loadConfig` with test overrides (never raw `process.env` in tests):

```typescript
import request from 'supertest';
import { buildApp } from '../../../src/composition/build-app.js';
import { loadConfig } from '../../../src/composition/config.js';
import { createLogger } from '../../../src/shared/logging/logger.js';

const config = loadConfig({ LOG_LEVEL: 'silent', GOOGLE_API_KEY: 'test-key' });
const logger = createLogger(config.log.level);
const app = buildApp(config, logger);

const response = await request(app).get('/health');
expect(response.status).toBe(200);
```

**5. Keep package and docs truthful**

Committed stack: `express` (and `@types/express`) plus `supertest` for HTTP tests — not Fastify:

```15:27:package.json
  "dependencies": {
    "express": "^5.1.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@types/express": "^5.0.3",
    "@types/node": "^22.17.0",
    "@types/supertest": "^6.0.3",
    "supertest": "^7.1.4",
```

Project instructions state Express as the inbound adapter and forbid Express types in domain/service (`AGENTS.md` architecture map and Never list; `docs/architecture.md` layers and composition-root sections). When the HTTP library changes again, update code, tests, `package.json`, `AGENTS.md`, and `docs/architecture.md` in the same change so agents and humans do not resurrect Fastify patterns from stale docs.

## Why This Matters

Hexagonal layout only pays off if the adapter boundary is real. If Express (or Fastify) types creep into `domain` / `service`, swapping or testing the transport becomes a rewrite instead of an adapter change. Choosing Express over Fastify is a local, reversible tooling decision; coupling domain logic to whichever library is current is not.

A shared `buildApp` + `supertest` path also prevents a common skeleton failure mode: production wiring and test wiring diverge, so “green” HTTP tests miss registration bugs. Aligning docs and `package.json` with Express prevents agents from scaffolding Fastify plugins, `app.inject`, or Fastify schemas from plan drafts or muscle memory after the stack settled on Express.

## When to Apply

- Adding or changing HTTP routes, middleware, or validation in this service.
- Writing or updating HTTP adapter tests (always `buildApp` + `supertest`, never a separate Fastify inject harness).
- Extending features along a vertical slice: domain → service → adapter route → register in `buildApp` → tests.
- Reconsidering or documenting HTTP-library choices (Express vs alternatives): treat the library as an adapter detail; do not invent outbound ports, persistence, or auth as part of a framework swap.
- Updating agent/architecture docs after any HTTP-stack change so committed guidance matches `package.json` and source.

## Examples

**Correct: Express stays in the adapter; service is injected**

Composition wires real services into route registrars (`src/composition/build-app.ts:22-23`). Route functions take `PlacesService` / `HealthService` ports, not Express handler types.

**Correct: HTTP test drives the same app factory**

```9:17:src/main.ts
  try {
    config = loadConfig();
    logger = createLogger(config.log.level);
  } catch (error) {
    createLogger('error').error(error as Error, 'load config failed');
    process.exit(1);
  }

  const app = buildApp(config, logger);
```

Tests mirror this pattern with `loadConfig({ ... })` overrides instead of listening.

**Incorrect (avoid): Fastify inject or dual registration**

Do not introduce `fastify.inject` helpers, Fastify route plugins, or a test-only app that registers routes differently from `buildApp`. Do not add `fastify` to dependencies while docs claim Express — or leave Fastify wording in `AGENTS.md` / `docs/architecture.md` after the Express switch.

**Incorrect (avoid): Express in domain/service layers**

Do not import `express`, `Request`, or `Response` under `src/*/domain/` or `src/*/service/`. Adapters own HTTP status/json calls; services return domain results or throw domain errors.

## Related

- [Bootstrap error logger for config load failures](../developer-experience/config-load-error-logging.md) — bootstrap logging before config is available; complements the `buildApp(config, logger)` contract here.
- Plan decision recorded as KTD2 in `docs/plans/2026-08-11-001-feat-typescript-microservice-skeleton-plan.md`.
