---
title: "Style Nearby explorer chrome with Tailwind v4 via @tailwindcss/vite, not portfolio 3.4 PostCSS"
date: 2026-08-26
category: tooling-decisions
module: panel-chrome
problem_type: tooling_decision
component: tooling
severity: medium
applies_when:
  - "Adding or changing Nearby explorer panel chrome (search, map, results, App shell)"
  - "Tempted to copy the operator portfolio Tailwind 3.4 + PostCSS + tailwind.config.js stack"
  - "Naming theme tokens in src/index.css or mapping Leaflet Circle/CircleMarker colors"
  - "Enabling Tailwind Preflight while leftover BEM still exists"
  - "Updating AGENTS.md or docs/architecture.md after chrome or package-script changes"
related_components:
  - "frontend_stimulus"
  - "documentation"
  - "development_workflow"
tags:
  - "tailwind-v4"
  - "tailwindcss-vite"
  - "panel-chrome"
  - "theme-tokens"
  - "preflight"
  - "leaflet-css"
  - "system-dark"
  - "sr-only"
---

# Style Nearby explorer chrome with Tailwind v4 via @tailwindcss/vite, not portfolio 3.4 PostCSS

## Context

This nearby-explorer restacked visual chrome from a global BEM stylesheet onto Tailwind v4 utilities on JSX. The work is uncommitted on `main` as of this writing (GitHub PR list not checked; `gh` unavailable). Search, Places `POST /find-places`, XOR request building, and Nominatim display geocode stay the same product behavior; only how chrome is expressed changed.

The friction was two writing systems: panel look lived in a CSS file with BEM class names, while other sites the author maintains write utilities on the markup. Keeping both meant every visual change had to be invented twice. Per this session, another repo was allowed as the *class-writing habit*, not as a look to copy and not as a Tailwind 3.4 PostCSS toolchain to clone.

A snapshot plan (`docs/plans/2026-08-26-006-feat-tailwind-css-plan.md`) records those decisions. Living docs plus the live tree win on layout: `AGENTS.md` and `docs/architecture.md` now name utilities on JSX and tokens in `src/index.css`. Snapshot plans are history, not the operating recipe.

Two traps the restack had to avoid:

1. Cloning Tailwind 3.4 PostCSS (`postcss.config`, `tailwind.config.js`, `@tailwind` directives) on a Vite 8 app that already uses the v4 Vite plugin path.
2. Shipping Tailwind Preflight (`@import 'tailwindcss'`) while leftover BEM `src/App.css` still applied layout rules. Preflight sets `img { max-width: 100% }`, which fights Leaflet tiles; leftover BEM layout plus utility layout would compete instead of one writing system.

## Guidance

### Toolchain (v4 Vite plugin, keep the Places port)

Install and wire Tailwind v4 through Vite, not PostCSS:

- `package.json` lists `tailwindcss` `^4.3.3` and `@tailwindcss/vite` `^4.3.3` as devDependencies (`package.json:37` and `package.json:23`). There is no `postcss` or `@tailwindcss/postcss` dependency in `package.json`.
- `vite.config.ts` imports `tailwindcss` from `@tailwindcss/vite` (`vite.config.ts:3`) and registers `tailwindcss()` in `plugins` (`vite.config.ts:11`).
- Keep the existing Vite server contract: `server.port` `3000` and `strictPort: true` (`vite.config.ts:13-16`). Do not “fix” CORS or Places by moving the frontend off 3000; Places stays on its own origin (default `http://127.0.0.1:3001` in `src/places/find-places-client.ts:7`).
- There is no `postcss.config` and no `tailwind.config.js` at the repo root. Do not add them for this restack.
- CSS entry is `@import 'tailwindcss';` in `src/index.css:1`, not `@tailwind` directives.

`package-lock.json` may still contain a transitive `postcss` package because other tools pull it; that is not a project PostCSS config and is not the styling entry.

### Theme tokens in `src/index.css` (not `--text`)

Define explorer colors and the panel shadow in `@theme` using `--color-*` (Tailwind v4 color namespace) plus `--font-sans` and `--shadow-panel`:

