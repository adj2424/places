# Product non-negotiables

**Authority:** Full requirements are in [`docs/plans/2026-08-11-001-feat-websiteless-lead-finder-plan.md`](../plans/2026-08-11-001-feat-websiteless-lead-finder-plan.md) (lead-finder R1–R25). This page is a navigation aid only — if anything here disagrees with that plan, the plan wins.

## What this service does

Internal lead-generation API: given an address or lat/lng plus a radius, enumerate local businesses, verify website need, classify, score, persist to Supabase, return ordered place IDs.

## Settled decisions (do not reinvent)

| Topic | Decision |
|-------|----------|
| Data source | Google Places API (New) only — not Overture or OSM for discovery |
| ToS posture | Operator accepts storing full business records (names, addresses, phones); only place IDs are indefinitely ToS-safe |
| Market | Northern Virginia; remote sales |
| Output (v1) | Supabase table editor — no custom UI |
| Segments | `no_website`, `social_only`, `parked_or_dead`, `poor_website`, plus `unverified` for probe transport failures |
| Scoring | 0–100 heuristic; social-only weight = 0; ~15% random holdout in capped response (cap 50) |
| Sweep budgets | Radius ceiling 5000 m, request budget 2000, wall-clock 45 s, min cell 250 m |
| Email | No Places field — scrape opportunistically from fetched pages only |

## Before changing product behavior

1. Read the relevant sections in the lead-finder plan (Requirements, Key Flows, KTDs).
2. Do not add segments, budgets, or data sources without explicit user direction.
3. See [implementation status](../status/implementation.md) for what is not built yet.
