# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

## Skeleton layout

### Hexagonal layout
The project’s ports-and-adapters shape: domain and application stay free of HTTP/framework types; adapters handle transport; composition wires them together. Swapping an inbound HTTP library is an adapter change, not a domain rewrite.
*Avoid:* “just put routes in the use case,” framework-first layering

### Composition root
The shared app factory that registers inbound adapters and returns an Express app without listening. Callers (process entry and HTTP tests) load env and create the logger, then pass those deps into the factory. Listening belongs at process entry, not in the factory.
*Avoid:* separate “test-only” app wiring that re-registers routes differently

### Echo vertical
The copyable sample feature path (domain rule → use case → HTTP route → composition registration → tests). New features should mirror this vertical rather than inventing parallel structures.
*Avoid:* empty repository folders “for later,” feature slices that skip domain when there is a domain rule

### Health
Liveness-only inbound check. It must not call feature use cases; feature validation failures must not break health.