```3:15:src/index.css
@theme {
  --font-sans: system-ui, 'Segoe UI', Roboto, sans-serif;
  --color-fg: #3f3a48;
  --color-heading: #141218;
  --color-muted: #6b6375;
  --color-bg: #f7f5f2;
  --color-surface: #fff;
  --color-border: #e5e4e7;
  --color-accent: #1d4ed8;
  --color-accent-hover: #1e40af;
  --color-danger: #b42318;
  --shadow-panel: 0 10px 24px -16px rgb(20 18 24 / 0.35);
}
```

Use `--color-fg`, not a `--text` or `--color-text` token. Utilities then read as `text-fg`, `text-heading`, `text-muted`, `bg-bg`, `bg-surface`, `border-border`, `bg-accent`, `hover:bg-accent-hover`, `text-danger`, `shadow-panel`, `font-sans`. `index.html` applies the page chrome: `class="scheme-light-dark"` on `<html>` (`index.html:2`) and `class="m-0 bg-bg font-sans text-fg antialiased"` on `<body>` (`index.html:9`). `src/main.tsx` imports only `./index.css` (`src/main.tsx:3`); it does not import `App.css`.

### Dark: system `prefers-color-scheme`, no `.dark` class

Override the same tokens under `@layer theme` with `@variant dark` nested on `:root, :host`:

```17:33:src/index.css
@layer theme {
  :root,
  :host {
    @variant dark {
      --color-fg: #d7d3de;
      --color-heading: #f5f3f8;
      --color-muted: #a39eab;
      --color-bg: #121318;
      --color-surface: #1b1c23;
      --color-border: #2e303a;
      --color-accent: #60a5fa;
      --color-accent-hover: #93c5fd;
      --color-danger: #f97066;
      --shadow-panel: 0 12px 28px -18px rgb(0 0 0 / 0.7);
    }
  }
}
```

Do not add `@custom-variant`. Do not introduce a `.dark` class or a JS theme toggle for this restack. Default dark is the engine’s `prefers-color-scheme` mapping of `@variant dark`. `scheme-light-dark` on `<html>` participates in CSS `color-scheme`; it is not a class-based dark strategy.

### Panel chrome: utilities on JSX, no `@apply`

Put chrome on the markup. Do not rebuild BEM with `@apply` in CSS.

Living docs state the split:

- `AGENTS.md` architecture map: “Panel chrome | Tailwind utilities on JSX; theme tokens in `src/index.css`” (`AGENTS.md:27`).
- Feature recipe step 2: “Put panel chrome as Tailwind utilities on the markup. Theme tokens live in `src/index.css`.” (`AGENTS.md:71`).
- `docs/architecture.md`: “Panel chrome is Tailwind utilities on JSX. Theme tokens and Tailwind entry live in `src/index.css`. Leaflet vendor CSS stays imported on the search-area map module.” (`docs/architecture.md:19`).

Delete `src/App.css` rather than leaving it beside Preflight. If a leftover BEM sheet reappears, remove it in the same change as `@import 'tailwindcss'`. Do not ship Preflight while leftover BEM `App.css` exists.

Layout chrome in `src/App.tsx`:

- Page column: `mx-auto max-w-6xl px-5 py-6 pb-10` (`src/App.tsx:105`).
- Map + list: `grid items-start gap-4 md:grid-cols-2` (`src/App.tsx:126`).
- Map fallback while lazy-loading: `min-h-72` panel (`src/App.tsx:129`).

Search form: includes `mb-5 grid gap-4 rounded-xl border border-border bg-surface p-4 shadow-panel` (`src/search/SearchForm.tsx:127`). Origin radios use a visually hidden legend: `<legend className="sr-only">Search origin</legend>` (`src/search/SearchForm.tsx:134`).

Results: shared panel string `rounded-xl border border-border bg-surface p-4` (`src/results/PlaceList.tsx:11`). Result list max height follows the map: `max-h-72` / `md:max-h-96` (`src/results/PlaceList.tsx:77`).

### Leaflet: vendor CSS, hex `pathOptions`, Preflight tile override

Keep Leaflet’s own stylesheet on the map module: `import 'leaflet/dist/leaflet.css'` (`src/map/SearchAreaMap.tsx:4`). Do not restyle tiles and controls to match panel chrome.

