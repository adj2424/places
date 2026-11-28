---
title: Leaflet Circle.getBounds crashes when the layer is not on the map
date: 2026-08-26
category: runtime-errors
module: map
problem_type: runtime_error
component: frontend_stimulus
symptoms:
  - "Uncaught TypeError: Cannot read properties of undefined (reading 'layerPointToLatLng')"
  - "App crash after submitting a search (e.g. oakhill 20171) when SearchAreaMap fits the view to the search radius"
  - "Stack traces to Leaflet Circle.getBounds from FitToCircle in SearchAreaMap.tsx"
root_cause: wrong_api
resolution_type: code_fix
severity: high
related_components:
  - "testing_framework"
tags:
  - "leaflet"
  - "react-leaflet"
  - "search-area-map"
  - "circle-getbounds"
  - "fitbounds"
  - "unmapped-layer"
---

# Leaflet Circle.getBounds crashes when the layer is not on the map

## Problem

After a successful address geocode, the search-area map tried to fit the viewport to the origin circle and threw `Uncaught TypeError: Cannot read properties of undefined (reading 'layerPointToLatLng')`. The search query was incidental: any origin that reached `FitToCircle` triggered the same path. The fix is pending in the working tree (uncommitted/unmerged as of this writing). GitHub PR state was not checked (`gh` unavailable).

## Symptoms

- Console: `Uncaught TypeError: Cannot read properties of undefined (reading 'layerPointToLatLng')` during search-area fit (observed after geocoding e.g. `"oakhill 20171"`).
- Fit crashed as soon as `origin` was set: committed `FitToCircle` built an unbound `L.circle` and called `getBounds()`. The working copy instead runs `map.fitBounds(boundsForSearchArea(origin, radiusMeters), …)` (`src/map/SearchAreaMap.tsx:22-26`).
- Per this session’s isolation, an unbound `L.circle` had `_map`, `_point`, and `_radius` undefined when `getBounds()` ran.
- Places API being down is unrelated; it does not produce this TypeError.

## What Didn't Work

- Treating the query string (`"oakhill 20171"`) as the cause. Geocoding succeeded; the crash was on viewport fit, so any successful origin would fail the same way.
- Computing bounds with `L.circle(…).getBounds()` without adding the circle to a map. Leaflet `Circle.getBounds` does `this._map.layerPointToLatLng(this._point.subtract(half))` (`node_modules/leaflet/src/layer/vector/Circle.js:58-63`). `_map` is not set until the layer is on a map; `_point` / `_radius` are filled in `_project` (`Circle.js:68-100`), which also requires `this._map`.
- Debugging the geocoder or Places API. Those failures are a separate outage; they do not throw `layerPointToLatLng`.

## Solution

**Before** (pattern that crashed; still on `main`/`origin/main` as `L.circle` then `circle.getBounds()`; gone from the working copy): construct a circle that is never added to a map, then call `getBounds()`:

```js
return L.circle([origin.lat, origin.lng], { radius: radiusMeters }).getBounds()
```

**After** (pending in the working tree): geographic bounds from `LatLng.toBounds`, passing **diameter** so the half-size matches the circle radius.

`src/map/search-area-bounds.ts:3-8`:

```ts
export function boundsForSearchArea(
  origin: { lat: number; lng: number },
  radiusMeters: number,
) {
  // Leaflet toBounds() uses full width; a circle of radius R needs diameter 2R.
  return L.latLng(origin.lat, origin.lng).toBounds(radiusMeters * 2)
}
```

`FitToCircle` still calls that helper, then `map.fitBounds` (`src/map/SearchAreaMap.tsx:22-26`). The visible `Circle` / `CircleMarker` remain react-leaflet children on the map (`SearchAreaMap.tsx:49-70`) and are not used for the fit calculation.

## Why This Works

`Circle.getBounds` is a **projected** API: it converts layer pixels around `_point` using `_map.layerPointToLatLng` (`Circle.js:58-63`). Those fields exist only after the circle is added and `_project` has run (`Circle.js:68-100`). An unbound circle therefore hits `undefined.layerPointToLatLng`.

`LatLng.toBounds(sizeInMeters)` does not use a map. Leaflet documents that each boundary is `sizeInMeters/2` meters from the point (`node_modules/leaflet/src/geo/LatLng.js:85-86`). Implementation (`LatLng.js:87-93`):

```js
toBounds: function (sizeInMeters) {
  var latAccuracy = 180 * sizeInMeters / 40075017,
      lngAccuracy = latAccuracy / Math.cos((Math.PI / 180) * this.lat);
  return toLatLngBounds(
          [this.lat - latAccuracy, this.lng - lngAccuracy],
          [this.lat + latAccuracy, this.lng + lngAccuracy]);
},
```

`sizeInMeters` is full width (and height in this spherical approximation). A search circle of radius `R` needs extent `2R` on each axis, so the call is `.toBounds(radiusMeters * 2)` (`search-area-bounds.ts:7-8`). Passing `R` would fit a box whose half-width is `R/2` (too tight).

Per this session: vitest `20/20`; browser search showed the Oak Hill circle and no `FitToCircle` / `layerPointToLatLng` error.

## Prevention

- Do not call `L.circle(…).getBounds()` (or other methods that read `_map` / `_point`) unless the circle is on a map. For map-independent geographic boxes, use `L.latLng(…).toBounds(diameterMeters)`.
- Keep fit-bounds math in a pure helper so it can be unit-tested without a Leaflet map instance. `boundsForSearchArea` is covered by `src/map/search-area-bounds.test.ts:4-13`: origin contained, north/south/east/west strictly outside the origin, **without** attaching a circle.
- When copying Leaflet examples that chain `L.circle(…).addTo(map).getBounds()`, do not drop `addTo` and keep `getBounds`.
- If `toBounds` is used for a circle of radius `R`, always pass `2 * R`; add a comment at the call site (`search-area-bounds.ts:7`) so a later “cleanup” does not revert to radius-as-size.
- A regression that reintroduces unbound `getBounds` will throw the same `layerPointToLatLng` TypeError as soon as `origin` is non-null; keep the helper test and a one-shot search-area fit in the browser after map changes.

## Related Issues

- No related docs in `docs/solutions/` at the time of writing.
- GitHub issue/PR search was skipped (`gh` CLI not available in this environment).
