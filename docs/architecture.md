# Architecture

Slim ports-and-adapters (hexagonal) layout for a Node 22+ TypeScript microservice.

## Layers

```
HTTP client
    ↓
adapters/http   (Express routes, request validation, response mapping)
    ↓
application     (use cases)
    ↓
domain          (types, invariants, domain errors)
```

`composition/` loads env, constructs use cases, and builds the Express app. `main.ts` only listens.

## Dependency rule

- `domain` and `application` must not import Express, HTTP types, or client SDKs.
- Adapters depend inward on application/domain.
- Outbound ports appear only when a real external I/O dependency exists (none in v1).

## Composition root

`buildApp(deps)` in `src/composition/build-app.ts` is the **single** registration path:

- Process entry: `loadEnv()` → `buildApp` → `listen`
- Tests: `buildApp` → `supertest(app)` (no listen required)

Do not re-register routes differently in tests.

## HTTP surface (v1)

| Method | Path | Role |
|--------|------|------|
| `GET` | `/health` | Liveness (`{ "status": "ok" }`) — independent of features |
| `POST` | `/echo` | Toy exemplar — body `{ "message": string }` |

Validation for echo lives at the HTTP edge (Zod). Domain may still reject business-invalid values.

## Testing

- Domain / application: direct unit tests
- HTTP: `supertest` through `buildApp`
- Prefer real use cases in HTTP tests for the exemplar path

## Config

Zod-validated env in `src/composition/env.ts` (`PORT`, `HOST`, `LOG_LEVEL`). Ban raw `process.env` outside that module. Ship `.env.example`; keep `.env` gitignored.
