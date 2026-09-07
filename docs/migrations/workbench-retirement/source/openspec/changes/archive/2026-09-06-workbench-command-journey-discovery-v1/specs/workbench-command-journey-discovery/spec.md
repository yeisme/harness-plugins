# workbench-command-journey-discovery Delta

## ADDED Requirements

### Requirement: Workbench MUST consume typed discovery projections only

The Workbench discovery surface SHALL ingest schema-validated typed projections from the Gateway discovery tools or owner-direct typed projections. It MUST NOT parse `--help` output, spawn local CLI processes to discover commands, or infer catalog entries from any non-typed source.

#### Scenario: Schema-invalid projection

- **WHEN** an ingested projection fails validation against `yeisme.command_catalog.v1` / `yeisme.command_suggestion.v1` / `yeisme.journey_descriptor.v1`
- **THEN** the surface SHALL render a typed error state for that source
- **AND** MUST NOT partially render unvalidated entries

#### Scenario: Gateway disabled

- **WHEN** Gateway discovery is not enabled or the projection is unreachable
- **THEN** the surface SHALL render `unavailable` for that source
- **AND** MUST NOT fall back to `--help` parsing or direct hidden-backend access

### Requirement: The discovery surface MUST be read-only with copy-only affordances

Journey and capability rendering SHALL be read-only. The only interactions SHALL be copy-to-clipboard of exact commands or deep links to owner-approved action surfaces that already exist. The Workbench MUST NOT execute suggestions, journeys, or commands, and MUST NOT auto-fill commands into an executable context.

#### Scenario: Suggestion display

- **WHEN** a user views a suggested command
- **THEN** the UI SHALL offer copy only
- **AND** effect class, approval requirement, and gates SHALL be rendered adjacent to the command

### Requirement: Availability states MUST be honest and machine-derived

`stale`, `degraded`, `policy-hidden`, and `unavailable` SHALL render as first-class states carrying the owner- or Gateway-reported reason code. A known owner with no available projection SHALL render `unavailable` rather than an empty success. Client-side guessing, TTL extension, or state upgrading MUST NOT occur.

#### Scenario: Namespace-scoped degradation

- **WHEN** one owner's discovery projection is degraded
- **THEN** that owner's entries SHALL show `degraded` with the reported reason
- **AND** other owners' entries SHALL remain unaffected

### Requirement: Workbench MUST NOT become a second registry

The surface SHALL NOT durably persist projections, command catalogs, prompt bodies, business DAGs, or owner operation state. Session-scoped memoization with explicit refetch is permitted. Every rendered result SHALL state its source (`gateway` or `owner:<name>`).

#### Scenario: Session end

- **WHEN** the user session ends
- **THEN** no projection-derived catalog data SHALL remain in durable storage
- **AND** the next session SHALL refetch from the typed sources

### Requirement: Rendered output MUST stay redacted

Rendered discovery content SHALL NOT include prompt bodies, provider payloads, credentials, raw tool arguments, or raw audit queries. Redaction assertions SHALL cover every rendered view.

#### Scenario: Projection carries sensitive content

- **WHEN** a projection field contains content outside the frozen discovery schemas
- **THEN** the surface SHALL drop or redact it per the discovery contract
- **AND** MUST NOT render it as-is
