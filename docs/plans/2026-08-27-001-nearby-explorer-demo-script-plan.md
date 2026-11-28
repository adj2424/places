# Nearby explorer — 10-minute internal demo script

Created: 2026-08-27

Live-first talk for teammates (~10 minutes). Product is the main why (usable nearby search: address or my location, then call or open maps). Architecture and the AI coding harness are supporting beats, not the opening.

Spoken lines are meant to be read almost as-is. Skip the optional failure beat if the happy path runs long.

---

## Prep (not spoken)

- Places on port **3001**, Nearby explorer on **3000**, CORS plugin enabled (see `README.md`).
- Pick a real nearby address you trust.
- DevTools → Network, filter `find-places`.
- Optional: second terminal with `curl -s http://127.0.0.1:3001/health`.
- If Google or CORS flakes, jump to [Backup](#backup-if-live-search-fails).

---

## 0:00–0:45 — Why this exists

This is Nearby explorer. I wanted a real nearby search I can use: pick an address or my location, see what’s around, then call or open maps.

Google’s nearby APIs are capable, but they’re not a product. Places is a small service that owns the contract: one origin, a radius, our category keys, a list of places without websites. This UI is the explorer on top of that — so the use case is visible, not just a curl.

I’ll click through first, then I’ll show how the two sides fit, and how we actually built this with AI in the loop.

---

## 0:45–2:30 — Happy path: address search

**Do:** Address mode. Type a known address. Radius something readable on the map (for example 500–1000 m). Check **food and drink**. Search.

**Expect:** List filling, map drawing a circle.

That request is not “search Google from the browser.” The form builds a Places body: either coordinates or an address — never both — plus radius, plus category keys like `foodAndDrink`, not Google’s type strings. The browser `POST`s `/find-places`. Places geocodes the address if needed, talks to Google Nearby Search, and returns `{ places, total }`.

We’re not inventing a map of every result. `NearbyPlace` has no coordinates. The map is the **search area**: origin plus radius. The list is the outcome of that search.

---

## 2:30–4:00 — Use the results

**Do:** Scroll the list. Point at name, address, types. Click **call** if a phone exists, or **open in maps**.

That’s the loop I wanted: find something nearby, then act. Empty list is still success — Places ran; nothing matched. That’s different from “the address was unusable” or “the service failed.”

---

## 4:00–5:15 — My location

**Do:** Switch to current location. Grant permission. Search again (optionally a different category).

Same contract, other location mode: lat/lng, no address key. The map origin is known immediately. Address search is the opposite: Places gets the string; Nominatim only places the circle for display. If Nominatim misses, the list can still be right and we say the map couldn’t place the address.

**If permission denied:** That’s expected — we send you back to address. We don’t fake a pin.

---

## 5:15–6:30 — Backend, live

**Do:** Network tab on the last search. Show `POST /find-places`. Optionally `GET http://127.0.0.1:3001/health`.

Two processes: Vite UI on 3000, Places on 3001. No Vite proxy; CORS is an operator plugin on purpose. Places is hexagonal: HTTP adapters in, domain/service in the middle, Google geocoding and nearby search out. Domain doesn’t import Express. Composition wires one app.

Health is “is the process up,” not “will this search succeed.” Find-places maps failures honestly: 400 for a bad body or unmatched address, 502 when Google is unavailable. The UI maps those to **invalid**, **too many types**, or **retryable** — not one generic toast.

**Optional ~20s if time remains:** Garbage address → invalid copy; or too many categories → deselect some. Skip if the happy path already ate the clock.

---

## 6:30–8:15 — Why the stack looks like this

I wanted the use case to stay small and true:

- **One origin, one radius, a list.** Map shows the query, not fake result pins.
- **Catalog keys, not Google types in the form.** Places expands keys; if that blows Google’s included-primary-types cap, we say so instead of failing mysteriously.
- **Two repos, two layouts.** Places: ports and adapters. Front: search / map / places-client / results, wired only in `App.tsx`. We don’t copy the backend’s hexagonal folders into Vite.
- **Living docs over chat.** `AGENTS.md` and architecture are the contract. Old plans are snapshots.

That’s the architecture I want teammates to remember: a thin, honest explorer on a thin, honest service.

---

## 8:15–9:45 — How we built it with AI

This wasn’t “generate an app and hope.” Agents work in this repo against a harness.

**Always / Ask / Never** in `AGENTS.md`: add work in the matching folder; don’t add result pins; don’t add a proxy to “fix” CORS; don’t write tests unless asked; don’t treat last week’s plan as the recipe.

Typical loop: describe the change → a plan under `docs/plans/` → implement in the live folders → run existing `npm test` and `npm run build`. Compound-style skills for plan vs implement vs debug, but the **repo files** are what keep the agent from drifting.

Different repo, different recipe. Places agents follow `domain → service → adapters → buildApp`. Front agents must not copy that.

AI is fast at the boilerplate and the wiring. The value is the constraints: XOR body, search-area map, error kinds, living docs. Without those, you get a maps demo with invented pins and a proxy that hides CORS.

---

## 9:45–10:00 — Close

So: a nearby explorer you can actually use, a Places service that owns the Google call, and an AI workflow that stays inside a written contract.

Happy to go deeper on the XOR request, error mapping, or a specific plan we shipped.

---

## Timing cheat sheet

| Clock | Beat |
| --- | --- |
| 0:00 | Why: usable nearby search |
| 0:45 | Address + category search |
| 2:30 | Call / maps |
| 4:00 | My location |
| 5:15 | Network + health |
| 6:30 | Stack choices |
| 8:15 | AI harness |
| 9:45 | Close |

---

## Backup if live search fails

Stay on the UI. Show the form (XOR modes, categories, radius). Open Network or a saved 200 JSON. Say Places maps Google → `{ id, name, address, phone, types, primaryType }`. Don’t debug CORS on stage for more than 15 seconds.

---

## Don’t say

- Don’t promise result pins, a public deploy, or that `/health` proves Google Places auth (live health is a simple outbound probe).
- Don’t dump hexagonal jargon in the opening — keep it in the 6:30 beat.
- Don’t treat `docs/plans/` snapshots as the live recipe; point at `AGENTS.md` and `docs/architecture.md`.
