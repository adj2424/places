# Implementation status

Tracks progress against the lead-finder plan [`docs/plans/2026-08-11-001-feat-websiteless-lead-finder-plan.md`](../plans/2026-08-11-001-feat-websiteless-lead-finder-plan.md). **Update this file when you finish a lead-finder unit** — it is documentary, not generated.

Last reviewed: 2026-08-11 (U2–U10 landed; local gates green).

## Summary

| Area | Status |
|------|--------|
| Domain (tiling, qualification, scoring) | Present + tests |
| Application ports | Present |
| Config / env schema | Present |
| Architecture lint | Present |
| Supabase migrations | Present |
| Google Places adapter | Present + fixture tests |
| Website probe adapter | Present + fixture tests |
| Supabase repository adapters | Present + mocked RPC tests |
| Sweep orchestration | Present + fake-port tests |
| HTTP endpoint | Present + inject tests |

## Lead-finder units (U1–U10)

| Unit | Title | Status | Notes |
|------|-------|--------|-------|
| U1 | Project scaffold and hexagonal skeleton | **Done** | Ports, models, config, `lint:arch`, wired `main.ts` |
| U2 | Supabase schema and migrations | **Done** | `supabase/migrations/0001`–`0005`; structural tests (no local Supabase CLI) |
| U3 | Tiling engine | **Done** | |
| U4 | Google Places discovery adapter | **Done** | Nearby + Text Search, DISTANCE rank, field mask, retries |
| U5 | Qualification, quality thresholds, exclusions | **Done** | |
| U6 | Website probe adapter | **Done** | DNS/HTTP signals only; bounded concurrency |
| U7 | Lead scoring | **Done** | |
| U8 | Supabase repository adapters | **Done** | Upsert RPC preserves operator + snapshot columns |
| U9 | Sweep orchestration service | **Done** | Fake-adapter coverage of F1/F2 flows |
| U10 | Inbound HTTP adapter | **Done** | `POST /sweep` |

## Remaining for Definition of Done

- Apply migrations with `supabase db reset` once the CLI/project exists.
- Live smoke at the 5 km ceiling (`npm run smoke`) needs real Google + Supabase credentials and a billing alert.
- Manual quality sample of returned leads.

## Verification snapshot

`npm test`, `npm run typecheck`, and `npm run lint:arch` pass.