Origin marker and radius circle keep hex `pathOptions` (not Tailwind classes — Leaflet path APIs are not `className` chrome):

```55:72:src/map/SearchAreaMap.tsx
            <CircleMarker
              center={[origin.lat, origin.lng]}
              radius={6}
              pathOptions={{
                color: '#1d4ed8',
                fillColor: '#1d4ed8',
                fillOpacity: 1,
              }}
            />
            <Circle
              center={[origin.lat, origin.lng]}
              radius={radiusMeters}
              pathOptions={{
                color: '#1d4ed8',
                fillColor: '#3b82f6',
                fillOpacity: 0.15,
              }}
            />
```

Map height: wrapper `min-h-72` (`src/map/SearchAreaMap.tsx:39`) and `MapContainer` `h-72 w-full md:h-96` (`src/map/SearchAreaMap.tsx:46`).

Because Tailwind Preflight sets `img { max-width: 100% }`, OSM tiles inside `.leaflet-container` shrink unless overridden. The override lives in `@layer base`:

```35:39:src/index.css
@layer base {
  .leaflet-container img {
    max-width: none;
  }
}
```

That is a Leaflet/Preflight coexistence rule, not a return to BEM panel chrome.

### What not to copy

- Do not copy another site’s look (palette, type scale, or layout). Tokens above are this explorer’s palette.
- Do not copy a Tailwind 3.4 PostCSS toolchain (`postcss.config`, `tailwind.config.js`) onto this Vite 8 app.
- Do not add result pins or invent `NearbyPlace` coordinates (`NearbyPlace` has `id`, optional `name` / `address` / `phone` / `types` / `primaryType` only — `src/places/types.ts:1-8`).
- Do not add tests for `className`. Existing colocated tests do not assert `className`. `AGENTS.md` still forbids creating tests unless the user asked (`AGENTS.md:58`). Per this session, verification is existing `npm test` / `npm run build` plus browser smoke of light/dark, stacked vs `md:grid-cols-2`, and map tiles.
- Do not change Places, `buildFindPlacesBody`, or `geocodeAddress` as part of a chrome restack. `App` still calls `findPlaces` (`src/App.tsx:83`) and `geocodeAddress` for address-mode map origin (`src/App.tsx:70`). Search form still builds XOR bodies via `buildFindPlacesBody` (`src/search/SearchForm.tsx:79-88`, `src/search/SearchForm.tsx:104-115`).

## Why This Matters

Utilities-on-JSX plus tokens-in-`index.css` is one writing system. A future spacing or radius change is a utility on the element, not a new BEM modifier and not a parallel CSS file. Tokens keep light/dark as this explorer’s colors without a second palette borrowed from another site.

The Vite plugin path matches Tailwind v4 on Vite 8. A 3.4 PostCSS clone would add config files this tree does not use and would fight the already-registered `tailwindcss()` plugin.

Preflight without the Leaflet `max-width` override can clip OSM tiles (Preflight’s `img { max-width: 100% }` vs Leaflet `<img>` tiles). Shipping Preflight *and* leftover `App.css` leaves BEM layout fighting utility layout. Deleting `App.css` when enabling `@import 'tailwindcss'` is a correctness constraint, not cleanup taste.

Keeping `server.port` `3000` and `strictPort: true` preserves the local CORS story documented in README: the frontend origin stays stable; Places is a separate origin. Restyling is not an excuse to add a Vite proxy (`AGENTS.md:60`).

Tests that asserted BEM class names would lock chrome to strings that this restack removed. Existing colocated tests (search-request, SearchForm, Places client, geocode, bounds, PlaceList) stay contract tests — not `className` strings.

## When to Apply

