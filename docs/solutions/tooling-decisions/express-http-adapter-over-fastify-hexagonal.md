---
title: Prefer Express HTTP adapter over Fastify in TypeScript hexagonal microservice
date: 2026-08-11
category: tooling-decisions
module: http-adapter
problem_type: tooling_decision
component: tooling
severity: medium
applies_when:
  - "Choosing or swapping the HTTP framework for a TypeScript hexagonal microservice"
  - "Inbound HTTP adapter must stay replaceable without touching domain or application layers"
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

This skeleton originally planned Fastify for the inbound HTTP adapter. The settled tooling decision (plan KTD2) is Express instead: keep a slim hexagonal layout, treat HTTP as an inbound adapter only, and test through a shared `buildApp` factory with `supertest` rather than Fastify’s `inject` API. The durable point is not “Express is better in general,” but that swapping the HTTP library must not leak framework types into `domain` / `application`, and docs + manifests must stay aligned with the code that actually runs.

At the current tree, the runtime dependency is Express (`express` in `package.json` dependencies; no Fastify package). Composition builds an Express app in `src/composition/build-app.ts`. Routes live under `src/adapters/http/`. Domain and application modules have no Express imports. HTTP tests use `supertest` against `buildApp(...)`. `AGENTS.md` and `docs/architecture.md` document Express + `supertest` as the project contract.

## Guidance

Prefer Express as the HTTP adapter for this skeleton, and keep hexagonal boundaries intact when adding or changing HTTP surface area.

**1. Single app factory, no listen in tests**

`buildApp` is the only registration path. It constructs Express, applies JSON parsing and request logging middleware, registers health and echo routes, and returns the app without listening:

```15:26:src/composition/build-app.ts
export function buildApp(deps: AppDeps): Express {
  const logger = deps.logger;
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));
  app.use(requestLogging(logger));

  registerHealthRoutes(app);
  registerEchoRoutes(app, { echo: echoMessage });

  return app;
}
```

Process entry and HTTP tests load env, create a logger, and pass both into `buildApp` (`AppDeps` requires `env` and `logger`). The factory does not listen. Do not re-register routes in a second, test-only wiring path.

**2. Keep Express types at the adapter edge**

Route modules may import Express types and register handlers on `Express`. Example health route:

```1:7:src/adapters/http/health-routes.ts
import type { Express } from "express";

export function registerHealthRoutes(app: Express): void {
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });
}
```

Validate request bodies at the HTTP edge (Zod), then call an injected use-case function. Echo maps Zod failures and domain validation errors to 4xx without pulling Express into domain:

```7:31:src/adapters/http/echo-routes.ts
const echoBodySchema = z.object({
  message: z.string().min(1),
});

export function registerEchoRoutes(
  app: Express,
  deps: { echo: EchoUseCase },
): void {
  app.post("/echo", (req: Request, res: Response) => {
    const parsed = echoBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "invalid body: message must be a non-empty string" });
      return;
    }

    try {
      const result = deps.echo({ message: parsed.data.message });
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof EchoValidationError) {
        res.status(error.statusCode).json({ error: error.message });
        return;
      }
      throw error;
    }
  });
}
```

**3. Domain and application stay framework-free**

Domain owns types, domain errors, and invariants with no Express (or other adapter SDK) imports:

```1:23:src/domain/echo.ts
export type EchoResult = {
  message: string;
};

export class EchoValidationError extends Error {
  readonly statusCode = 400;

  constructor(message: string) {
    super(message);
    this.name = "EchoValidationError";
  }
}

/** Domain rule: message must be a non-empty string. */
export function normalizeEchoMessage(message: unknown): string {
  if (typeof message !== "string") {
    throw new EchoValidationError("message must be a string");
  }
  if (message.length === 0) {
    throw new EchoValidationError("message must not be empty");
  }
  return message;
}
```

Application depends only on domain:

```1:6:src/application/echo.ts
import { normalizeEchoMessage, type EchoResult } from "../domain/echo.js";

export function echoMessage(input: { message: unknown }): EchoResult {
  const message = normalizeEchoMessage(input.message);
  return { message };
}
```

**4. Test HTTP with `supertest(app)`, not Fastify inject**

HTTP adapter tests import `supertest`, build the app via `buildApp`, and issue requests without listening:

