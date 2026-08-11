# Agent instructions

Cold-session guide for AI agents working in this repo.

## Authority hierarchy

1. **Product behavior** — [`docs/plans/2026-08-11-001-feat-websiteless-lead-finder-plan.md`](docs/plans/2026-08-11-001-feat-websiteless-lead-finder-plan.md) (lead-finder R1–R25). Do not invent segments, budgets, data sources, or scoring rules.
2. **Harness docs** — [`docs/README.md`](docs/README.md) for architecture, ops, and status pointers.
3. **Code** — follow existing hexagonal layout and patterns.

On conflict, the lead-finder plan wins.

## Before implementing

- Read [non-negotiables](docs/product/non-negotiables.md) for settled product decisions.
- Read [implementation status](docs/status/implementation.md) for unfinished lead-finder units — do not re-implement completed domain work or skip missing adapters.
- Read [hexagonal architecture](docs/architecture/hexagonal.md) — run `npm run lint:arch` after structural changes.
- Read [setup](docs/ops/setup.md) before claiming scripts or env vars exist.
- Search [`docs/solutions/`](docs/solutions/) for documented past problems and patterns (YAML frontmatter: `module`, `tags`, `problem_type`).
- Read [`CONCEPTS.md`](CONCEPTS.md) for shared domain vocabulary when terms are ambiguous.

## Git

Do not commit, push, or open PRs unless the user explicitly asks in that message.

## Docs package

This harness is described in [`docs/plans/2026-08-11-002-feat-docs-ai-harness-plan.md`](docs/plans/2026-08-11-002-feat-docs-ai-harness-plan.md).
