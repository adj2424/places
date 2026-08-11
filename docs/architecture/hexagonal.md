# Hexagonal architecture

TypeScript on Node 22+, ports and adapters. Domain logic stays free of I/O so tiling, qualification, and scoring are testable without network access.

## Layout

```text
src/
  domain/           # Pure logic — no adapters, no I/O
  application/
    ports/          # Interfaces the application owns
  config/           # Env loading, denylists, weights
  adapters/         # (not yet present) inbound HTTP + outbound Google/Supabase/probe
  main.ts           # Composition root — wire adapters here as units land
```

**Current state:** `domain/`, `application/ports/`, and `config/` exist. `adapters/`, sweep orchestration, and HTTP are not implemented yet. See [implementation status](../status/implementation.md).

## Dependency rules

Enforced by `scripts/lint-arch.mjs` (`npm run lint:arch`):

1. **Domain** must not import **adapters**.
2. **Inbound adapters** must not import **outbound adapters** — reach outbound code only through application ports.

The domain must stay free of I/O so tiling, qualification, and scoring stay testable without a network. The inbound adapter must reach outbound adapters only through application ports.

## Patterns

- **Ports** live in `src/application/ports/` (`place-discovery`, `geocoder`, `website-probe`, `lead-repository`, `coverage-repository`).
- **Composition** happens in `src/main.ts` — construct adapters and inject into services; no DI container.
- **Config** maps `process.env` onto `AppConfig` in `src/config/index.ts` (defaults for optional numerics; no runtime validation).

## Verification

```bash
npm run lint:arch
```
