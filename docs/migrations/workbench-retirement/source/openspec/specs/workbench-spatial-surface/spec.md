# workbench-spatial-surface Specification

## Purpose
TBD - created by archiving change workbench-unified-spatial-creative-runtime-v1. Update Purpose after archive.
## Requirements
### Requirement: Spatial Surface MUST remain inside the Agent-first shell
Workbench MUST expose Conversation、Split 与 Spatial Focus desktop modes inside `/agent`. Agent timeline、composer、session state、gate alerts and proposal attention MUST remain mounted and MUST NOT be replaced by a parallel Canvas or Show application shell.

#### Scenario: User enters Spatial Focus
- **WHEN** a desktop user activates Spatial Focus
- **THEN** Spatial Surface occupies the primary workspace while the compact composer and current session state remain available
- **AND** the existing Pane layout reducer, visible limit and split-depth rules remain authoritative

### Requirement: Spatial Surface MUST provide versioned Lens composition
The surface MUST support only registered `creative_production`、`workflow`、`run`、`review` and `evidence` Lens descriptors in v1. Each Lens MUST declare allowed projection kinds, overlays, commands, capability requirements and recovery state through a closed server-authored descriptor.

#### Scenario: Unknown Lens is requested
- **WHEN** a route, Agent intent or restored layout requests an unknown Lens or registry version
- **THEN** the request MUST fail closed with `needs_contract`
- **AND** the browser MUST NOT load a dynamic component or fallback Lens

### Requirement: Spatial snapshots MUST preserve provenance and Owner authority
`SpatialSurfaceSnapshotV1` MUST include surface and Board revision, Lens descriptor, bounded tiles, projection provenance, freshness, capability and runtime overlays. It MUST contain only safe refs and bounded summaries and MUST NOT include Owner payloads, credentials, private paths, raw prompts, provider payloads, arbitrary URLs or artifact bytes.

#### Scenario: Owner segment violates the closed contract
- **WHEN** an Owner segment contains an unknown field, unsafe ref or forbidden content
- **THEN** the affected segment MUST become redacted `contract_mismatch`
- **AND** the remaining snapshot MUST NOT infer or recreate the rejected Owner facts

### Requirement: Viewport v2 MUST bound 50k logical surfaces
`SpatialViewportQueryV2` MUST query by surface ref, expected revision, bounds, zoom bucket, LOD, filter, tile cursor and maximum primitive budget. The service MUST return bounded tiles/clusters/projections with next cursor and MUST NOT return unbounded canonical detail.

#### Scenario: 50k Board is viewed at far LOD
- **WHEN** a Board containing 50k nodes, 75k relations and 1k groups is opened at far LOD
- **THEN** the service MUST return bounded clusters or lightweight primitives within the approved tile budget
- **AND** the browser MUST NOT mount all addressable objects as rich DOM nodes

### Requirement: Renderer MUST use bounded WebGL and DOM layers
Far and medium LOD MUST use the registered WebGL renderer; near selected objects, forms, Review and Workflow editing MAY use React DOM or React Flow overlays but rich DOM mounts MUST remain at or below 200. Renderer loss or unsupported worker capability MUST produce an explicit degraded state and bounded fallback.

#### Scenario: WebGL context is lost
- **WHEN** the renderer reports context loss while no mutation is pending
- **THEN** browser render caches MUST be discarded and rebuilt from the latest canonical snapshot
- **AND** no Board, Workflow or Owner mutation MAY be inferred from the lost frame

### Requirement: Spatial Surface MUST be desktop-only
Spatial Surface v1 MUST provide full editing only on the approved desktop capability envelope. The project MUST NOT add phone/tablet responsive editing, touch-specific product flows, mobile screenshots or mobile E2E for this capability.

#### Scenario: Narrow viewport opens a spatial entry
- **WHEN** the viewport does not satisfy the desktop capability envelope
- **THEN** Workbench MUST show a desktop-required unavailable state
- **AND** MUST NOT mount a hidden or reduced mobile Spatial editor

### Requirement: Spatial interactions MUST have accessible equivalents
Every pan-independent action, selection, move, connect, group, review and runtime command MUST have a keyboard/menu equivalent. The surface MUST expose a bounded accessible object list and screen-reader summary that mirror the current authorized viewport without creating a second data owner.

#### Scenario: Keyboard user selects a projected Shot
- **WHEN** the user navigates the accessible viewport list and activates a Shot projection
- **THEN** the same safe ref MUST become selected in the visual surface and inspector
- **AND** focus MUST remain predictable without relying on color or pointer-only hit testing

### Requirement: Spatial performance MUST have deterministic promotion gates
The approved reference environment MUST measure PostgreSQL viewport p95, first-frame latency, frame timing, highlight latency, DOM mounts, primitive count, long tasks and context recovery against the budgets declared in design.md. Results MUST be recorded as capacity evidence and MUST NOT be presented as production SLO without staging evidence.

