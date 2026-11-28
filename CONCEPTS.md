# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Layout

### Hexagonal layout

The project’s ports-and-adapters shape: domain and service stay free of HTTP/framework types; adapters handle transport; composition wires them together. Swapping an inbound HTTP library is an adapter change, not a domain rewrite.
_Avoid:_ “just put routes in the use case,” framework-first layering; naming the use-case layer “application”; encoding inbound HTTP status codes or response JSON in domain

### Living docs

The current product and layout contract for humans and agents. README owns local setup. AGENTS.md owns the working rules. Living docs and the live package layout take precedence over historical plans and solutions. Code and package scripts define runtime behavior. Among living docs, the HTTP field catalog wins for request/response JSON and status bodies; the feature recipe wins for adapter error-mapping targets; architecture wins for layers and outbound adapter roles.
_Avoid:_ treating historical plans as the operating recipe; copying HTTP field tables into README or architecture

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

Inbound probe on `GET /health` that reports service reachability plus a live Google Places connectivity/auth check (**product** meaning). Feature validation failures must not by themselves make health unhealthy when Google Places would otherwise pass; missing/invalid Google credentials or a failed/timed-out Places check make health unhealthy.

_Live HTTP fields and status JSON: [docs/api.md](docs/api.md). This entry is product meaning, not the live wire._

### Upstream unavailability

The condition when find-places cannot complete because Places Nearby Search or Geocoding returned 5xx, timed out, or the network failed (Geocoding also maps `OVER_QUERY_LIMIT` and `UNKNOWN_ERROR` here). Living docs specify HTTP 502 with an opaque body for this condition. The live mapper uses hop-specific opaque strings (Nearby Search vs Geocoding) rather than one shared string, and is coarser than this product condition: other Nearby Search HTTP failures also return 502. Unmatched geocode remains invalid caller input (400), not this condition. Distinct from Health’s unhealthy/503, which means this process cannot complete its Places connectivity/auth check.

_Live HTTP fields and status JSON: [docs/api.md](docs/api.md). This entry is product meaning, not the live wire._
_Avoid:_ echoing Google’s 503 to find-places callers; treating classified unavailability as a bug 500; conflating with invalid caller input; assuming one shared 502 string for both Google hops

## Places

### Nearby place

A Google Nearby Search result identified by its place ID. The backend filters out listings that have a website. The API returns the ID and any available name, address, phone, types, and Google primary type. The frontend uses the ID to link to the listing in Google Maps.
_Avoid:_ treating name/address/phone presence as an inclusion rule

### Request address

A caller-supplied location string on `POST /find-places` used in address mode with required `radiusMeters`, exclusive with `latitude` and `longitude`. Distinct from the optional address display field on a Nearby place. Address mode geocodes the string into a Search origin, then runs Nearby Search from that origin.
_Avoid:_ treating returned `formattedAddress` as this request field; sending a request address with latitude or longitude; treating unmatched geocode as an empty place list

### Search origin

The unique latitude/longitude pair Nearby Search uses as its center. Produced either from caller coordinates or from Geocoding a request address; the search does not distinguish which XOR arm produced it.
_Avoid:_ sending a request address into Nearby Search; treating an unassigned origin as a third request mode after XOR validation

### Geocoding

Converting a request address into a unique Search origin via Google Geocoding API so Nearby Search can run. Distinct from the optional address display field on a Nearby place. The backend uses the first result and returns an invalid-address error when no match is available.
_Avoid:_ treating ZERO_RESULTS as Nearby Search with no places; sending the request address into Nearby Search

### Primary type

A coarse category key owned by this service (foodAndDrink, shopping, and siblings). Callers send these keys to narrow nearby search. Distinct from Google’s type strings and from the optional primaryType field on a returned nearby place.
_Avoid:_ treating a Google type string such as restaurant as a request category key

### Primary type catalog

The domain map from each primary type to the Google Nearby Search type strings that category expands to. HTTP allow-lists follow the catalog keys; the outbound adapter flattens selected keys into Google’s included-types field.
_Avoid:_ duplicating the type lists in the HTTP route or the use case

## Nearby Explorer

### Display origin

The coordinates used to draw and fit the search area in the browser. Coordinate search uses the same coordinates for the display and backend search origins. In address mode, Nominatim resolves the display origin separately from backend geocoding. The map waits for a display origin, while the results list follows the backend response.

### Search area

The disk around the origin defined by the search radius. The map displays the disk as a circle and fits the viewport to it using the radius sent with the Places request.

### Google Places API call count

Number of Google Nearby Search calls the backend made for a successful request, including its initial search and any subdivision calls. The frontend displays the count supplied by `googlePlacesApiCalls`.

### Invalid search
Places rejected the search because it could not use the request, typically an address it cannot geocode. Distinct from too many types, retryable failure, and a successful empty list. Distinct from form `SearchRequestError` (empty address, invalid radius, missing coordinates). The list tells the explorer to change the address; it does not mean Places or the network failed to run, and it does not mean the category set overflowed Google’s type cap.

### Too many types
Places rejected the search because the selected category keys expand past Google’s included-primary-types cap. Distinct from invalid search and from retryable failure. Distinct from form `SearchRequestError`. The list tells the explorer to deselect some categories and search again; it does not mean the address was unusable or that Places was down. The cap is on expanded Google types, not on how many category checkboxes exist.

### Retryable failure
Places or the network could not complete a search that the UI already treated as valid to send. Distinct from invalid search, too many types, and a successful empty list. The list tells the explorer to wait and submit again; it does not mean the address was unusable or that too many categories were selected.

## Flagged ambiguities

- "application" had been used for the use-case layer — the agreed name is service.
- "primaryType" on a returned nearby place is Google’s classification of that place; Primary type (this glossary) is a request-time category key.
