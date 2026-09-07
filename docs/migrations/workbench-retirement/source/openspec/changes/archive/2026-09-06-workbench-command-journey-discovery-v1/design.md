# workbench-command-journey-discovery-v1 Design

## Context

The discovery plane now has three consumable layers:

1. Owner CLI typed projections (Eikona `common_discovery` output, Scaena `data.common_discovery` across CLI/HTTP/MCP transports) validated against root `docs/contracts/discovery/` schemas.
2. Gateway read-only aggregation (`gateway_capabilities_search` / `gateway_journeys_suggest`, opt-in, policy-filtered, namespace-scoped failure isolation; audit stores digests, not raw queries).
3. Root conformance harness (`scripts/validate-discovery-conformance.py` with `--live` mode) proving the shared contract across owners.

Workbench must join as a pure consumer. The handoff forbids: parsing `--help`, spawning local CLI processes, auto-executing suggestions or journeys, storing a second command registry / prompt body / business DAG / owner operation state, or bypassing Gateway policy.

## Goals / Non-Goals

**Goals:**

- A user can search capabilities across owners and read a journey's steps, gates, effects, approvals, and availability without leaving the Workbench.
- Every rendered command is exact, copyable, and human-runnable as-is (or replaced by an owner-approved action surface link).
- Availability states are honest and machine-derived from projections, not inferred.

**Non-Goals:**

- Executing commands, suggestions, or journeys from the Workbench.
- Building a Workbench-side catalog or normalizing owner semantics (that is Gateway/owner territory).
- Displaying prompt bodies, provider payloads, or credentials from projections.

## Decisions

### D1: Consume Gateway projection first, owner direct projection second

The default data path is the Gateway discovery projection (policy already applied, one transport, one auth story). Direct owner projections are a fallback for owners whose Workbench integration already exists (e.g., Auctra workbench contract) and for offline/local mode; the renderer treats both as the same typed shape. Workbench never merges the two into its own registry — each render states its source (`gateway` vs `owner:<name>`).

### D2: Read-only UI surface with copy-only affordances

The journey panel renders `command`, `effect_class`, `approval`, `prerequisites`, `gates`, `availability`. The only interaction is copy-to-clipboard or a deep link to an owner-approved action surface that already exists in the Workbench. No run button, no suggestion auto-fill into an executable context.

### D3: Honest state mapping

Projection fields map 1:1 to UI states: `stale`, `degraded`, `policy-hidden`, `unavailable` render as first-class badges with the owner-reported reason code; absence of a projection for a known owner renders `unavailable`, never an empty list. No state is dropped, retried past its TTL, or upgraded by client-side guessing.

### D4: Schema-validated ingestion with fixture conformance

Ingest validates against the root schemas (`command_catalog.v1` / `command_suggestion.v1` / `journey_descriptor.v1`) before render; invalid projections fail closed with a typed error state. Conformance tests consume the root valid/invalid fixtures the same way the Gateway owner change did, so the three consumers (Gateway, owner CLIs, Workbench) share one fixture truth.

### D5: No persisted projection cache beyond session-scoped memoization

Session-scoped memoization with explicit refetch is allowed; durable caches are not, because a durable cache is a second registry in disguise.

## Rollout / Migration Plan

1. Phase 1: typed client + schema validation + fixture conformance (no UI).
2. Phase 2: read-only search + journey panel behind a feature flag; gateway projection path.
3. Phase 3: owner-direct fallback path and deep links to existing approved action surfaces.
4. Rollback: feature flag off; no data migration involved.

## Risks / Trade-offs

- Gateway discovery must be enabled and exposed for the primary path; if disabled, the surface shows the honest `unavailable` state (accepted; no bypass).
- Copyable commands can still be dangerous if users run them blindly; effect/approval badges and gates are rendered adjacent to every command to keep the risk visible.

## Open Questions

None for the first version. Execute-from-Workbench is explicitly deferred until a separate owner-approved execution contract exists.
