# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Layout

### Hexagonal layout
The project’s ports-and-adapters shape: domain and service stay free of HTTP/framework types; adapters handle transport; composition wires them together. Swapping an inbound HTTP library is an adapter change, not a domain rewrite.
*Avoid:* “just put routes in the use case,” framework-first layering; naming the use-case layer “application”

### Living docs
The current product and layout contract for humans and agents. On conflict with older plans or past solution writeups, living docs plus the composition root win.
*Avoid:* treating historical plans as the operating recipe

### Snapshot
A past plan or documented solution kept for history. It is not the current layout contract unless a dedicated refresh updates it.
*Avoid:* copying snapshot layer names into the current feature recipe

### Composition root
The shared app factory that registers inbound adapters and returns an Express app without listening. Callers (process entry and HTTP tests) load config and create the logger, then pass both into the factory. Listening belongs at process entry, not in the factory.
*Avoid:* separate “test-only” app wiring that re-registers routes differently

### Bootstrap logger
A fixed-severity native Pino logger used at process entry when configuration is not yet available, so fatal startup failures (config validation, listen errors) still emit before exit. Created with `createLogger('error')` because the configured log level cannot be read when parsing fails. Config-load failure is logged Error-first with a message string (Pino's call shape). Local operator-facing output is colorized pretty, not JSON-on-stdout.
*Avoid:* using the configured log level before config loads

### Child logger
A Pino child bound at composition with a slice `component` (`health` or `places`) and passed into that slice's routes and outbound adapters. Adapters may create further children. There is no second logging API.
*Avoid:* inventing a custom logger port so children can be passed around; documenting composition-time `adapter` bindings that `buildApp` does not make

### Health
Inbound probe on `GET /health` that reports service reachability plus a live Google Places connectivity/auth check. Feature validation failures must not by themselves make health unhealthy when Google Places would otherwise pass; missing/invalid Google credentials or a failed/timed-out Places check make health unhealthy.

### Upstream unavailability
The condition when Places Nearby Search cannot complete because Google returned 5xx, the request timed out, or the network failed. Find-places maps this to HTTP 502 with an opaque body. Distinct from Health’s unhealthy/503, which means this process cannot complete its Places connectivity/auth check.
*Avoid:* echoing Google’s 503 to find-places callers; treating classified unavailability as a bug 500; conflating with invalid caller input

## Flagged ambiguities

- "application" had been used for the use-case layer — the agreed name is service.
