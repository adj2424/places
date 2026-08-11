---
title: Docs-first AI and human harness for solo repos
date: 2026-08-11
category: architecture-patterns
module: project-harness
problem_type: architecture_pattern
component: documentation
severity: medium
applies_when:
  - "A repo has an implementation-ready product plan but placeholder README and no agent instructions"
  - "Cold Cursor sessions must recover product, architecture, and run/continue guidance without chat history"
  - "You want one source of truth without duplicating R1–R25-style requirements in every entrypoint"
resolution_type: documentation_update
tags:
  - cursor
  - agents-md
  - documentation
  - hexagonal
  - compound-engineering
---

# Docs-first AI and human harness for solo repos

## Context

The places lead-finder repo had a detailed implementation-ready plan under `docs/plans/`, domain code under `src/`, and a placeholder `README.md` (`hi testing`). There was no `AGENTS.md`, no `.cursor/rules/`, and no onboarding path for cold agent sessions. Agents either re-read the full product plan or invented setup steps, segments, and budgets.

The harness brainstorm chose a **docs tree with thin root pointers**: durable content under `docs/`, while `README.md` and `AGENTS.md` only link inward. Product behavior stays in the existing lead-finder plan — the harness cites it, never rewrites it.

## Guidance

### Layout

```text
README.md / AGENTS.md     → thin pointers (one hop to docs index)
docs/README.md            → index of four surfaces + plans/
docs/product/             → non-negotiables (one-liners + plan link)
docs/architecture/        → hexagonal rules + lint:arch
docs/ops/                 → env, scripts that exist in package.json
docs/status/              → lead-finder U1–U10 vs filesystem (manual update)
docs/plans/               → product authority (unchanged)
.cursor/rules/*.mdc       → thin Cursor-scoped guardrails
```

### Split portable vs Cursor-specific context

Per 2026 Cursor practice:

- **`AGENTS.md`** — cross-tool portable facts: authority hierarchy, cold-session checklist, links to `docs/`.
- **`.cursor/rules/*.mdc`** — activation-scoped behavior: `alwaysApply: true` only for universal “don’t invent product behavior”; use `globs` for hexagonal rules on `src/**/*.ts`.

Keep always-on rules short. Detail lives in `docs/`, not in rules.

### Product authority rule

Harness docs may summarize settled decisions as navigation aids. They must state explicitly: **on conflict, the lead-finder plan wins**. Never maintain a second copy of R1–R25 in README, AGENTS, or rules.

### Implementation status map

Documentary table mapping lead-finder plan units (U1–U10) to present/absent paths in the tree. Update when a unit lands — do not auto-generate from git. Absent areas at harness landing: `src/adapters/`, `supabase/migrations/`, sweep service, HTTP.

### Ops doc discipline

Only document npm scripts that exist in `package.json`. The lead-finder plan may reference future scripts (e.g. `smoke`); the ops doc must not claim them until they appear.

## Why This Matters

Without this split, every cold session pays a context tax: either the full product plan is pasted into rules (bloat + drift) or agents invent product behavior. Thin entrypoints plus a docs tree give humans and agents the same map; Cursor rules catch high-cost mistakes (inventing segments, breaking hexagonal imports) without replacing the plan.

The pattern compounds: finishing a lead-finder unit updates `docs/status/implementation.md` once; agents stop re-deriving “what’s done” from directory listings.

## When to Apply

- Greenfield or early-phase repo with a plan artifact but no onboarding docs.
- Solo or small team using Cursor (or multi-tool agents reading `AGENTS.md`).
- Product requirements already live in a long unified plan under `docs/plans/`.

Skip when the repo already has maintained docs and rules that cover the cold-session bar, or when a public docs site is the real entrypoint.

## Examples

**Before (root README):**

```markdown
hi testing
```

**After (root README excerpt):**

```markdown
Start at **[docs/README.md](docs/README.md)**:
- Product non-negotiables → links to lead-finder plan
- Architecture, Setup, Implementation status
```

**Always-on rule (product-authority.mdc):**

```yaml
---
description: Product authority — cite the lead-finder plan; do not invent behavior
alwaysApply: true
---
```

Body: cite plan path + `docs/product/non-negotiables.md`; forbid inventing segments/budgets.

**Glob-scoped rule (hexagonal-architecture.mdc):**

```yaml
globs: src/**/*.ts,tests/**/*.ts
alwaysApply: false
```

## Related

- Plan: `docs/plans/2026-08-11-002-feat-docs-ai-harness-plan.md`
- Product authority: `docs/plans/2026-08-11-001-feat-websiteless-lead-finder-plan.md`
- Architecture enforcement: `scripts/lint-arch.mjs` (`npm run lint:arch`)
