---
title: Project Docs and AI Harness - Plan
type: feat
date: 2026-08-11
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
---

# Project Docs and AI Harness - Plan

## Goal Capsule

- **Objective:** Give this repo a docs-first human and agent harness so a cold Cursor session can recover product non-negotiables, hexagonal architecture rules, and how to run or continue unfinished work without inventing behavior.
- **Product authority:** The Product Contract below. Durable content lives under `docs/`; root `README.md` and `AGENTS.md` are thin pointers. Product behavior for the lead finder remains `docs/plans/2026-08-11-001-feat-websiteless-lead-finder-plan.md` (R1–R25 and its KTDs) — this harness cites it, never rewrites it.
- **Execution profile:** Documentation and Cursor project rules only. No application code changes except optional link-check tooling if needed for verification.
- **Stop conditions:** Stop and ask if Cursor rule activation behavior contradicts the thin-entrypoint design (e.g. forcing a second full product PRD into always-on context), or if the status map would require inventing unit progress beyond what the repo and lead-finder plan already show.
- **Tail ownership:** Ends when entrypoints, docs tree, and project rules exist and verification below passes. Does not finish lead-finder implementation units U2/U4/U6/U8–U10.

---

## Product Contract

### Summary

A solo developer runs this lead-finder service with Cursor agents. Today the only durable product doc is the implementation-ready lead-finder plan; `README.md` is a placeholder; there is no `AGENTS.md` or project Cursor rules. Agents re-derive context from chat or invent missing ops detail. This work ships a shared documentation package plus an AI harness so humans and agents enter through thin root files and land in the same `docs/` source of truth.

### Problem Frame

Without durable project docs, every cold session either re-reads a long product plan without ops/architecture orientation, or invents setup and continuation steps. The operator already chose a docs-tree source of truth with thin root pointers, and a minimum bar that covers product decisions, architecture, and run/continue — not a subset.

### Requirements

**Entrypoints and authority**

- R1. Durable documentation content lives under `docs/`, not as long essays in the repo root.
- R2. Root `README.md` is a short human entrypoint that points into `docs/` for setup, architecture, product authority, and implementation status.
- R3. Root `AGENTS.md` is a short agent entrypoint that points into the same `docs/` surfaces and states the authority hierarchy in a few lines.
- R4. Product behavior for the lead finder is not duplicated as a second requirements set; harness docs cite `docs/plans/2026-08-11-001-feat-websiteless-lead-finder-plan.md` as product authority.
- R5. Harness docs may summarize non-negotiables only as a navigation aid (pointers and one-line reminders), never as a competing source of truth.

**Cold-session coverage**

- R6. Docs cover product non-negotiables orientation (what is settled and where to read it).
- R7. Docs cover hexagonal architecture rules and how `lint:arch` enforces them.
- R8. Docs cover how to configure and run the project (env vars from `.env.example`, npm scripts that exist today).
- R9. Docs include an implementation status / unfinished-work map keyed to the lead-finder plan’s units and current repo presence.
- R10. A cold session that follows the entrypoints can recover product, architecture, and run/continue guidance without prior chat history.

**AI harness**

- R11. Project Cursor rules exist under `.cursor/rules/` as `.mdc` files with explicit activation frontmatter.
- R12. Rules enforce high-cost mistakes: do not invent product behavior; respect hexagonal dependency direction.
- R13. Rules stay thin; detailed guidance remains in `docs/`.
- R14. User-level “no commit/push unless asked” remains authoritative for git; the harness may mention it briefly but must not replace or contradict it.

### Key Flows

- F1. Cold human onboarding
  - **Trigger:** Operator opens the repo with no prior context.
  - **Steps:** Read `README.md` → follow links into `docs/` for setup, architecture, product plan, and status → run documented scripts / fill env.
  - **Outcome:** Can configure and continue work without inventing commands or product rules.

- F2. Cold agent session
  - **Trigger:** Cursor agent starts with no chat history.
  - **Steps:** Load `AGENTS.md` and applicable project rules → open cited `docs/` pages and the lead-finder plan when changing behavior → follow status map for next unfinished unit.
  - **Outcome:** Does not invent segments, budgets, or architecture bypasses; cites the product plan for behavior.

### Acceptance Examples

- AE1. Given a fresh clone, opening `README.md` reaches setup, architecture, product authority, and status docs in at most one hop each.
- AE2. Given a cold agent prompt to “add a new qualification segment,” project rules / `AGENTS.md` direct the agent to the product plan rather than inventing a segment.
- AE3. Given the status doc, unfinished lead-finder units currently absent from the tree (adapters, migrations, sweep, HTTP) are listed as not done, and present domain units are listed as present.

### Scope Boundaries

**In scope**

- `docs/` content tree for product orientation, architecture, ops, status, and a docs index
- Thin root `README.md` and `AGENTS.md`
- Thin `.cursor/rules/*.mdc` project rules

**Deferred for later**