#### Scenario: Browser capacity gate exceeds a budget
- **WHEN** the 50k Chromium run exceeds a required frame, mount, first-frame or long-task budget
- **THEN** Spatial Surface MUST remain below promoted readiness
- **AND** a smaller fixture or warm-cache-only result MUST NOT close the gate

### Requirement: Production spatial composition SHALL bind safe runtime sources
The runtime MUST bind the authorized Board watch source plus approved owner and runtime overlay ports before advertising an available spatial capability. Snapshots and watch events MUST contain only closed safe refs, provenance, descriptors, receipts and evidence; expired or cross-tenant content MUST fail closed.

#### Scenario: Watch reports a gap
- **WHEN** the Board source reports a cursor gap
- **THEN** every transport emits the closed spatial resync event and the SDK re-enters through canonical query
- **AND** it MUST NOT parse resync as a snapshot or invent intermediate state

### Requirement: Desktop capability SHALL gate spatial mounting
Before spatial query, worker or renderer creation, the desktop envelope MUST be satisfied. A narrow viewport MUST show only a desktop-required unavailable state and MUST make zero spatial query or worker/render requests.

#### Scenario: Narrow viewport opens spatial ingress
- **WHEN** a viewport is outside the approved desktop envelope
- **THEN** the Agent shell renders desktop-required unavailable state
- **AND** no Spatial Surface data request, worker or WebGL renderer is mounted

### Requirement: Tile and density projections SHALL be production-derived
GORM-managed tile/density projections MUST be invalidated from the same Board commit transaction by a revision-bound rebuild job. A dedicated projection worker, independent from Board outbox delivery, MUST publish an exact-revision complete far grid atomically with its ready head. Far/no-complex-filter viewport reads MUST attempt that ready index before canonical node/edge/group reads; medium and near reads remain canonical. A ready head MUST prove its full persisted tile count, digest and requested-grid coverage. The 128-tile viewport read cap MUST NOT cap a complete Board projection. Missing, pending, stale, incomplete, over-budget or unsupported projections MUST use a bounded canonical fallback marked degraded, and MUST NOT return tiles from an older revision. A 50k fixture MUST exercise the indexed query path and bounded fallback behavior.

`SpatialSurfaceSnapshotV1.ownerSegments` is an additive closed safe projection; gRPC, HTTP and JSON-RPC MUST preserve the same owner ref/readiness/health/redaction/summary fields and omit it when unbound. Watch envelopes use `workbench.spatial_watch_event.v1` with closed `snapshot|event|resync` kind, cursor, lens kind, optional event ref and exact current revision. A resyncing client MUST obtain an expected revision from the authorized additive `GetSpatialSurfaceRevision` facade (or its HTTP/JSON-RPC equivalent), never from a guessed cursor.

#### Scenario: Board geometry changes
- **WHEN** an atomic Board change-set commits
- **THEN** affected tiles are invalidated or rebuilt for the new Board revision
- **AND** a later viewport query MUST NOT return tiles from an older revision

#### Scenario: Far projection has an incomplete requested grid
- **WHEN** the current-revision head exists but a persisted overlapping grid tile is absent or its total count/digest no longer matches the head
- **THEN** the far viewport MUST reject the density index and use bounded canonical fallback with `degraded` provenance
- **AND** it MUST NOT undercount the viewport by treating the partial grid as ready

#### Scenario: Two workers observe an expired projection lease
- **WHEN** two projection workers race to reclaim the same expired job
- **THEN** only the worker that conditionally replaces the observed old lease may publish
- **AND** a late worker with the old lease MUST be rejected without replacing the current head

#### Scenario: Projection completes while Board revision advances
- **WHEN** a far density read succeeds but the final authorized Board read observes a different tenant, workspace, active state or revision
- **THEN** the surface MUST return `board_resync_required`
- **AND** it MUST NOT return the already-read density as fresh

#### Scenario: Projection publisher races a Board commit
- **WHEN** an exact-revision publisher and a Board commit race
- **THEN** the publisher MUST lock the exact active Board row before it deletes or writes projection rows
- **AND** if the publisher wins first, the following commit MUST serialize and rebind or invalidate that newly published head for its new revision
- **AND** if the commit wins first, the old publisher MUST return stale before changing tiles or the head

#### Scenario: Display-only Board revision preserves exact density semantics
- **WHEN** a density-neutral Board mutation advances revision and the prior ready head has complete matching tiles
- **THEN** the commit transaction MUST atomically rebind all tiles and the head to the new revision with a new revision-bound digest
- **AND** the next far Surface query MUST return fresh tile provenance without waiting for a worker
- **BUT WHEN** the prior head or tile set is incomplete
- **THEN** the transaction MUST invalidate it and schedule an exact-revision rebuild

#### Scenario: Valid Board exceeds derived projection bounds
- **WHEN** a Board is valid but exceeds the declared grid or entity capacity for the derived far projection
- **THEN** the worker MUST persist a parked reason for that required revision and stop retrying it
- **AND** a transient failure MUST instead use bounded retry backoff; a later density-affecting revision may reset work to pending