- Adding or changing panel chrome (form, list, map frame, header, map-miss notice): utilities on JSX; new colors or shadows as `--color-*` / `--shadow-*` in `src/index.css` `@theme`, with dark overrides in the `@variant dark` block.
- Changing layout rhythm: Tailwind default scale (`max-w-6xl`, `md:grid-cols-2`, `h-72` / `md:h-96`), not a rem-for-rem restoration of the old BEM sheet and not a custom 800px breakpoint unless product asks.
- Touching Leaflet: keep `leaflet/dist/leaflet.css` on `SearchAreaMap`; keep hex `pathOptions`; keep `.leaflet-container img { max-width: none }`.
- Considering a “standard” Tailwind setup from another repo: if it is v3.4 + PostCSS + `tailwind.config.js`, do not copy it here.
- Considering `@apply` to recreate BEM class names: do not; that reintroduces a CSS-file writing system.
- Considering a `.dark` class or `@custom-variant` for a toggle: out of scope for this restack unless product explicitly adds a theme switch; current dark is system preference.
- Considering tests for the restack: only if the user asked; do not add tests to “complete” a chrome change.
- Changing Places URL, XOR body, or Nominatim: not this pattern — that is product/search behavior, not chrome.

## Examples

**Page shell (utilities + tokens), uncommitted on `main`**

`index.html` and `App.tsx` compose the column and two-pane grid without a BEM block:

```9:9:index.html
  <body class="m-0 bg-bg font-sans text-fg antialiased">
```

```105:126:src/App.tsx
    <div className="mx-auto max-w-6xl px-5 py-6 pb-10">
      <header className="mb-5">
        <h1 className="mb-1.5 text-3xl font-semibold tracking-tight text-heading">
          Nearby explorer
        </h1>
        ...
      </header>
      ...
      <div className="grid items-start gap-4 md:grid-cols-2">
```

**Accessible origin legend without `@apply`**

The search-origin fieldset legend is screen-reader-only via the Tailwind `sr-only` utility, not a custom CSS class:

```130:134:src/search/SearchForm.tsx
      <fieldset
        className="m-0 flex flex-wrap gap-4 border-0 p-0"
        disabled={disabled}
      >
        <legend className="sr-only">Search origin</legend>
```

**Wrong: PostCSS Tailwind 3.4 on this app**

Do not add `postcss.config.js` with `@tailwindcss/postcss`, `tailwind.config.js` content globs, or `@tailwind base; @tailwind components; @tailwind utilities;` in `index.css`. This tree’s entry is `@import 'tailwindcss'` plus `tailwindcss()` in Vite (`src/index.css:1`, `vite.config.ts:11`).

**Wrong: Preflight + leftover BEM `App.css`**

Do not keep a BEM `src/App.css` imported next to `src/index.css` after enabling Preflight. `main.tsx` should import only `./index.css` (`src/main.tsx:3`). If `App.css` is present, delete it in the same change.

**Wrong: `--color-text` / `--text` instead of `--color-fg`**

Heading and body colors are `--color-heading` and `--color-fg`. Using `--text` as a token name does not match the live `@theme` block (`src/index.css:5-6`) and will not generate `text-fg`.

**Leaflet tile fix vs changing search behavior**

If tiles look clipped after the restack, check `.leaflet-container img { max-width: none }` (`src/index.css:36-38`) before touching `findPlaces` or `geocodeAddress`. Per this session, Places/search-request/geocode behavior is unchanged by the chrome work.

## Related

- Living recipe: `AGENTS.md` (panel chrome row, numbered feature recipe step 2, Never on unsolicited tests and Vite proxy).
- Folder roles: `docs/architecture.md` (utilities on JSX, tokens and Tailwind entry in `src/index.css`, Leaflet CSS on the map module).
- Snapshot (history, not the operating recipe): `docs/plans/2026-08-26-006-feat-tailwind-css-plan.md`.
- Adjacent tooling: [Vite listens on 3000; Places client defaults to 3001](vite-default-port-3000-places-on-3001.md) — same `vite.config.ts`; keep `server.port` / `strictPort` when adding `tailwindcss()`.
- Same map module, different problem: [Leaflet Circle.getBounds crashes when the layer is not on the map](../runtime-errors/leaflet-circle-getbounds-unmapped-layer.md).
- Shared UI surface, not CSS: [Map Places HTTP failures by status, JSON shape, and address vs coordinates](../conventions/find-places-invalid-vs-retryable-mapping.md).
- Exemplars in tree: `src/search/SearchForm.tsx`, `src/results/PlaceList.tsx`, `src/map/SearchAreaMap.tsx`, `src/App.tsx`, `src/index.css`, `vite.config.ts`.
- No GitHub PR is cited: uncommitted on `main` as of this writing.