- Public docs site or marketing pages
- Custom Cursor skills beyond project rules
- `STRATEGY.md` and a full `CONCEPTS.md` glossary (unless created by a separate compound workflow)
- Completing lead-finder implementation units

**Out of scope**

- Changing application behavior, schemas, or API contracts
- Replacing or rewriting the lead-finder Product Contract (R1–R25)

### Key Decisions

- KD1. Docs-tree source of truth with thin root pointers — (session-settled: user-directed — chosen over dual-entry root essays: room to grow; README/AGENTS stay stubs that point into `docs/`). Governs R1–R3.
- KD2. Cold-session bar covers product, architecture, and run/continue together — (session-settled: user-directed — chosen over a subset bar). Governs R6–R10.
- KD3. Thinnest cut left to the agent: cite the existing plan; defer public docs, strategy, and custom skills — (session-settled: user-approved — “figure it out yourself”). Governs R4–R5 and Scope Boundaries.
- KD4. Include an implementation status map and thin project Cursor rules in this package — (session-settled: user-approved — confirmed on plan scoping). Governs R9, R11–R13.

### Assumptions

- Assumed: current unfinished map can be derived from lead-finder plan units U1–U10 plus filesystem presence (domain/ports/config present; adapters/migrations/sweep/HTTP absent).
- Assumed: existing user rule “no commit/push unless asked” continues to apply; harness does not need a second always-on git policy rule.
- Assumed: `npm run smoke` referenced in the lead-finder plan is not yet present; ops docs must not claim scripts that `package.json` does not define.

---

## Planning Contract

### Key Technical Decisions

- KTD1. Split portable agent facts (`AGENTS.md`) from Cursor-scoped rules (`.cursor/rules/*.mdc`) — (session-settled: user-approved — README/AGENTS pointing to docs, plus confirmed Cursor rules). Prefer always-on only for universal “do not invent product behavior / cite the plan”; use globs for hexagonal guidance when editing `src/**`. External research (2026 Cursor guidance) treats `AGENTS.md` as cross-tool portable context and `.mdc` as activation-scoped Cursor behavior.
- KTD2. Docs layout under `docs/`: `docs/README.md` (index), `docs/product/non-negotiables.md`, `docs/architecture/hexagonal.md`, `docs/ops/setup.md`, `docs/status/implementation.md`, leaving `docs/plans/` as the existing plan home. Governs R1, R6–R9.
- KTD3. Status map is documentary, not an automated progress system — update when finishing harness work to match current tree; do not invent a progress tracker or mutate the lead-finder plan’s unit checkboxes. Governs R9.
- KTD4. Product Contract preservation: bootstrap Product Contract above; no upstream requirements-only file existed for this topic. Lead-finder plan remains untouched.

Product Contract preservation: Product Contract authored in this plan (`ce-plan-bootstrap`); meaning unchanged from confirmed session scope.

### High-Level Technical Design

```text
Root entrypoints (thin)
  README.md ──┐
  AGENTS.md ──┼──► docs/README.md (index)
              │         ├── product/non-negotiables.md ──► plans/...-lead-finder-plan.md
              │         ├── architecture/hexagonal.md ──► scripts/lint-arch.mjs
              │         ├── ops/setup.md ──► .env.example, package.json scripts
              │         └── status/implementation.md ──► plan U1–U10 vs src/
.cursor/rules/*.mdc ──► reinforce R11–R13 (cite docs + plan; hexagonal)
```

### Alternative Approaches Considered

- Dual-entry root essays (`README` + `AGENTS` hold durable content) — rejected; user chose docs-tree with pointers.
- Rules-first, minimal prose — rejected; fails the cold-session bar for humans and ops.
- Nested per-directory `AGENTS.md` files — deferred; one root pointer is enough at current size.

---

## Output Structure

```text
README.md
AGENTS.md
docs/
  README.md
  product/
    non-negotiables.md
  architecture/
    hexagonal.md
  ops/
    setup.md
  status/
    implementation.md
  plans/                          # existing; do not relocate
.cursor/
  rules/
    product-authority.mdc
    hexagonal-architecture.mdc
```

---

## Implementation Units

### U1. Durable docs tree

**Goal:** Create the `docs/` content that humans and agents share.
**Requirements:** R1, R4–R10
**Dependencies:** None
**Files:**
- create: `docs/README.md`
- create: `docs/product/non-negotiables.md`
- create: `docs/architecture/hexagonal.md`
- create: `docs/ops/setup.md`
- create: `docs/status/implementation.md`
**Approach:**
1. Write a short docs index with links to the four surfaces plus `docs/plans/`.
2. Non-negotiables: one-liners + hard link to the lead-finder plan; no second R1–R25.
3. Architecture: ports/adapters layout, domain purity, `npm run lint:arch` / `scripts/lint-arch.mjs` rules.
4. Ops: Node ≥22, copy `.env.example`, document only scripts that exist (`typecheck`, `test`, `lint:arch`, `dev`); note required Google/Supabase keys.
5. Status: table or list mapping lead-finder U1–U10 to present/absent based on current tree (domain/ports/config present; adapters, supabase migrations, sweep, HTTP absent).
**Patterns to follow:** Tone and accuracy of `.env.example` comments; architecture comments in `scripts/lint-arch.mjs`.
**Test scenarios:**
- Happy path: each of the four surfaces exists and links to at least one real repo path that exists today.
- Edge case: ops doc does not document a non-existent `smoke` script.
- Error path: N/A (documentation).
**Verification:** Spot-check every repo-relative link target exists; status map matches filesystem presence for adapters and migrations.

