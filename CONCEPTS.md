# Concepts

> Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Documentation harness

### Product authority

The document that governs product behavior when sources disagree. In this repo, the lead-finder unified plan (`docs/plans/2026-08-11-001-feat-websiteless-lead-finder-plan.md`, lead-finder R1–R25) is product authority; harness summaries and agent rules cite it and never override it.

### Harness docs

The `docs/` tree (product, architecture, ops, status) plus thin root pointers in `README.md` and `AGENTS.md`. Onboarding and agent orientation live here; implementation-ready plans under `docs/plans/` remain the detailed specs.

### Implementation status map

The documentary table in `docs/status/implementation.md` that maps lead-finder plan units to what exists in the repository. Updated manually when a unit completes — not generated from git.

## Lead finder (core domain)

### Segment

A qualification label for a place that needs a website: `no_website`, `social_only`, `parked_or_dead`, `poor_website`, or `unverified` when probe transport fails. Exactly one segment per evaluated place, assigned by first match in that order.

### Sweep

A single run that tiles a geographic area, discovers places through Google APIs, probes websites, classifies, scores, persists results, and returns capped ordered place IDs.

## Hexagonal structure

### Port

An application-owned interface that describes what the domain needs from the outside world (discovery, geocoding, probing, persistence) without naming a vendor or transport.

### Inbound adapter

Code that accepts requests from the outside (for example HTTP) and calls into the application. It must not import outbound adapters; it reaches them only through ports and application types.

### Outbound adapter

Code that implements a port against a concrete dependency (Google Places, Supabase, DNS/HTTP probe). It may throw provider-specific errors that extend application-owned base errors so inbound can map failures without importing outbound modules.

### Application-owned error

A failure type defined in the application layer for HTTP (or other inbound) mapping — for example quota exhausted or upstream failure — that outbound adapters specialize and inbound adapters catch.
