# Places lead finder

Internal API that finds local businesses needing a website (Northern Virginia focus), scores them, and persists leads to Supabase. TypeScript on Node, hexagonal architecture.

## Documentation

Start at **[`docs/README.md`](docs/README.md)**:

- [Product non-negotiables](docs/product/non-negotiables.md) — settled decisions; full spec in the [lead-finder plan](docs/plans/2026-08-11-001-feat-websiteless-lead-finder-plan.md)
- [Architecture](docs/architecture/hexagonal.md) — layers and dependency rules
- [Setup](docs/ops/setup.md) — env vars and npm scripts
- [Implementation status](docs/status/implementation.md) — what is done vs next

## Quick start

```bash
npm install
cp .env.example .env   # set GOOGLE_MAPS_API_KEY, SUPABASE_* 
npm run dev
```

See [setup](docs/ops/setup.md) for details.

## Product authority

Behavior is defined in [`docs/plans/2026-08-11-001-feat-websiteless-lead-finder-plan.md`](docs/plans/2026-08-11-001-feat-websiteless-lead-finder-plan.md) (lead-finder R1–R25). Harness docs cite that plan; they do not replace it.
