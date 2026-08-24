# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Layout

### Hexagonal layout

The project’s ports-and-adapters shape: domain and service stay free of HTTP/framework types; adapters handle transport; composition wires them together. Swapping an inbound HTTP library is an adapter change, not a domain rewrite.
_Avoid:_ “just put routes in the use case,” framework-first layering; naming the use-case layer “application”

### Living docs

The current product and layout contract for humans and agents. On conflict with older plans or past solution writeups, living docs plus the composition root win.
_Avoid:_ treating historical plans as the operating recipe

### Snapshot

A past plan or documented solution kept for history. It is not the current layout contract unless a dedicated refresh updates it.
_Avoid:_ copying snapshot layer names into the current feature recipe

### Composition root

The shared app factory that registers inbound adapters and returns an Express app without listening. Callers (process entry and HTTP tests) load config and create the logger, then pass both into the factory. Listening belongs at process entry, not in the factory.
_Avoid:_ separate “test-only” app wiring that re-registers routes differently

### Bootstrap logger

A fixed-severity native Pino logger used at process entry when configuration is not yet available, so fatal startup failures (config validation, listen errors) still emit before exit. Created with `createLogger('error')` because the configured log level cannot be read when parsing fails. Config-load failure is logged Error-first with a message string (Pino's call shape). Local operator-facing output is colorized pretty, not JSON-on-stdout.
_Avoid:_ using the configured log level before config loads

### Child logger

A Pino child bound at composition with a slice `component` (`health` or `places`) and passed into that slice's routes and outbound adapters. Adapters may create further children. There is no second logging API.
_Avoid:_ inventing a custom logger port so children can be passed around; documenting composition-time `adapter` bindings that `buildApp` does not make

### Health

Inbound probe on `GET /health` that reports service reachability plus a live Google Places connectivity/auth check. Feature validation failures must not by themselves make health unhealthy when Google Places would otherwise pass; missing/invalid Google credentials or a failed/timed-out Places check make health unhealthy.

### Upstream unavailability

The condition when find-places cannot complete because Places Nearby Search or Geocoding returned 5xx, timed out, or the network failed (Geocoding also maps `OVER_QUERY_LIMIT` and `UNKNOWN_ERROR` here). Living docs specify HTTP 502 with an opaque body for this condition. Distinct from Health’s unhealthy/503, which means this process cannot complete its Places connectivity/auth check.
_Avoid:_ echoing Google’s 503 to find-places callers; treating classified unavailability as a bug 500; conflating with invalid caller input

## Places

### Nearby place

A Google Nearby Search result as this service models it: a stable place id plus optional display fields (name, address, phone, types, website, and Google’s primaryType for that place). After search, website emptiness is the product inclusion gate — places with a website are dropped.
_Avoid:_ treating name/address/phone presence as an inclusion rule

### Request address

A caller-supplied location string on `POST /find-places` used in address mode with required `radiusMeters`, exclusive with `latitude` and `longitude`. Distinct from the optional address display field on a Nearby place. Address mode geocodes the string into a Search origin, then runs Nearby Search from that origin.
_Avoid:_ treating returned `formattedAddress` as this request field; sending a request address with latitude or longitude; treating unmatched geocode as an empty place list

### Search origin

The unique latitude/longitude pair Nearby Search uses as its center. Produced either from caller coordinates or from Geocoding a request address; the search does not distinguish which XOR arm produced it.
_Avoid:_ sending a request address into Nearby Search; treating an unassigned origin as a third request mode after XOR validation

### Geocoding

Converting a request address into a unique Search origin via Google Geocoding API so Nearby Search can run. Distinct from the optional address display field on a Nearby place. Unmatched, multiple, or partial matches are invalid caller input, not an empty place list.
_Avoid:_ treating ZERO_RESULTS as Nearby Search with no places; taking the first of several geocode results; sending the request address into Nearby Search

### Primary type

A coarse category key owned by this service (foodAndDrink, shopping, and siblings). Callers send these keys to narrow nearby search. Distinct from Google’s type strings and from the optional primaryType field on a returned nearby place.
_Avoid:_ treating a Google type string such as restaurant as a request category key

### Primary type catalog

The domain map from each primary type to the Google Nearby Search type strings that category expands to. HTTP allow-lists follow the catalog keys; the outbound adapter flattens selected keys into Google’s included-types field.
_Avoid:_ duplicating the type lists in the HTTP route or the use case

## Flagged ambiguities

- "application" had been used for the use-case layer — the agreed name is service.
- "primaryType" on a returned nearby place is Google’s classification of that place; Primary type (this glossary) is a request-time category key.