```1:18:tests/adapters/http/health.test.ts
import { describe, expect, it } from "vitest";
import request from "supertest";
import { buildApp } from "../../../src/composition/build-app.js";
import { loadEnv } from "../../../src/composition/env.js";
import { createLogger } from "../../../src/composition/logger.js";

describe("GET /health", () => {
  it("returns 200 ok", async () => {
    const env = loadEnv({ LOG_LEVEL: "silent" });
    const app = buildApp({
      env,
      logger: createLogger(env.LOG_LEVEL),
    });
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });
});
```

Echo tests follow the same pattern (`request(app()).post("/echo").send(...)` in `tests/adapters/http/echo.test.ts`).

**5. Keep package and docs truthful**

Committed stack: `express` (and `@types/express`) plus `supertest` for HTTP tests — not Fastify:

```15:26:package.json
  "dependencies": {
    "express": "^5.1.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@types/express": "^5.0.3",
    "@types/node": "^22.17.0",
    "@types/supertest": "^6.0.3",
    "supertest": "^7.1.4",
    "tsx": "^4.20.3",
    "typescript": "^5.9.2",
    "vitest": "^3.2.4"
  }
```

Project instructions state Express as the inbound adapter and forbid Express types in domain/application (`AGENTS.md` architecture map and Never list; `docs/architecture.md` layers and composition-root sections). When the HTTP library changes again, update code, tests, `package.json`, `AGENTS.md`, and `docs/architecture.md` in the same change so agents and humans do not resurrect Fastify patterns from stale docs.

## Why This Matters

Hexagonal layout only pays off if the adapter boundary is real. If Express (or Fastify) types creep into `domain` / `application`, swapping or testing the transport becomes a rewrite instead of an adapter change. Choosing Express over Fastify is a local, reversible tooling decision; coupling domain logic to whichever library is current is not.

A shared `buildApp` + `supertest` path also prevents a common skeleton failure mode: production wiring and test wiring diverge, so “green” HTTP tests miss registration bugs. Aligning docs and `package.json` with Express prevents agents from scaffolding Fastify plugins, `app.inject`, or Fastify schemas from plan drafts or muscle memory after the stack settled on Express.

## When to Apply

- Adding or changing HTTP routes, middleware, or validation in this skeleton.
- Writing or updating HTTP adapter tests (always `buildApp` + `supertest`, never a separate Fastify inject harness).
- Extending features along the echo vertical: domain → application → `adapters/http` → register in `buildApp` → tests.
- Reconsidering or documenting HTTP-library choices (Express vs alternatives): treat the library as an adapter detail; do not invent outbound ports, persistence, or auth as part of a framework swap.
- Updating agent/architecture docs after any HTTP-stack change so committed guidance matches `package.json` and source.

## Examples

**Correct: Express stays in the adapter; use case is a plain function**

Composition wires the real use case into the route registrar:

```22:23:src/composition/build-app.ts
  registerHealthRoutes(app);
  registerEchoRoutes(app, { echo: echoMessage });
```

`EchoUseCase` is a function type returning domain `EchoResult`, not an Express handler (`src/adapters/http/echo-routes.ts`).

**Correct: HTTP test drives the same app factory**

```7:16:tests/adapters/http/echo.test.ts
  function app() {
    const env = loadEnv({ LOG_LEVEL: "silent" });
    return buildApp({ env, logger: createLogger(env.LOG_LEVEL) });
  }

  it("echoes a valid message", async () => {
    const response = await request(app()).post("/echo").send({ message: "hi" });
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "hi" });
  });
```

**Incorrect (avoid): Fastify inject or dual registration**

Do not introduce `fastify.inject` helpers, Fastify route plugins, or a test-only app that registers routes differently from `buildApp`. Do not add `fastify` to dependencies while docs claim Express — or leave Fastify wording in `AGENTS.md` / `docs/architecture.md` after the Express switch.

**Incorrect (avoid): Express in domain/application**

Do not import `express`, `Request`, or `Response` under `src/domain/` or `src/application/`. Domain may expose portable signals (e.g. `EchoValidationError` with `statusCode`) that the adapter maps to HTTP responses; the adapter owns Express status/json calls.

## Related

- No prior docs under `docs/solutions/` (first learning in this store).
- Plan decision recorded as KTD2 in `docs/plans/2026-08-11-001-feat-typescript-microservice-skeleton-plan.md`.