### U2. Thin root entrypoints

**Goal:** Replace the placeholder README and add `AGENTS.md` as pointers into `docs/`.
**Requirements:** R2, R3, R10, R14
**Dependencies:** U1
**Files:**
- modify: `README.md`
- create: `AGENTS.md`
**Approach:**
1. Replace `hi testing` with a short project blurb, link to `docs/README.md`, and the four primary doc links.
2. `AGENTS.md`: authority hierarchy (product plan → harness docs → code), link to docs index, reminder not to invent product behavior, pointer to status for unfinished work, brief note that commits/pushes wait for explicit user ask.
**Execution note:** Prefer install/runtime smoke of link targets over unit tests.
**Test scenarios:**
- Happy path: both files mention `docs/` and the lead-finder plan path.
- Edge case: neither file restates full R1–R25.
**Verification:** Opening either file reaches docs index in one hop; no placeholder-only README remains.

### U3. Cursor project rules

**Goal:** Add thin `.mdc` rules that catch high-cost agent mistakes.
**Requirements:** R11–R13
**Dependencies:** U1
**Files:**
- create: `.cursor/rules/product-authority.mdc`
- create: `.cursor/rules/hexagonal-architecture.mdc`
**Approach:**
1. `product-authority.mdc`: `alwaysApply: true`; cite lead-finder plan and `docs/product/non-negotiables.md`; forbid inventing segments, budgets, or ToS posture.
2. `hexagonal-architecture.mdc`: glob `src/**/*.ts` (and tests if useful); domain must not import adapters; inbound must not import outbound; run/respect `lint:arch`.
3. Keep bodies short; link to `docs/architecture/hexagonal.md` for detail.
**Patterns to follow:** Cursor `.mdc` frontmatter (`description`, `globs`, `alwaysApply`) per create-rule skill.
**Test scenarios:**
- Happy path: both files have YAML frontmatter and non-empty bodies.
- Edge case: hexagonal rule is not always-on if product-authority already covers universal constraints (prefer glob scoping).
**Verification:** Rules are under `.cursor/rules/` with `.mdc` extension; plain `.md` rules are not used.

### U4. Harness coherence pass

**Goal:** Ensure entrypoints, docs, and rules form one coherent package with no dead links or conflicting authority claims.
**Requirements:** R5, R10, R12
**Dependencies:** U1, U2, U3
**Files:**
- modify as needed: any files from U1–U3
**Approach:**
1. Walk every markdown link introduced by this work; fix broken targets.
2. Confirm no harness file claims product authority over the lead-finder plan.
3. Confirm status map still matches the tree at handoff.
**Test expectation:** none -- documentation coherence check; no new automated test suite required unless the implementer adds a tiny link-check script (optional, not required).
**Verification:** Manual checklist: README → docs index → each surface; AGENTS → same; both rules cite docs paths that exist.

---

## Verification Contract

- Docs links: every new markdown link resolves to an existing repo-relative path.
- Scripts named in ops docs ⊆ `package.json` `scripts`.
- `npm run lint:arch` still passes (harness must not change domain imports).
- Optional: `npm run typecheck` and `npm test` still pass if any code was touched (expected: no code touch).

---

## Definition of Done

- U1–U4 complete per their verification fields.
- Cold-session bar met: product orientation, architecture, and run/continue are reachable from root entrypoints.
- Lead-finder plan file untouched.
- No commit/push unless the user explicitly asks.

---

## Risks & Dependencies

- **Drift risk:** Status map will go stale as implementation continues — mitigate by stating “update when finishing a lead-finder unit” in the status doc.
- **Authority drift:** Summaries in non-negotiables could slowly become a second PRD — mitigate with explicit “plan wins on conflict” wording.
- **Context bloat:** Always-on rules that paste the whole product contract — mitigate via KTD1 thin always-on rule.

## Sources & Research

- Repo grounding: `docs/plans/2026-08-11-001-feat-websiteless-lead-finder-plan.md`, `scripts/lint-arch.mjs`, `.env.example`, `package.json`, current `src/` layout.
- External (load-bearing for KTD1): 2026 Cursor guidance on `AGENTS.md` (portable) vs `.cursor/rules/*.mdc` (scoped activation); prefer `.mdc` over legacy `.cursorrules`.
- No `docs/solutions/` learnings present.
